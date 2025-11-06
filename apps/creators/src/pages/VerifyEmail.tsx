import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '@hype-loop/shared'

export default function VerifyEmail() {
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user?.email_confirmed_at) {
      navigate('/onboarding/profile')
    }
  }, [user, navigate])

  const resendEmail = async () => {
    setLoading(true)
    setMessage('')
    
    if (user?.email) {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
      })

      if (error) {
        setMessage(`Error: ${error.message}`)
      } else {
        setMessage('Verification email sent! Check your inbox.')
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="mb-6">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Check Your Email</h1>
          <p className="text-gray-600">
            We've sent a verification link to <span className="font-semibold">{user?.email}</span>
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            Click the link in the email to verify your account and continue with onboarding.
          </p>
        </div>

        {message && (
          <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${
            message.startsWith('Error') 
              ? 'bg-red-50 border border-red-200 text-red-700'
              : 'bg-green-50 border border-green-200 text-green-700'
          }`}>
            {message}
          </div>
        )}

        <button
          onClick={resendEmail}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mb-4"
        >
          {loading ? 'Sending...' : 'Resend Verification Email'}
        </button>

        <p className="text-sm text-gray-500">
          Already verified?{' '}
          <button
            onClick={() => navigate('/onboarding/profile')}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Continue
          </button>
        </p>
      </div>
    </div>
  )
}

