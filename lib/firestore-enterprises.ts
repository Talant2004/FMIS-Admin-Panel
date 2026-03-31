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

type EnterpriseFirestore = Omit<Enterprise, "geojson"> & {
  geojson?: string;
};

function toFirestoreEnterprise(enterprise: Enterprise): EnterpriseFirestore {
  return {
    ...enterprise,
    geojson: enterprise.geojson ? JSON.stringify(enterprise.geojson) : undefined,
  };
}

function fromFirestoreEnterprise(enterprise: EnterpriseFirestore): Enterprise {
  let geojson: GeoJSON.FeatureCollection | undefined;
  if (enterprise.geojson) {
    try {
      geojson = JSON.parse(enterprise.geojson) as GeoJSON.FeatureCollection;
    } catch {
      geojson = undefined;
    }
  }

  return {
    ...enterprise,
    geojson,
  };
}

export async function getEnterprises(): Promise<Enterprise[]> {
  const snapshot = await getDocs(collection(getDb(), ENTERPRISES_COLLECTION));
  const enterprises = snapshot.docs.map((snapshotDoc) =>
    fromFirestoreEnterprise(snapshotDoc.data() as EnterpriseFirestore)
  );
  return enterprises.sort((a, b) => a.id.localeCompare(b.id));
}

export async function saveEnterprise(enterprise: Enterprise): Promise<void> {
  await setDoc(
    doc(getDb(), ENTERPRISES_COLLECTION, enterprise.id),
    toFirestoreEnterprise(enterprise)
  );
}

export async function updateEnterpriseActive(id: string, isActive: boolean): Promise<void> {
  await updateDoc(doc(getDb(), ENTERPRISES_COLLECTION, id), { isActive });
}

export async function updateEnterprise(
  id: string,
  updates: Partial<Enterprise>
): Promise<void> {
  const updatePayload: Record<string, unknown> = { ...updates };
  if ("geojson" in updates) {
    updatePayload.geojson = updates.geojson ? JSON.stringify(updates.geojson) : null;
  }
  await updateDoc(doc(getDb(), ENTERPRISES_COLLECTION, id), updatePayload);
}

export async function removeEnterprise(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), ENTERPRISES_COLLECTION, id));
}
