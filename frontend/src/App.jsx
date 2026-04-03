import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, PieChart, Briefcase, BrainCircuit, Settings } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import Deals from './pages/Deals';
import Analytics from './pages/Analytics';
import Agents from './pages/Agents';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

function Sidebar() {
  const location = useLocation();

  const links = [
    { name: 'Dashboard', to: '/', icon: <LayoutDashboard size={18} /> },
    { name: 'Leads', to: '/leads', icon: <Users size={18} /> },
    { name: 'Deals', to: '/deals', icon: <Briefcase size={18} /> },
    { name: 'Analytics', to: '/analytics', icon: <PieChart size={18} /> },
    { name: 'AI Agents', to: '/agents', icon: <BrainCircuit size={18} /> },
    { name: 'Settings', to: '/settings', icon: <Settings size={18} /> },
  ];

  return (
    <aside className="w-72 xl:w-64 flex flex-col h-screen bg-slate-900 text-slate-100 border-r border-slate-800">
      <div className="h-20 flex items-center px-6 border-b border-white/10">
        <BrainCircuit className="text-blue-400 mr-2" size={24} />
        <span className="text-xl font-bold tracking-tight">AI CRM</span>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <p className="px-6 text-xs uppercase tracking-wider text-slate-500 mb-3">Main Menu</p>
        <nav className="space-y-1">
          {links.map((link) => {
            const active = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  'flex items-center gap-3 px-5 py-2 rounded-lg transition-all duration-200 text-sm font-medium',
                  active
                    ? 'bg-blue-700 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                )}
              >
                {link.icon}
                {link.name}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="px-5 py-4 border-t border-white/10">
        <div className="text-xs text-slate-400">Server</div>
        <div className="text-sm font-semibold text-emerald-300">Connected</div>
      </div>
    </aside>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 bg-slate-100 overflow-y-auto">
          <div className="max-w-[1480px] mx-auto p-6 sm:p-8">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/leads" element={<Leads />} />
              <Route path="/deals" element={<Deals />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/agents" element={<Agents />} />
              <Route path="/settings" element={<div className="p-8 rounded-xl bg-white shadow-sm">Settings coming soon</div>} />
            </Routes>
          </div>
        </main>
      </div>
    </BrowserRouter>
  );
}

