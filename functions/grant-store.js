const GRANTS_COLLECTION = 'grants';

/**
 * Grant store over the audiobook Firestore database, as expected by validateAccess.
 * @param {import('firebase-admin/firestore').Firestore} db
 * @returns {{get: (id: string) => Promise<object | null>}}
 */
export const createFirestoreGrantStore = (db) => ({
  get: async (id) => {
    const snapshot = await db.collection(GRANTS_COLLECTION).doc(id).get();
    return snapshot.exists ? snapshot.data() : null;
  },
});
