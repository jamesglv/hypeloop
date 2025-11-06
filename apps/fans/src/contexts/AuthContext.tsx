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
  signIn: (email: string, password: string) => Promise<{ error: Error | null; session?: Session | null }>
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
        .from('fans')
        .select('display_name, username')
        .eq('id', user.id)
        .maybeSingle()

      if (error) {
        // If error is not "no rows returned", it's a real error
        if (error.code !== 'PGRST116') {
          console.error('Error checking profile:', error)
        }
        setProfileComplete(false)
        return
      }

      if (!data) {
        setProfileComplete(false)
        return
      }

      // Profile is complete if display_name is non-empty and not just whitespace
      // and username is set (not default pattern)
      const isComplete = 
        data.display_name?.trim().length > 0 &&
        data.username?.trim().length > 0 &&
        !data.username.startsWith('user_') // Default username pattern

      setProfileComplete(isComplete)
    } catch (error) {
      console.error('Error checking profile:', error)
      setProfileComplete(false)
    }
  }, [user])

  useEffect(() => {
    let isMounted = true
    
    // Safety timeout to ensure loading is always set to false
    const timeoutId = setTimeout(() => {
      if (isMounted) {
        console.warn('Session check timed out, setting loading to false')
        setLoading(false)
      }
    }, 5000) // 5 second timeout
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!isMounted) return
      
      clearTimeout(timeoutId)
      
      if (error) {
        console.error('Error getting session:', error)
      }
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
      
      // Fan profile should be created automatically by database trigger
      // We just need to check if it exists, but don't create it manually
      // The trigger handles creation with proper timing to avoid foreign key issues
    }).catch((error) => {
      if (!isMounted) return
      clearTimeout(timeoutId)
      console.error('Error in getSession:', error)
      setLoading(false)
    })
    
    return () => {
      isMounted = false
      clearTimeout(timeoutId)
    }

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return
      
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
      
      // Fan profile should be created automatically by database trigger
      // We just need to check if it exists, but don't create it manually
      // The trigger handles creation with proper timing to avoid foreign key issues
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (user && !loading) {
      checkProfileComplete()
    } else if (!user && !loading) {
      // When there's no user and loading is complete, reset profileComplete
      setProfileComplete(null)
    }
  }, [user, loading, checkProfileComplete])

  const signUp = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      })
      
      if (error) {
        return { error: new Error(error.message) }
      }
      
      // Fan profile will be created automatically by database trigger
      // No need to manually create it here, which avoids foreign key constraint issues
      
      return { error: null }
    } catch (error) {
      return { error: error as Error }
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) {
        return { error: new Error(error.message) }
      }
      // Return session data so caller can verify auth completed
      return { error: null, session: data.session }
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

