import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

/** Named Firestore database of the audiobook, kept apart from the community data in (default). */
export const AUDIOBOOK_DATABASE_ID = 'audiolibro';

/** @returns {import('firebase-admin/firestore').Firestore} */
export const getAudiobookDatabase = () => getFirestore(getApps()[0] ?? initializeApp(), AUDIOBOOK_DATABASE_ID);
