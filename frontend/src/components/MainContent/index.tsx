'use client';

import React from 'react';
import { useSidebar } from '@/components/Sidebar/SidebarProvider';

interface MainContentProps {
  children: React.ReactNode;
}

const MainContent: React.FC<MainContentProps> = ({ children }) => {
  const { sidebarOffset } = useSidebar();

  return (
    <main
      className="flex-1 min-w-0 overflow-hidden transition-[margin] duration-300"
      style={{ marginLeft: sidebarOffset }}
    >
      <div className="pl-8 min-w-0 w-full max-w-full overflow-hidden">
        {children}
      </div>
    </main>
  );
};

export default MainContent;
