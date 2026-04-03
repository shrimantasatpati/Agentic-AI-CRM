import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, PieChart, Briefcase, BrainCircuit } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

function Sidebar() {
  const location = useLocation();

  const links = [
    { name: 'Dashboard', to: '/', icon: <LayoutDashboard size={20} /> },
    { name: 'Leads', to: '/leads', icon: <Users size={20} /> },
    { name: 'Deals', to: '/deals', icon: <Briefcase size={20} /> },
    { name: 'Analytics', to: '/analytics', icon: <PieChart size={20} /> },
    { name: 'AI Agents', to: '/agents', icon: <BrainCircuit size={20} /> },
  ];

  return (
    <div className="w-64 flex flex-col bg-slate-900 text-white min-h-screen border-r border-slate-800 shadow-xl relative z-10">
      <div className="h-16 flex items-center px-6 border-b border-white/10">
        <BrainCircuit className="text-blue-400 mr-3" size={24} />
        <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">Antigravity CRM</span>
      </div>
      
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-2">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 px-2">Main Menu</div>
        {links.map((link) => {
          const isActive = location.pathname === link.to;
          return (
            <Link
              key={link.to}
              to={link.to}
              className={cn(
                "flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 group text-sm font-medium",
                isActive 
                  ? "bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-[0_0_15px_rgba(37,99,235,0.15)]" 
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
            >
              <div className={cn("mr-3 transition-colors", isActive ? "text-blue-400" : "text-slate-500 group-hover:text-slate-300")}>
                {link.icon}
              </div>
              {link.name}
              
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              )}
            </Link>
          );
        })}
      </div>
      
      <div className="p-4 border-t border-white/10">
        <div className="bg-slate-800/50 p-4 rounded-xl border border-white/5 backdrop-blur-md">
          <p className="text-xs text-slate-400 font-medium h mb-2">SYSTEM STATUS</p>
          <div className="flex items-center text-sm">
             <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping mr-2"></div>
             <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 absolute mr-2"></div>
             <span className="text-emerald-400 pl-4">All Systems Normal</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-slate-50 font-sans selection:bg-blue-500/30">
        <Sidebar />
        
        {/* Main Content Area */}
        <main className="flex-1 flex flex-col relative overflow-hidden">
          {/* Subtle background glow effect */}
          <div className="absolute top-0 right-0 -mr-48 -mt-48 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute bottom-0 left-1/2 w-full h-96 bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />
          
          <div className="flex-1 overflow-y-auto w-full max-w-7xl mx-auto z-10 px-8 py-8">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/leads" element={<Leads />} />
              <Route path="/deals" element={<div className="text-2xl font-semibold">Deals Module (Coming Soon)</div>} />
              <Route path="/analytics" element={<div className="text-2xl font-semibold">Analytics (Coming Soon)</div>} />
              <Route path="/agents" element={<div className="text-2xl font-semibold">AI Agents Configuration (Coming Soon)</div>} />
            </Routes>
          </div>
        </main>
      </div>
    </BrowserRouter>
  );
}
