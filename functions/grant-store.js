const GRANTS_COLLECTION = 'grants';

/**
 * Grant store over the audiobook Firestore database, as expected by validateAccess and the admin tool.
 * @param {import('firebase-admin/firestore').Firestore} db
 */
export const createFirestoreGrantStore = (db) => {
  const grants = db.collection(GRANTS_COLLECTION);
  return {
    get: async (id) => {
      const snapshot = await grants.doc(id).get();
      return snapshot.exists ? snapshot.data() : null;
    },
    // create() fails if the document exists, so a code collision never overwrites another grant.
    create: (id, record) => grants.doc(id).create(record),
    list: async () =>
      (await grants.get()).docs.map((doc) => {
        const { createdAt, ...rest } = doc.data();
        return { id: doc.id, ...rest, createdAt: createdAt.toDate() };
      }),
    revoke: (id, revokedAt) => grants.doc(id).update({ revoked: true, revokedAt }),
  };
};
