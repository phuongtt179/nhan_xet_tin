'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { User, TeacherAssignment, Subject } from '@/lib/types';

interface AuthContextType {
  user: User | null;
  assignments: TeacherAssignment[];
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isAdmin: boolean;
  getAssignedClassIds: (subjectId?: string) => string[];
  getAssignedSubjects: () => Subject[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      const data = await res.json();
      setUser(data.user ?? null);
      setAssignments(data.assignments ?? []);
    } catch (error) {
      console.error('Error loading session:', error);
      setUser(null);
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Phiên đăng nhập được xác thực bởi server qua cookie httpOnly (không
    // còn tin dữ liệu người dùng lưu trong localStorage).
    loadMe();
  }, [loadMe]);

  async function login(email: string, password: string) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || 'Đăng nhập thất bại' };
      }

      await loadMe();
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Có lỗi xảy ra khi đăng nhập' };
    }
  }

  async function logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      setAssignments([]);
    }
  }

  function getAssignedClassIds(subjectId?: string): string[] {
    if (!user) return [];
    if (user.role === 'admin') return []; // Admin có quyền tất cả

    let filtered = assignments;
    if (subjectId) {
      filtered = assignments.filter((a) => a.subject_id === subjectId);
    }
    return [...new Set(filtered.map((a) => a.class_id))];
  }

  function getAssignedSubjects(): Subject[] {
    if (!user) return [];
    if (user.role === 'admin') return []; // Admin có quyền tất cả

    const subjectsMap = new Map<string, Subject>();
    assignments.forEach((a) => {
      if (a.subjects && !subjectsMap.has(a.subject_id)) {
        subjectsMap.set(a.subject_id, a.subjects);
      }
    });
    return Array.from(subjectsMap.values());
  }

  const value: AuthContextType = {
    user,
    assignments,
    loading,
    login,
    logout,
    isAdmin: user?.role === 'admin',
    getAssignedClassIds,
    getAssignedSubjects,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
