"use client"

import {
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  updateProfile,
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
import { authErrorCode, mapAuthError } from "@/lib/auth/errors"
import { getAuthClient } from "@/lib/firebase"

type AuthContextValue = {
  user: User | null
  loading: boolean
  isAdmin: boolean
  signInWithGoogle: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<void>
  signOut: () => Promise<void>
  authError: string | null
  clearAuthError: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: "select_account" })
googleProvider.addScope("email")
googleProvider.addScope("profile")

const GOOGLE_REDIRECT_FALLBACK = new Set([
  "auth/popup-blocked",
  "auth/operation-not-supported-in-this-environment",
  "auth/internal-error",
])

function authErrorFromUnknown(err: unknown): string {
  return mapAuthError(authErrorCode(err))
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    const auth = getAuthClient()
    let unsub = () => {}

    const start = async () => {
      try {
        await getRedirectResult(auth)
      } catch (err: unknown) {
        setAuthError(authErrorFromUnknown(err))
      }

      unsub = onAuthStateChanged(auth, (next) => {
        setUser(next)
        setLoading(false)
      })
    }

    void start()
    return () => unsub()
  }, [])

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null)
    const auth = getAuthClient()
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err: unknown) {
      const code = authErrorCode(err)
      if (GOOGLE_REDIRECT_FALLBACK.has(code)) {
        await signInWithRedirect(auth, googleProvider)
        return
      }
      setAuthError(authErrorFromUnknown(err))
      throw err
    }
  }, [])

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    setAuthError(null)
    const trimmed = email.trim()
    try {
      await signInWithEmailAndPassword(getAuthClient(), trimmed, password)
    } catch (err: unknown) {
      const code = authErrorCode(err)
      if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
        try {
          const methods = await fetchSignInMethodsForEmail(getAuthClient(), trimmed)
          if (methods.includes("google.com") && !methods.includes("password")) {
            setAuthError(
              "Этот аккаунт создан через Google в приложении. Пароль не нужен — нажмите «Войти через Google»."
            )
            throw err
          }
        } catch (inner) {
          if (inner === err) throw err
        }
      }
      setAuthError(authErrorFromUnknown(err))
      throw err
    }
  }, [])

  const signUpWithEmail = useCallback(
    async (email: string, password: string, displayName?: string) => {
      setAuthError(null)
      try {
        const cred = await createUserWithEmailAndPassword(
          getAuthClient(),
          email.trim(),
          password
        )
        const name = displayName?.trim()
        if (name) {
          await updateProfile(cred.user, { displayName: name })
        }
      } catch (err: unknown) {
        setAuthError(authErrorFromUnknown(err))
        throw err
      }
    },
    []
  )

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
      signInWithEmail,
      signUpWithEmail,
      signOut,
      authError,
      clearAuthError: () => setAuthError(null),
    }),
    [user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut, authError]
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
