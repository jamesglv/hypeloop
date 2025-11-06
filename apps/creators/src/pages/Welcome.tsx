import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '@hype-loop/shared'

interface Profile {
  display_name: string
}

export default function Welcome() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return

      const { data } = await supabase
        .from('creators')
        .select('display_name')
        .eq('id', user.id)
        .single()

      if (data) {
        setProfile(data)
      }
    }

    fetchProfile()
  }, [user])

  const handleGetStarted = () => {
    // Navigate to main app dashboard
    navigate('/dashboard')
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/sign-in')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="mb-8">
          <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
            <svg
              className="w-10 h-10 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Welcome to Hype Loop!</h1>
          <p className="text-xl text-gray-600 mb-2">
            {profile?.display_name ? `Hi ${profile.display_name}!` : `Hi ${user?.email}!`}
          </p>
          <p className="text-gray-500">
            You're all set up and ready to start building your fanbase.
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8 text-left">
          <h2 className="font-semibold text-gray-900 mb-3">What's next?</h2>
          <ul className="space-y-2 text-gray-700">
            <li className="flex items-start">
              <span className="text-blue-600 mr-2">✓</span>
              <span>Create and share your first post</span>
            </li>
            <li className="flex items-start">
              <span className="text-blue-600 mr-2">✓</span>
              <span>Connect with your fans</span>
            </li>
            <li className="flex items-start">
              <span className="text-blue-600 mr-2">✓</span>
              <span>Start earning from your content</span>
            </li>
          </ul>
        </div>

        <div className="flex gap-4">
          <button
            onClick={handleGetStarted}
            className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Get Started
          </button>
          <button
            onClick={handleSignOut}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}

