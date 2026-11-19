import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

/** Named Firestore database of the audiobook, kept apart from the community data in (default). */
export const AUDIOBOOK_DATABASE_ID = 'audiolibro';

/** The single Admin SDK app of these functions, created on first use. */
export const getAudiobookApp = () => getApps()[0] ?? initializeApp();

/** @returns {import('firebase-admin/firestore').Firestore} */
export const getAudiobookDatabase = () => getFirestore(getAudiobookApp(), AUDIOBOOK_DATABASE_ID);
