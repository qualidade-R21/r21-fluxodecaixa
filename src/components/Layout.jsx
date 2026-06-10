import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Building2, Users, Settings, TrendingUp } from 'lucide-react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/aportes-ricardo', label: 'Aportes Ricardo', icon: TrendingUp },
  { path: '/configuracoes', label: 'Configurações', icon: Settings },
];

export default function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm font-heading">R21</span>
              </div>
              <span className="font-heading font-bold text-foreground text-lg hidden sm:block">Fluxo de Caixa</span>
            </Link>
            <nav className="flex items-center gap-1">
              {navItems.map(item => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path || 
                  (item.path !== '/' && location.pathname.startsWith(item.path));
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>
      
      {/* Content */}
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}