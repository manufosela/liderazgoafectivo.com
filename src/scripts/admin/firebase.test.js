import { describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => ({ list: [], user: null }));

vi.mock('@firebase/app', () => ({ initializeApp: (config) => ({ config }) }));
vi.mock('@firebase/auth', () => {
  const auth = {
    get currentUser() {
      return calls.user;
    },
  };
  return {
    getAuth: (app) => Object.assign(auth, { app }),
    GoogleAuthProvider: class {
      setCustomParameters(parameters) {
        this.parameters = parameters;
      }
    },
    onAuthStateChanged: (target, listener) => calls.list.push(['onAuthStateChanged', target === auth, typeof listener]),
    signInWithPopup: async (target, provider) => calls.list.push(['signInWithPopup', target === auth, provider.parameters]),
    signOut: async (target) => calls.list.push(['signOut', target === auth]),
  };
});

const { createGoogleAuth, readFirebaseConfig } = await import('./firebase.js');

const env = {
  PUBLIC_FIREBASE_API_KEY: 'web-key',
  PUBLIC_FIREBASE_AUTH_DOMAIN: 'proyecto.firebaseapp.com',
  PUBLIC_FIREBASE_PROJECT_ID: 'proyecto',
  PUBLIC_FIREBASE_APP_ID: '1:2:web:3',
};

describe('readFirebaseConfig', () => {
  it('builds the web config from the PUBLIC_ variables', () => {
    expect(readFirebaseConfig(env)).toEqual({ apiKey: 'web-key', authDomain: 'proyecto.firebaseapp.com', projectId: 'proyecto', appId: '1:2:web:3' });
  });

  it('names every missing variable', () => {
    expect(() => readFirebaseConfig({ ...env, PUBLIC_FIREBASE_API_KEY: '', PUBLIC_FIREBASE_APP_ID: undefined })).toThrow(
      'Missing PUBLIC_FIREBASE_API_KEY, PUBLIC_FIREBASE_APP_ID in .env',
    );
  });
});

describe('createGoogleAuth', () => {
  it('signs in with a Google popup that always lets the admin pick the account, and signs out', async () => {
    const auth = createGoogleAuth(readFirebaseConfig(env));

    auth.onUser(() => {});
    await expect(auth.signIn()).resolves.toBeUndefined();
    await auth.signOut();

    expect(calls.list).toEqual([
      ['onAuthStateChanged', true, 'function'],
      ['signInWithPopup', true, { prompt: 'select_account' }],
      ['signOut', true],
    ]);
  });

  it('gives the ID token of the signed-in user and refuses when nobody is signed in', async () => {
    const auth = createGoogleAuth(readFirebaseConfig(env));

    await expect(auth.getToken()).rejects.toThrow('Nobody is signed in');
    calls.user = { getIdToken: async () => 'id-token' };
    await expect(auth.getToken()).resolves.toBe('id-token');
  });
});
