import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import AuthModal from '../common/AuthModal';

export const AppLayout = ({ activeTab, onSelectTab, children }) => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-text-primary flex">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={onSelectTab}
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        <Header
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onNavigateTab={onSelectTab}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Authentication Modal */}
      <AuthModal />
    </div>
  );
};

export default AppLayout;
