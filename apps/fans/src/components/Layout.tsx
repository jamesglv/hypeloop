import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: ReactNode;
  currentPage: 'home' | 'subscriptions' | 'profile' | 'messages';
  onNavigate: (page: 'home' | 'subscriptions' | 'profile' | 'messages') => void;
}

export function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar currentPage={currentPage} onNavigate={onNavigate} />
      <div className="flex-1 ml-[200px] overflow-auto h-screen">
        {children}
      </div>
    </div>
  );
}

