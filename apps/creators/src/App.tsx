import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AuthRedirect } from './components/AuthRedirect'
import { Layout } from './components/Layout'
import SignUp from './pages/SignUp'
import SignIn from './pages/SignIn'
import VerifyEmail from './pages/VerifyEmail'
import ProfileSetup from './pages/ProfileSetup'
import Welcome from './pages/Welcome'
import Dashboard from './pages/Dashboard'
import TrainBrain from './pages/TrainBrain'
import Subscribers from './pages/Subscribers'
import Earnings from './pages/Earnings'
import Settings from './pages/Settings'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/sign-up" element={<SignUp />} />
          <Route path="/sign-in" element={<SignIn />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          
          <Route
            path="/onboarding/profile"
            element={
              <ProtectedRoute>
                <ProfileSetup />
              </ProtectedRoute>
            }
          />
          <Route
            path="/onboarding/welcome"
            element={
              <ProtectedRoute>
                <Welcome />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute requireProfileComplete={true}>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/train"
            element={
              <ProtectedRoute requireProfileComplete={true}>
                <Layout>
                  <TrainBrain />
                </Layout>
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/subscribers"
            element={
              <ProtectedRoute requireProfileComplete={true}>
                <Layout>
                  <Subscribers />
                </Layout>
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/earnings"
            element={
              <ProtectedRoute requireProfileComplete={true}>
                <Layout>
                  <Earnings />
                </Layout>
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/settings"
            element={
              <ProtectedRoute requireProfileComplete={true}>
                <Layout>
                  <Settings />
                </Layout>
              </ProtectedRoute>
            }
          />
          
          <Route path="/" element={<AuthRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
