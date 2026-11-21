import { initializeApp } from '@firebase/app';
import { GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithPopup, signOut } from '@firebase/auth';

// Firebase web config key → PUBLIC_ variable of .env, which is never committed.
const CONFIG_VARIABLES = {
  apiKey: 'PUBLIC_FIREBASE_API_KEY',
  authDomain: 'PUBLIC_FIREBASE_AUTH_DOMAIN',
  projectId: 'PUBLIC_FIREBASE_PROJECT_ID',
  appId: 'PUBLIC_FIREBASE_APP_ID',
};

/** Web config of the Firebase project; fails naming what is missing, never with a partial config. */
export const readFirebaseConfig = (env) => {
  const missing = Object.values(CONFIG_VARIABLES).filter((name) => !env[name]);
  if (missing.length > 0) throw new Error(`Missing ${missing.join(', ')} in .env`);
  return Object.fromEntries(Object.entries(CONFIG_VARIABLES).map(([key, name]) => [key, env[name]]));
};

/**
 * Google sign-in for the admin page, shaped as startPanel and createAdminApi expect.
 * A popup and not a redirect: the site is not on the auth domain, and redirects across domains
 * break with the storage partitioning of current browsers.
 */
export const createGoogleAuth = (config) => {
  const auth = getAuth(initializeApp(config));
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return {
    onUser: (listener) => onAuthStateChanged(auth, listener),
    signIn: async () => {
      await signInWithPopup(auth, provider);
    },
    signOut: () => signOut(auth),
    getToken: async () => {
      if (!auth.currentUser) throw new Error('Nobody is signed in');
      return auth.currentUser.getIdToken();
    },
  };
};
