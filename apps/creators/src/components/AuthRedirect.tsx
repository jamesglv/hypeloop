import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function AuthRedirect() {
  const { user, loading, profileComplete } = useAuth()

  if (loading || profileComplete === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  // If user is logged in, check if profile is complete
  if (user) {
    // If profile is not complete, redirect to profile setup
    if (profileComplete === false) {
      return <Navigate to="/onboarding/profile" replace />
    }
    // If profile is complete, redirect to dashboard
    return <Navigate to="/dashboard" replace />
  }

  // If not logged in, redirect to sign-in
  return <Navigate to="/sign-in" replace />
}

