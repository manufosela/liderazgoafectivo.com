const ATTEMPTS_COLLECTION = 'attempts';

const toRecord = (snapshot) => {
  if (!snapshot.exists) return null;
  const { count, windowStart } = snapshot.data();
  return { count, windowStart: windowStart.toDate() };
};

/**
 * Attempt counters in the audiobook Firestore database. Every change reads and writes all its keys in
 * one transaction, so concurrent attempts are serialised and a throwing change writes nothing.
 * @param {import('firebase-admin/firestore').Firestore} db
 */
export const createFirestoreAttemptStore = (db) => {
  const attempts = db.collection(ATTEMPTS_COLLECTION);
  return {
    transact: (keys, change) =>
      db.runTransaction(async (transaction) => {
        const refs = keys.map((key) => attempts.doc(key));
        const records = (await transaction.getAll(...refs)).map(toRecord);
        change(records).forEach((record, index) => transaction.set(refs[index], record));
      }),
  };
};
