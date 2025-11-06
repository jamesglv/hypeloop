import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '@hype-loop/shared'

export default function ProfileSetup() {
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const { user, checkProfileComplete } = useAuth()
  const navigate = useNavigate()

  // Load existing profile data if available
  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.id) {
        setLoadingProfile(false)
        return
      }

      try {
        // Wait for profile to be created by trigger (with retries)
        let retries = 5
        let profileData = null
        
        while (retries > 0 && !profileData) {
          const { data, error: fetchError } = await supabase
            .from('fans')
            .select('display_name, username')
            .eq('id', user.id)
            .maybeSingle()

          if (fetchError && fetchError.code !== 'PGRST116') {
            console.error('Error loading profile:', fetchError)
            break
          } else if (data) {
            profileData = data
            break
          } else {
            // Profile doesn't exist yet, wait for trigger
            await new Promise(resolve => setTimeout(resolve, 500))
            retries--
          }
        }

        if (profileData) {
          // Pre-populate form with existing data (only if not default values)
          if (profileData.display_name && profileData.display_name.trim()) {
            setDisplayName(profileData.display_name)
          }
          if (profileData.username && profileData.username.trim() && !profileData.username.startsWith('user_')) {
            setUsername(profileData.username)
          }
        } else {
          console.warn('Profile not found after retries. Trigger may not have run yet.')
        }
      } catch (err) {
        console.error('Error loading profile:', err)
      } finally {
        setLoadingProfile(false)
      }
    }

    loadProfile()
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!displayName.trim() || !username.trim()) {
      setError('Display name and username are required')
      setLoading(false)
      return
    }

    try {
      if (!user?.id) {
        setError('User not authenticated')
        setLoading(false)
        return
      }

      // Profile should already exist due to database trigger
      // If it doesn't exist, wait a moment and retry (trigger might be delayed)
      let retries = 5
      let profileExists = false
      
      while (retries > 0 && !profileExists) {
        const { data, error: checkError } = await supabase
          .from('fans')
          .select('id')
          .eq('id', user.id)
          .maybeSingle()

        if (checkError && checkError.code !== 'PGRST116') {
          throw checkError
        }

        if (data) {
          profileExists = true
        } else {
          // Wait a bit for the trigger to create the profile
          await new Promise(resolve => setTimeout(resolve, 500))
          retries--
        }
      }

      // If profile still doesn't exist after retries, create it as a fallback
      // This handles cases where the trigger might have failed
      if (!profileExists) {
        console.warn('Profile not found after retries, creating as fallback')
        const { error: insertError } = await supabase
          .from('fans')
          .insert({
            id: user.id,
            display_name: displayName,
            username: username,
          })

        if (insertError) {
          // If insert fails, it might be because the profile was just created
          // Try to update instead
          if (insertError.code === '23505' || insertError.code === '409') {
            // Profile exists now, try to update
            const { error: updateError } = await supabase
              .from('fans')
              .update({
                display_name: displayName,
                username: username,
              })
              .eq('id', user.id)

            if (updateError) {
              if (updateError.code === '23505') {
                throw new Error('This username is already taken. Please choose another.')
              }
              throw updateError
            }
          } else {
            throw insertError
          }
        }
      } else {
        // Update existing profile
        const { error: updateError } = await supabase
          .from('fans')
          .update({
            display_name: displayName,
            username: username,
          })
          .eq('id', user.id)

        if (updateError) {
          // Handle specific error codes
          if (updateError.code === '23505') {
            // Unique constraint violation (username already taken)
            throw new Error('This username is already taken. Please choose another.')
          } else if (updateError.code === '409' || updateError.message?.includes('Conflict')) {
            // Conflict error - profile might already exist with different data
            // Try to update again or show a helpful message
            throw new Error('Profile update conflict. Please refresh the page and try again.')
          }
          throw updateError
        }
      }

      // Refresh profile completion status
      await checkProfileComplete()
      
      // Redirect to dashboard after profile is complete
      navigate('/dashboard')
    } catch (err: any) {
      if (err.code === '23505' || err.message?.includes('already taken')) {
        // Unique constraint violation (username already taken)
        setError('This username is already taken. Please choose another.')
      } else if (err.code === '409' || err.message?.includes('Conflict')) {
        setError('There was a conflict updating your profile. Please refresh the page and try again.')
      } else {
        setError(err.message || 'Failed to save profile. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (loadingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-100 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="text-gray-600">Loading profile...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-100 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Complete Your Profile</h1>
          <p className="text-gray-600">Tell us a bit about yourself</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-2">
              Display Name *
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Your name"
            />
          </div>

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
              Username *
            </label>
            <div className="flex">
              <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                @
              </span>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                required
                className="flex-1 px-4 py-3 border border-gray-300 rounded-r-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="username"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">Only letters, numbers, and underscores</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Saving...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}

