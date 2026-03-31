import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getStorageClient } from "@/lib/firebase";

export type EnterpriseAssetField = "logo" | "favicon" | "banner" | "appCover";

function getFileExtension(fileName: string): string {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "bin";
}

export async function uploadEnterpriseAsset(
  enterpriseId: string,
  field: EnterpriseAssetField,
  file: File
): Promise<string> {
  const extension = getFileExtension(file.name);
  const fileRef = ref(
    getStorageClient(),
    `enterprises/${enterpriseId}/${field}-${Date.now()}.${extension}`
  );

  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
}
