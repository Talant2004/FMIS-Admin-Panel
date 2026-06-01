"use client"

import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { isAdminEmail } from "@/lib/auth/admin"
import { getAuthClient } from "@/lib/firebase"

type AuthContextValue = {
  user: User | null
  loading: boolean
  isAdmin: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  authError: string | null
  clearAuthError: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: "select_account" })

function mapAuthError(code: string): string {
  switch (code) {
    case "auth/popup-closed-by-user":
      return "Окно входа закрыто. Попробуйте ещё раз."
    case "auth/unauthorized-domain":
      return "Домен не разрешён в Firebase. Добавьте localhost и ваш URL в Authentication → Authorized domains."
    case "auth/operation-not-allowed":
      return "Вход через Google не включён в Firebase Console (Authentication → Sign-in method)."
    default:
      return "Не удалось войти. Попробуйте снова."
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    const auth = getAuthClient()
    const unsub = onAuthStateChanged(auth, (next) => {
      setUser(next)
      setLoading(false)
    })
    return unsub
  }, [])

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null)
    try {
      await signInWithPopup(getAuthClient(), googleProvider)
    } catch (err: unknown) {
      const code =
        err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : ""
      setAuthError(mapAuthError(code))
      throw err
    }
  }, [])

  const signOut = useCallback(async () => {
    setAuthError(null)
    await firebaseSignOut(getAuthClient())
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAdmin: isAdminEmail(user?.email),
      signInWithGoogle,
      signOut,
      authError,
      clearAuthError: () => setAuthError(null),
    }),
    [user, loading, signInWithGoogle, signOut, authError]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return ctx
}
