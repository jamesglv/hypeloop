import { useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AuthRedirect } from './components/AuthRedirect'
import { Layout } from './components/Layout'
import { Home } from './components/Home'
import { ChatInterface } from './components/ChatInterface'
import { SubscriptionModal } from './components/SubscriptionModal'
import type { Creator } from './components/Home'
import SignUp from './pages/SignUp'
import SignIn from './pages/SignIn'
import VerifyEmail from './pages/VerifyEmail'
import ProfileSetup from './pages/ProfileSetup'

function DashboardContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [currentPage, setCurrentPage] = useState<'home' | 'subscriptions' | 'profile' | 'messages'>(() => {
    // Determine initial page based on route
    if (location.pathname.includes('/messages')) return 'messages';
    if (location.pathname.includes('/subscriptions')) return 'subscriptions';
    if (location.pathname.includes('/profile')) return 'profile';
    return 'home';
  });
  const [selectedCreator, setSelectedCreator] = useState<Creator | null>(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  const handleChatClick = async (creator: Creator) => {
    setSelectedCreator(creator);
    // Check if user is subscribed
    if (!user) return;

    const { supabase } = await import('@hype-loop/shared');
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('fan_id', user.id)
      .eq('creator_id', creator.id)
      .eq('status', 'active')
      .maybeSingle();

    if (subscription) {
      // Already subscribed, go directly to chat
      setCurrentPage('messages');
      navigate('/dashboard/messages');
    } else {
      // Not subscribed, show subscription modal
      setShowSubscriptionModal(true);
    }
  };

  const handleSubscribe = () => {
    setShowSubscriptionModal(false);
    setCurrentPage('messages');
    navigate('/dashboard/messages');
  };

  const handleNavigate = (page: 'home' | 'subscriptions' | 'profile' | 'messages') => {
    setCurrentPage(page);
    setSelectedCreator(null); // Clear selected creator when navigating away from messages
    
    // Update URL based on page
    if (page === 'messages') {
      navigate('/dashboard/messages');
    } else if (page === 'subscriptions') {
      navigate('/dashboard/subscriptions');
    } else if (page === 'profile') {
      navigate('/dashboard/profile');
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <Layout currentPage={currentPage} onNavigate={handleNavigate}>
      {(currentPage === 'home' || currentPage === 'subscriptions' || currentPage === 'profile') && (
        <Home 
          onChatClick={handleChatClick}
          currentNav={currentPage === 'home' ? 'home' : currentPage === 'subscriptions' ? 'subscriptions' : 'profile'}
        />
      )}
      
      {currentPage === 'messages' && (
        <ChatInterface 
          selectedCreator={selectedCreator}
          onSelectCreator={setSelectedCreator}
        />
      )}

      {showSubscriptionModal && selectedCreator && (
        <SubscriptionModal
          creator={selectedCreator}
          onClose={() => setShowSubscriptionModal(false)}
          onSubscribe={handleSubscribe}
        />
      )}
    </Layout>
  );
}

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
            path="/dashboard"
            element={
              <ProtectedRoute requireProfileComplete={true}>
                <DashboardContent />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/dashboard/subscriptions"
            element={
              <ProtectedRoute requireProfileComplete={true}>
                <DashboardContent />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/dashboard/messages"
            element={
              <ProtectedRoute requireProfileComplete={true}>
                <DashboardContent />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/dashboard/profile"
            element={
              <ProtectedRoute requireProfileComplete={true}>
                <DashboardContent />
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

