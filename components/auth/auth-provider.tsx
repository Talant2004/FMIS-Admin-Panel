"use client"

import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
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
import { mapAuthError } from "@/lib/auth/errors"
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

function authErrorFromUnknown(err: unknown): string {
  const code =
    err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : ""
  return mapAuthError(code)
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
      setAuthError(authErrorFromUnknown(err))
      throw err
    }
  }, [])

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    setAuthError(null)
    try {
      await signInWithEmailAndPassword(getAuthClient(), email.trim(), password)
    } catch (err: unknown) {
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
