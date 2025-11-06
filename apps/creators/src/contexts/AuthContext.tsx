import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@hype-loop/shared'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  profileComplete: boolean | null
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  checkProfileComplete: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null)

  const checkProfileComplete = useCallback(async () => {
    if (!user?.id) {
      setProfileComplete(null)
      return
    }

    try {
      const { data, error } = await supabase
        .from('creators')
        .select('display_name, username')
        .eq('id', user.id)
        .single()

      if (error || !data) {
        setProfileComplete(false)
        return
      }

      // Profile is complete if display_name is non-empty and not just whitespace
      // and username is set (not default pattern)
      const isComplete = 
        data.display_name?.trim().length > 0 &&
        data.username?.trim().length > 0 &&
        !data.username.startsWith('user_') // Default username pattern from trigger

      setProfileComplete(isComplete)
    } catch (error) {
      console.error('Error checking profile:', error)
      setProfileComplete(false)
    }
  }, [user])

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (user && !loading) {
      checkProfileComplete()
    } else {
      setProfileComplete(null)
    }
  }, [user, loading, checkProfileComplete])

  const signUp = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      })
      return { error: error ? new Error(error.message) : null }
    } catch (error) {
      return { error: error as Error }
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      return { error: error ? new Error(error.message) : null }
    } catch (error) {
      return { error: error as Error }
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, profileComplete, signUp, signIn, signOut, checkProfileComplete }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

