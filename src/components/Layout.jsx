import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';

export default function Layout() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="lg:ml-64 px-4 sm:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}