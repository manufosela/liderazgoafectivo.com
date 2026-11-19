import { beforeEach, describe, expect, it, vi } from 'vitest';

const admin = vi.hoisted(() => ({ apps: [], initializeApp: vi.fn(), getFirestore: vi.fn() }));

vi.mock('firebase-admin/app', () => ({ getApps: () => admin.apps, initializeApp: admin.initializeApp }));
vi.mock('firebase-admin/firestore', () => ({ getFirestore: admin.getFirestore }));

const { AUDIOBOOK_DATABASE_ID, getAudiobookDatabase } = await import('./database.js');

describe('getAudiobookDatabase', () => {
  beforeEach(() => {
    admin.apps.length = 0;
    admin.initializeApp.mockReset().mockReturnValue('new-app');
    admin.getFirestore.mockReset().mockReturnValue('audiobook-db');
  });

  it('opens the audiolibro database, never the community (default) one', () => {
    expect(getAudiobookDatabase()).toBe('audiobook-db');
    expect(AUDIOBOOK_DATABASE_ID).toBe('audiolibro');
    expect(admin.getFirestore).toHaveBeenCalledWith('new-app', 'audiolibro');
  });

  it('reuses the app already initialised', () => {
    admin.apps.push('existing-app');

    getAudiobookDatabase();

    expect(admin.initializeApp).not.toHaveBeenCalled();
    expect(admin.getFirestore).toHaveBeenCalledWith('existing-app', 'audiolibro');
  });
});
