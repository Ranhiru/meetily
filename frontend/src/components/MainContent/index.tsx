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
      className="flex-1 transition-[margin] duration-300"
      style={{ marginLeft: sidebarOffset }}
    >
      <div className="pl-8">
        {children}
      </div>
    </main>
  );
};

export default MainContent;
