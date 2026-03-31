import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type { Enterprise } from "@/lib/types";

const ENTERPRISES_COLLECTION = "enterprises";

export async function getEnterprises(): Promise<Enterprise[]> {
  const snapshot = await getDocs(collection(getDb(), ENTERPRISES_COLLECTION));
  const enterprises = snapshot.docs.map((snapshotDoc) => snapshotDoc.data() as Enterprise);
  return enterprises.sort((a, b) => a.id.localeCompare(b.id));
}

export async function saveEnterprise(enterprise: Enterprise): Promise<void> {
  await setDoc(doc(getDb(), ENTERPRISES_COLLECTION, enterprise.id), enterprise);
}

export async function updateEnterpriseActive(id: string, isActive: boolean): Promise<void> {
  await updateDoc(doc(getDb(), ENTERPRISES_COLLECTION, id), { isActive });
}

export async function updateEnterprise(
  id: string,
  updates: Partial<Enterprise>
): Promise<void> {
  await updateDoc(doc(getDb(), ENTERPRISES_COLLECTION, id), updates);
}

export async function removeEnterprise(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), ENTERPRISES_COLLECTION, id));
}
