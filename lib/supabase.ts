import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database Types
export interface Class {
  id: string;
  name: string;
  subject: string;
  schedule: string;
  tuition: number;
  created_at?: string;
  updated_at?: string;
}

export interface Student {
  id: string;
  name: string;
  phone: string;
  parent_phone: string;
  class_id: string;
  note: string;
  created_at?: string;
  updated_at?: string;
}

export interface Attendance {
  id: string;
  student_id: string;
  class_id: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  note: string;
  created_at?: string;
  updated_at?: string;
}

export interface Payment {
  id: string;
  student_id: string;
  class_id: string;
  month: string;
  amount: number;
  sessions: number;
  paid_date: string | null;
  status: 'paid' | 'unpaid';
  created_at?: string;
  updated_at?: string;
}

// Extended types with joined data
export interface StudentWithClass extends Student {
  class_name?: string;
}

export interface AttendanceWithStudent extends Attendance {
  student_name?: string;
}

export interface PaymentWithStudent extends Payment {
  student_name?: string;
}
