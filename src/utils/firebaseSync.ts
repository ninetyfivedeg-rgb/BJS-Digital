import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  Unsubscribe,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  Member,
  SavingsTransaction,
  Loan,
  LoanRepayment,
  CashFlowRecord,
  SimpanPinjamCashMutation,
  BusinessUnitTransaction,
} from '../types';

/**
 * Remove undefined values because Firestore rejects them.
 */
function cleanData<T extends Record<string, any>>(data: T): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      if (Array.isArray(value)) {
        clean[key] = value.map((item) =>
          item !== null && typeof item === 'object' ? cleanData(item) : item
        );
      } else if (value !== null && typeof value === 'object') {
        clean[key] = cleanData(value);
      } else {
        clean[key] = value;
      }
    }
  }
  return clean;
}

/**
 * Check and seed initial data if Firestore members collection is empty
 */
export async function seedInitialDataIfEmpty(
  initialMembers: Member[],
  initialSavings: SavingsTransaction[]
): Promise<void> {
  const membersPath = 'members';
  try {
    const snapshot = await getDocs(collection(db, membersPath));
    if (!snapshot.empty) {
      // Already seeded
      return;
    }

    console.info('Seeding initial data into Firestore...');

    // Batch seed members (chunks of 400 to respect Firestore batch limit of 500)
    const memberChunks: Member[][] = [];
    for (let i = 0; i < initialMembers.length; i += 400) {
      memberChunks.push(initialMembers.slice(i, i + 400));
    }

    for (const chunk of memberChunks) {
      const batch = writeBatch(db);
      for (const m of chunk) {
        const ref = doc(db, 'members', m.id);
        batch.set(ref, cleanData(m), { merge: true });
      }
      await batch.commit();
    }

    // Batch seed savings
    const savingsChunks: SavingsTransaction[][] = [];
    for (let i = 0; i < initialSavings.length; i += 400) {
      savingsChunks.push(initialSavings.slice(i, i + 400));
    }

    for (const chunk of savingsChunks) {
      const batch = writeBatch(db);
      for (const s of chunk) {
        const ref = doc(db, 'savings', s.id);
        batch.set(ref, cleanData(s), { merge: true });
      }
      await batch.commit();
    }

    console.info('Firestore initial data seeded successfully.');
  } catch (error) {
    console.error('Failed to seed initial Firestore data:', error);
    handleFirestoreError(error, OperationType.WRITE, membersPath);
  }
}

/**
 * Realtime subscription to a Firestore collection
 */
export function subscribeToCollection<T extends { id: string }>(
  collectionName: string,
  onUpdate: (items: T[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const colRef = collection(db, collectionName);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const items: T[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as T);
      });
      onUpdate(items);
    },
    (error) => {
      console.error(`Error listening to collection ${collectionName}:`, error);
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, collectionName);
    }
  );
}

/**
 * Generic Upsert into Firestore
 */
export async function upsertDocument<T extends { id: string }>(
  collectionName: string,
  item: T
): Promise<void> {
  const path = `${collectionName}/${item.id}`;
  try {
    const docRef = doc(db, collectionName, item.id);
    await setDoc(docRef, cleanData(item), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Generic Delete from Firestore
 */
export async function deleteDocument(
  collectionName: string,
  docId: string
): Promise<void> {
  const path = `${collectionName}/${docId}`;
  try {
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
