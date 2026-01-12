// =============================================
// TypeScript Interfaces cho Database
// =============================================

// Khối lớp
export interface Grade {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

// Lớp học
export interface Class {
  id: string;
  name: string;
  grade_id: string;
  school_year: string; // Format: YYYY-YYYY (e.g., 2025-2026)
  schedule: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  grades?: Grade;
}

// Học sinh
export interface Student {
  id: string;
  name: string;
  computer_name: string | null; // A1-A8, B1-B8...E1-E8
  phone: string | null;
  parent_phone: string | null;
  class_id: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  classes?: Class;
}

// Chủ đề
export interface Topic {
  id: string;
  name: string;
  description: string | null;
  grade_id: string;
  display_order: number;
  created_at: string;
  updated_at: string;
  // Relations
  grades?: Grade;
}

// Tiêu chí
export interface Criterion {
  id: string;
  name: string;
  description: string | null;
  topic_id: string;
  display_order: number;
  created_at: string;
  updated_at: string;
  // Relations
  topics?: Topic;
}

// Mức đánh giá
export type RatingLevel =
  | 'not_completed'       // Chưa hoàn thành
  | 'completed'           // Hoàn thành
  | 'completed_well'      // Hoàn thành tốt
  | 'completed_excellent'; // Hoàn thành rất tốt

// Labels cho rating levels
export const RATING_LABELS: Record<RatingLevel, string> = {
  not_completed: 'Chưa hoàn thành',
  completed: 'Hoàn thành',
  completed_well: 'Hoàn thành tốt',
  completed_excellent: 'Hoàn thành rất tốt',
};

// Mức đánh giá (dynamic configuration)
export interface EvaluationLevel {
  id: string;
  name: string;
  description: string | null;
  color: string; // Hex color code
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Colors cho rating levels
export const RATING_COLORS: Record<RatingLevel, string> = {
  not_completed: 'bg-red-100 text-red-800',
  completed: 'bg-yellow-100 text-yellow-800',
  completed_well: 'bg-blue-100 text-blue-800',
  completed_excellent: 'bg-green-100 text-green-800',
};

// Đánh giá
export interface Evaluation {
  id: string;
  student_id: string;
  criterion_id: string;
  class_id: string;
  rating: RatingLevel;
  note: string | null;
  evaluated_date: string;
  created_at: string;
  updated_at: string;
  // Relations
  students?: Student;
  criteria?: Criterion;
  classes?: Class;
}

// Điểm danh
export type AttendanceStatus = 'present' | 'absent';

export interface Attendance {
  id: string;
  student_id: string;
  class_id: string;
  date: string;
  status: AttendanceStatus;
  note: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  students?: Student;
  classes?: Class;
}

// Tên máy tính (40 máy)
export const COMPUTER_NAMES = [
  'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8',
  'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8',
  'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8',
  'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8',
  'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8',
];

// Helper: Cycle qua 4 mức đánh giá
export function getNextRating(current: RatingLevel): RatingLevel {
  const ratings: RatingLevel[] = ['completed', 'completed_well', 'completed_excellent', 'not_completed'];
  const currentIndex = ratings.indexOf(current);
  const nextIndex = (currentIndex + 1) % ratings.length;
  return ratings[nextIndex];
}

// Helper: Tính tổng hợp kết quả chủ đề
export function calculateTopicSummary(criteriaRatings: RatingLevel[]): RatingLevel {
  if (criteriaRatings.length === 0) return 'not_completed';

  const notCompletedCount = criteriaRatings.filter(r => r === 'not_completed').length;
  const excellentCount = criteriaRatings.filter(r => r === 'completed_excellent').length;
  const wellCount = criteriaRatings.filter(r => r === 'completed_well').length;

  const total = criteriaRatings.length;
  const notCompletedPercent = notCompletedCount / total;
  const goodPercent = (excellentCount + wellCount) / total;

  // Có >= 50% tiêu chí chưa hoàn thành
  if (notCompletedPercent >= 0.5) {
    return 'not_completed';
  }

  // Tất cả tiêu chí đều hoàn thành rất tốt
  if (excellentCount === total) {
    return 'completed_excellent';
  }

  // >= 75% tiêu chí hoàn thành tốt trở lên + không có chưa hoàn thành
  if (goodPercent >= 0.75 && notCompletedCount === 0) {
    return 'completed_well';
  }

  // < 75% hoàn thành tốt + không có chưa hoàn thành
  if (notCompletedCount === 0) {
    return 'completed';
  }

  // Còn lại
  return 'completed';
}
