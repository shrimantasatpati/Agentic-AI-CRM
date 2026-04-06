'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Target, Mail, BarChart2, Heart,
  Calendar, Database, Settings, Menu, X, Moon, Sun,
  ChevronDown, Cpu, Check, Cloud, Zap
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  color: string;
}

const navItems: NavItem[] = [
  { label: 'Mission Control',    href: '/',          icon: <LayoutDashboard size={17} />, color: '#0066cc' },
  { label: 'Lead Qualification', href: '/leads',     icon: <Target size={17} />,          color: '#0066cc' },
  { label: 'Email Intelligence', href: '/email',     icon: <Mail size={17} />,            color: '#5e5ce6' },
  { label: 'Sales Pipeline',     href: '/pipeline',  icon: <BarChart2 size={17} />,       color: '#34c759' },
  { label: 'Customer Success',   href: '/customers', icon: <Heart size={17} />,           color: '#ff9500' },
  { label: 'Meeting Scheduler',  href: '/meetings',  icon: <Calendar size={17} />,        color: '#bf5af2' },
  { label: 'Analytics',          href: '/analytics', icon: <BarChart2 size={17} />,       color: '#30b0c7' },
  { label: 'Query Database',     href: '/query',     icon: <Database size={17} />,        color: '#ff3b30' },
  { label: 'Source Systems',     href: '/sources',   icon: <Cloud size={17} />,           color: '#5e5ce6' },
  { label: 'Workflows',          href: '/workflows', icon: <Settings size={17} />,        color: '#ff9500' },
];

const MODEL_OPTIONS = [
  { label: 'Gemini 2.5 Flash',  value: 'gemini-2.5-flash', provider: 'gemini' },
  { label: 'Llama 3.1 8B',       value: 'llama-3.1-8b-instant',               provider: 'groq'   },
];

const PROVIDER_COLORS: Record<string, string> = {
  gemini: '#4285F4',
  groq:   '#F55036',
  xai:    '#0066cc',
  mock:   '#8e8e93',
};

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen]          = useState(false);
  const [dark, setDark]          = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [activeModel, setActiveModel] = useState(MODEL_OPTIONS[0]);
  const [serverModel, setServerModel] = useState<{ provider: string; model: string } | null>(null);
  const [switching, setSwitching] = useState(false);

  // Persist theme
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') { setDark(true); document.documentElement.className = 'dark'; }
  }, []);

  // Fetch current model from backend on mount
  useEffect(() => {
    fetch('http://localhost:8000/api/config/model')
      .then((r) => r.json())
      .then((data) => {
        setServerModel(data);
        // Try to match to a known option
        const match = MODEL_OPTIONS.find((m) => data.model && data.model.includes(m.value.split('-')[0]));
        if (match) setActiveModel(match);
      })
      .catch(() => {}); // backend may not be running
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.className = next ? 'dark' : '';
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  const handleModelSwitch = useCallback(async (opt: typeof MODEL_OPTIONS[0]) => {
    setSwitching(true);
    setModelOpen(false);
    try {
      const res = await fetch('http://localhost:8000/api/config/model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: opt.value }),
      });
      const data = await res.json();
      setServerModel(data);
      setActiveModel(opt);
      localStorage.setItem('crm_model', opt.value);
    } catch {
      // Backend offline — store preference locally for when it starts
      setActiveModel(opt);
      localStorage.setItem('crm_model', opt.value);
    }
    setSwitching(false);
  }, []);

  const providerColor = serverModel
    ? PROVIDER_COLORS[serverModel.provider] || '#8e8e93'
    : PROVIDER_COLORS[activeModel.provider];

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="fixed top-5 left-5 z-[200] md:hidden p-2 rounded-lg btn-secondary"
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
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #0066cc 0%, #5e5ce6 100%)', boxShadow: '0 4px 12px rgba(0,102,204,0.3)' }}
              >
                <Cpu size={20} color="#fff" />
              </div>
              <div className="flex flex-col leading-tight">
                <span style={{ color: 'var(--text-primary)', fontWeight: 900, fontSize: 18, letterSpacing: '-0.5px' }}>
                  AI CRM
                </span>
                <span style={{ color: 'var(--text-tertiary)', fontSize: 11, fontWeight: 600, marginTop: 1 }}>
                  Agentic Intelligence
                </span>
              </div>
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

          {/* ---- MODEL SWITCHER ---- */}
          <div className="relative">
            <button
              onClick={() => setModelOpen(!modelOpen)}
              className="sidebar-nav-item w-full text-left justify-between"
              disabled={switching}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Cpu size={15} style={{ color: providerColor, flexShrink: 0 }} />
                <span className="truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {switching ? 'Switching...' : activeModel.label}
                </span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ background: providerColor }}
                />
                <ChevronDown size={12} style={{ color: 'var(--text-tertiary)', transform: modelOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </div>
            </button>

            {modelOpen && (
              <div
                className="absolute bottom-full left-0 right-0 mb-1 rounded-xl overflow-hidden animate-fade-in-up"
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-primary)',
                  boxShadow: 'var(--shadow-lg)',
                  zIndex: 200,
                }}
              >
                <div className="px-3 pt-2 pb-1">
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>
                    Select LLM Model
                  </p>
                </div>
                {MODEL_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleModelSwitch(opt)}
                    className="flex items-center gap-2 w-full text-left px-3 py-2.5 transition-colors"
                    style={{
                      background: activeModel.value === opt.value ? 'var(--bg-input)' : 'transparent',
                      color: 'var(--text-primary)',
                      borderBottom: '1px solid var(--border-secondary)',
                    }}
                  >
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ background: PROVIDER_COLORS[opt.provider] }}
                    >
                      {opt.provider[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{opt.label}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)', fontFamily: 'monospace', fontSize: 10 }}>{opt.value}</p>
                    </div>
                    {activeModel.value === opt.value && (
                      <Check size={13} style={{ color: PROVIDER_COLORS[opt.provider], flexShrink: 0 }} />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Theme toggle */}
          <button onClick={toggleTheme} className="sidebar-nav-item w-full text-left">
            <span style={{ color: 'var(--text-tertiary)' }}>
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </span>
            {dark ? 'Light Mode' : 'Dark Mode'}
          </button>

          {/* System status */}
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="status-dot status-dot-active" />
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>System Operational</span>
          </div>
        </div>
      </nav>
    </>
  );
}
