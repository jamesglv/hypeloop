import { LayoutDashboard, Brain, Users, DollarSign, Settings, LogOut, MessageSquare } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { id: 'messages', label: 'Messages', icon: MessageSquare, path: '/messages' },
    { id: 'train', label: 'Train Your Brain', icon: Brain, path: '/train' },
    { id: 'subscribers', label: 'Subscribers', icon: Users, path: '/subscribers' },
    { id: 'earnings', label: 'Earnings', icon: DollarSign, path: '/earnings' },
    { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
  ];

  const handleLogout = async () => {
    await signOut();
    navigate('/sign-in');
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-6">
        <img src="/chatpasslogo.png" alt="Chat Pass" className="h-8 w-auto" />
      </div>
      
      <nav className="flex-1 px-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl mb-1 transition-all ${
                isActive
                  ? 'bg-[#7A5FFF] text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-gray-200">
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 hover:bg-gray-100 transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}

