import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Building2, History, FileText, TrendingUp, Settings, Menu, X } from 'lucide-react';

const mainItems = [
  { path: '/', label: 'Empreendimentos', icon: Building2 },
  { path: '/historico', label: 'Histórico', icon: History },
  { path: '/relatorios', label: 'Relatórios', icon: FileText },
];

const footerItems = [
  { path: '/aportes-ricardo', label: 'Aportes Ricardo', icon: TrendingUp },
  { path: '/configuracoes', label: 'Configurações', icon: Settings },
];

export default function Sidebar() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const NavItem = ({ item }) => {
    const active = isActive(item.path);
    const Icon = item.icon;
    return (
      <Link
        to={item.path}
        onClick={() => setMobileOpen(false)}
        className={`flex items-center gap-3 px-5 py-3 text-[15px] font-medium transition-colors border-l-[3px] ${
          active
            ? 'bg-white/10 text-white border-[#AD0000]'
            : 'text-white/70 hover:text-white hover:bg-white/5 border-transparent'
        }`}
      >
        <Icon className="w-5 h-5 shrink-0" />
        <span>{item.label}</span>
      </Link>
    );
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-3 px-5 py-6 border-b border-white/10" onClick={() => setMobileOpen(false)}>
        <div className="w-9 h-9 bg-[#AD0000] rounded flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-base font-heading">R21</span>
        </div>
        <span className="font-heading font-bold text-white text-lg">Fluxo de Caixa</span>
      </Link>

      {/* Main nav */}
      <nav className="flex-1 py-4 space-y-1">
        {mainItems.map(item => (
          <NavItem key={item.path} item={item} />
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 py-4 space-y-1">
        {footerItems.map(item => (
          <NavItem key={item.path} item={item} />
        ))}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 w-10 h-10 bg-black rounded-md flex items-center justify-center text-white shadow-lg"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-40 h-full w-64 bg-black
        transform transition-transform duration-200 ease-in-out
        lg:translate-x-0
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {sidebarContent}
      </aside>
    </>
  );
}