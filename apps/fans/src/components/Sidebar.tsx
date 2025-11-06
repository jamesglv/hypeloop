import { Home, CreditCard, User, LogOut, MessageCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

type NavPage = 'home' | 'subscriptions' | 'profile' | 'messages';

interface SidebarProps {
  currentPage: NavPage;
  onNavigate: (page: NavPage) => void;
}

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const navItems = [
    { id: 'home' as const, label: 'Discover', icon: Home },
    { id: 'messages' as const, label: 'Messages', icon: MessageCircle },
    { id: 'subscriptions' as const, label: 'Subscriptions', icon: CreditCard },
    { id: 'profile' as const, label: 'Profile', icon: User },
  ];

  const handleLogout = async () => {
    await signOut();
    navigate('/sign-in');
  };

  const handleNavClick = (page: NavPage) => {
    onNavigate(page);
    // Also update the URL
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
    <div className="w-[200px] bg-card border-r border-border h-screen flex flex-col fixed left-0 top-0 z-20">
      {/* Logo */}
      <div className="px-6 py-6">
        <h3 className="text-[#7C3AED] font-medium">Creator Chat</h3>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          
          return (
            <motion.button
              key={item.id}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleNavClick(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-[10px] mb-1 transition-all ${
                isActive
                  ? 'bg-[#7C3AED] text-white'
                  : 'text-foreground hover:bg-accent'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </motion.button>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 pb-6">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-[10px] text-foreground hover:bg-accent transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </motion.button>
      </div>
    </div>
  );
}

