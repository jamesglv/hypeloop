import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function AuthRedirect() {
  const { user, loading, profileComplete } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  // If user is logged in, check if profile is complete
  if (user) {
    // Wait for profile check to complete
    if (profileComplete === null) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-gray-600">Loading...</div>
        </div>
      )
    }
    // If profile is not complete, redirect to profile setup
    if (profileComplete === false) {
      return <Navigate to="/onboarding/profile" replace />
    }
    // If profile is complete, redirect to dashboard
    return <Navigate to="/dashboard" replace />
  }

  // If not logged in, redirect to sign-up
  return <Navigate to="/sign-up" replace />
}

