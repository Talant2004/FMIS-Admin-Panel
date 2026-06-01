export function isPermissionDenied(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const code = "code" in error ? String((error as { code: string }).code) : ""
  const message = "message" in error ? String((error as { message: string }).message) : ""
  return code === "permission-denied" || message.includes("insufficient permissions")
}

export const PERMISSION_DENIED_HINT =
  "Нет доступа к данным. Войдите в аккаунт или проверьте правила Firestore для коллекции samples."
