'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Target, Mail, BarChart2, Heart,
  Calendar, Database, Settings, Menu, X, Moon, Sun
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  color: string;
}

const navItems: NavItem[] = [
  { label: 'Mission Control', href: '/',           icon: <LayoutDashboard size={17} />, color: '#0066cc' },
  { label: 'Lead Qualification', href: '/leads',      icon: <Target size={17} />,          color: '#0066cc' },
  { label: 'Email Intelligence', href: '/email',      icon: <Mail size={17} />,            color: '#5e5ce6' },
  { label: 'Sales Pipeline',     href: '/pipeline',   icon: <BarChart2 size={17} />,       color: '#34c759' },
  { label: 'Customer Success',   href: '/customers',  icon: <Heart size={17} />,           color: '#ff9500' },
  { label: 'Meeting Scheduler',  href: '/meetings',   icon: <Calendar size={17} />,        color: '#bf5af2' },
  { label: 'Analytics',          href: '/analytics',  icon: <BarChart2 size={17} />,       color: '#30b0c7' },
  { label: 'Query Database',     href: '/query',      icon: <Database size={17} />,        color: '#ff3b30' },
  { label: 'Workflows',          href: '/workflows',  icon: <Settings size={17} />,        color: '#ff9500' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') { setDark(true); document.documentElement.className = 'dark'; }
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.className = next ? 'dark' : '';
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="fixed top-4 left-4 z-[200] md:hidden p-2 rounded-lg btn-secondary"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {/* Overlay */}
      {open && (
        <div className="sidebar-overlay md:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Sidebar */}
      <nav className={`sidebar ${open ? 'open' : ''}`}>
        {/* Header */}
        <div className="p-4 border-b" style={{ borderColor: 'var(--border-primary)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                style={{ background: 'linear-gradient(135deg, #0066cc, #5e5ce6)' }}>
                AI
              </div>
              <span className="text-sm font-700" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                AI CRM
              </span>
            </div>
            <button className="btn-ghost p-1 md:hidden" onClick={() => setOpen(false)}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Nav items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                style={isActive ? { color: item.color } : {}}
              >
                <span style={{ color: isActive ? item.color : 'var(--text-tertiary)' }}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3 border-t space-y-2" style={{ borderColor: 'var(--border-primary)' }}>
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="sidebar-nav-item w-full text-left"
          >
            <span style={{ color: 'var(--text-tertiary)' }}>
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </span>
            {dark ? 'Light Mode' : 'Dark Mode'}
          </button>
          {/* System status */}
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="status-dot status-dot-active" />
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              System Operational
            </span>
          </div>
        </div>
      </nav>
    </>
  );
}
