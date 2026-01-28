'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { User, TeacherAssignment } from '@/lib/types';

interface AuthContextType {
  user: User | null;
  assignments: TeacherAssignment[];
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isAdmin: boolean;
  getAssignedClassIds: (schoolYear?: string) => string[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Kiểm tra session từ localStorage
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      const userData = JSON.parse(savedUser);
      setUser(userData);
      loadAssignments(userData.id);
    }
    setLoading(false);
  }, []);

  async function loadAssignments(userId: string) {
    try {
      const { data, error } = await supabase
        .from('teacher_assignments')
        .select(`
          *,
          classes (*),
          subjects (*)
        `)
        .eq('user_id', userId);

      if (error) throw error;
      setAssignments(data || []);
    } catch (error) {
      console.error('Error loading assignments:', error);
    }
  }

  async function login(email: string, password: string) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('password_hash', password)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        return { success: false, error: 'Email hoặc mật khẩu không đúng' };
      }

      setUser(data);
      localStorage.setItem('user', JSON.stringify(data));
      await loadAssignments(data.id);

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Có lỗi xảy ra khi đăng nhập' };
    }
  }

  function logout() {
    setUser(null);
    setAssignments([]);
    localStorage.removeItem('user');
  }

  function getAssignedClassIds(schoolYear?: string): string[] {
    if (!user) return [];
    if (user.role === 'admin') return []; // Admin có quyền tất cả

    let filtered = assignments;
    if (schoolYear) {
      filtered = assignments.filter(a => a.school_year === schoolYear);
    }
    return [...new Set(filtered.map(a => a.class_id))];
  }

  const value: AuthContextType = {
    user,
    assignments,
    loading,
    login,
    logout,
    isAdmin: user?.role === 'admin',
    getAssignedClassIds,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
