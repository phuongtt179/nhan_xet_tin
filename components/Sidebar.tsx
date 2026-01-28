'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Home,
  Layers,
  BookOpen,
  Users,
  FileText,
  CheckSquare,
  Star,
  ClipboardList,
  ClipboardCheck,
  BarChart2,
  UserCheck,
  RefreshCw,
  ExternalLink,
  Menu,
  X,
  CalendarCheck,
  Backpack,
  Package,
  LogOut,
  User,
  Settings,
  UserCog,
  BookMarked,
  ClipboardPen
} from 'lucide-react';

// Menu cho tất cả người dùng
const commonNavItems = [
  { href: '/', icon: Home, label: 'Tổng quan' },
  { href: '/attendance', icon: ClipboardList, label: 'Điểm danh' },
  { href: '/equipment-check', icon: Backpack, label: 'Kiểm tra đồ dùng' },
  { href: '/evaluations', icon: ClipboardCheck, label: 'Đánh giá' },
  { href: '/topics', icon: FileText, label: 'Quản lý Chủ đề' },
  { href: '/criteria', icon: CheckSquare, label: 'Quản lý Tiêu chí' },
  { href: '/topic-summary', icon: BarChart2, label: 'Tổng hợp chủ đề' },
  { href: '/student-summary', icon: UserCheck, label: 'Tổng hợp học sinh' },
  { href: '/attendance-summary', icon: CalendarCheck, label: 'Thống kê buổi học' },
  { href: '/equipment-summary', icon: Package, label: 'Thống kê đồ dùng' },
];

// Menu chỉ dành cho Admin
const adminNavItems = [
  { href: '/admin/users', icon: UserCog, label: 'Quản lý giáo viên' },
  { href: '/admin/subjects', icon: BookMarked, label: 'Quản lý môn học' },
  { href: '/admin/assignments', icon: ClipboardPen, label: 'Phân công giảng dạy' },
  { href: '/grades', icon: Layers, label: 'Khối lớp' },
  { href: '/classes', icon: BookOpen, label: 'Lớp học' },
  { href: '/year-transition', icon: RefreshCw, label: 'Chuyển năm học' },
  { href: '/students', icon: Users, label: 'Học sinh' },
  { href: '/evaluation-levels', icon: Star, label: 'Mức đánh giá' },
];

// Mobile bottom navigation - only show 4 items
const mobileNavItems = [
  { href: '/', icon: Home, label: 'Tổng quan' },
  { href: '/attendance', icon: ClipboardList, label: 'Điểm danh' },
  { href: '/evaluations', icon: ClipboardCheck, label: 'Đánh giá' },
  { href: '/equipment-check', icon: Backpack, label: 'Đồ dùng' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout, isAdmin } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user && pathname !== '/login') {
      router.push('/login');
    }
  }, [user, loading, pathname, router]);

  // Don't show sidebar on login page
  if (pathname === '/login') {
    return null;
  }

  // Show loading state
  if (loading) {
    return null;
  }

  // Don't render if not logged in
  if (!user) {
    return null;
  }

  // Combine nav items based on role
  const navItems = isAdmin
    ? [...commonNavItems, ...adminNavItems]
    : commonNavItems;

  function handleLogout() {
    logout();
    router.push('/login');
  }

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 flex items-center justify-between shadow-lg">
        <div>
          <h1 className="text-lg font-bold">{user.full_name}</h1>
          <p className="text-blue-100 text-xs">{isAdmin ? 'Quản trị viên' : 'Giáo viên'}</p>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Desktop Sidebar & Mobile Drawer */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-40
          w-64 bg-gradient-to-b from-blue-600 to-blue-700 text-white flex flex-col
          transform transition-transform duration-300 ease-in-out
          lg:transform-none
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
      >
        <div className="p-6 lg:block hidden">
          <h1 className="text-2xl font-bold">Quản lý Lớp học</h1>
          <p className="text-blue-100 text-sm mt-1">Điểm danh và Nhận xét</p>
        </div>

        <div className="p-6 lg:hidden flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Menu</h1>
            <p className="text-blue-200 text-sm">{user.full_name}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Đăng xuất"
          >
            <LogOut size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
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
          <div className="flex items-center gap-3 px-4 py-2 mb-2">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <User size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.full_name}</p>
              <p className="text-xs text-blue-200">{isAdmin ? 'Admin' : 'Giáo viên'}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 w-full text-blue-100 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <LogOut size={18} />
            <span className="text-sm">Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 shadow-lg">
        <div className="grid grid-cols-4 gap-1">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex flex-col items-center justify-center py-2 px-1
                  transition-colors
                  ${isActive
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:bg-gray-50'
                  }
                `}
              >
                <Icon size={20} />
                <span className="text-xs mt-1 font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
