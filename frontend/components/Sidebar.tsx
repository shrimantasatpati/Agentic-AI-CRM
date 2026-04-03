'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  Target, 
  Briefcase, 
  Settings,
  MessageSquare,
  BarChart3
} from 'lucide-react';

const MENU_ITEMS = [
  { name: 'Dashboard', icon: LayoutDashboard, href: '/' },
  { name: 'Leads', icon: Target, href: '/leads' },
  { name: 'Deals', icon: Briefcase, href: '/deals' },
  { name: 'Customers', icon: Users, href: '/customers' },
  { name: 'Analytics', icon: BarChart3, href: '/analytics' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky left-0 top-0 h-screen w-64 border-r border-[var(--border-medium)] bg-[var(--bg-sidebar)] backdrop-blur-xl z-50 overflow-y-auto min-w-[256px]">
      <div className="flex items-center gap-3 p-8">
        <div className="w-8 h-8 rounded-lg bg-[var(--gradient-brand)] flex items-center justify-center text-white">
          <Target size={18} strokeWidth={2.5} />
        </div>
        <h1 className="text-xl font-black tracking-tighter text-[var(--text-primary)]">AI CRM</h1>
      </div>

      <nav className="px-4 space-y-1">
        {MENU_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group
                ${isActive 
                  ? 'bg-[var(--bg-glass-hover)] text-[var(--text-primary)] shadow-sm' 
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-glass)] hover:text-[var(--text-primary)]'
                }
              `}
            >
              <Icon 
                size={20} 
                className={`transition-colors ${isActive ? 'text-[var(--accent-primary)]' : 'group-hover:text-[var(--text-primary)]'}`} 
              />
              <span className="text-sm font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="absolute bottom-24 px-6 w-full space-y-4">
        <div className="p-4 rounded-2xl bg-[var(--bg-glass)] border border-[var(--border-subtle)]">
          <div className="flex items-center justify-between mb-3">
             <span className="text-[10px] font-bold text-[var(--accent-primary)] uppercase tracking-widest">Live Activity</span>
             <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping"></div>
          </div>
          <div className="space-y-2">
             <div className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-[var(--text-muted)]"></div>
                <span className="text-[10px] text-[var(--text-secondary)]">Lead Qualified (CEO)</span>
             </div>
             <div className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-[var(--text-muted)]"></div>
                <span className="text-[10px] text-[var(--text-secondary)]">Sentiment: Negotiating</span>
             </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 px-4 w-full">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-glass)] transition-all"
        >
          <Settings size={20} />
          <span className="text-sm font-medium">Settings</span>
        </Link>
      </div>
    </aside>
  );
}
