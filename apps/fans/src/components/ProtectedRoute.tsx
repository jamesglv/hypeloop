import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface ProtectedRouteProps {
  children: ReactNode
  requireProfileComplete?: boolean
}

export function ProtectedRoute({ children, requireProfileComplete = false }: ProtectedRouteProps) {
  const { user, loading, profileComplete } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/sign-in" replace />
  }

  // Only check profile completion if it's required for this route
  if (requireProfileComplete) {
    // Wait for profile check to complete
    if (profileComplete === null) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-gray-600">Loading...</div>
        </div>
      )
    }
    
    // If profile completion is required but profile is not complete, redirect to profile setup
    if (profileComplete === false) {
      return <Navigate to="/onboarding/profile" replace />
    }
  }

  return <>{children}</>
}

