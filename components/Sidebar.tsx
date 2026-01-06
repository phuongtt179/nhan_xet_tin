'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  BookOpen,
  Users,
  ClipboardList,
  DollarSign,
  ExternalLink
} from 'lucide-react';

const navItems = [
  { href: '/', icon: Home, label: 'Tổng quan' },
  { href: '/classes', icon: BookOpen, label: 'Lớp học' },
  { href: '/students', icon: Users, label: 'Học sinh' },
  { href: '/attendance', icon: ClipboardList, label: 'Điểm danh' },
  { href: '/payments', icon: DollarSign, label: 'Học phí' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-gradient-to-b from-blue-600 to-blue-700 text-white flex flex-col">
      <div className="p-6">
        <h1 className="text-2xl font-bold">Quản lý Lớp học</h1>
        <p className="text-blue-100 text-sm mt-1">Điểm danh & Học phí</p>
      </div>

      <nav className="flex-1 px-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-3 px-4 py-3 mb-1 rounded-lg
                transition-all duration-200
                ${isActive
                  ? 'bg-white/20 text-white font-semibold border-l-4 border-white'
                  : 'text-blue-100 hover:bg-white/10 hover:text-white border-l-4 border-transparent'
                }
              `}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-blue-500">
        <a
          href={process.env.NEXT_PUBLIC_SUPABASE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 text-blue-100 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
        >
          <ExternalLink size={18} />
          <span className="text-sm">Mở Supabase</span>
        </a>
      </div>
    </aside>
  );
}
