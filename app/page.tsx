'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Layers, BookOpen, Users, ClipboardList, TrendingUp, Calendar, PenLine, Edit2, Plus } from 'lucide-react';
import Link from 'next/link';
import { format, subDays } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Class, TeachingDiary } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';

interface Stats {
  totalGrades: number;
  totalClasses: number;
  totalStudents: number;
  todayAttendance: {
    present: number;
    total: number;
  };
}

interface ClassBreakdown {
  id: string;
  name: string;
  grade_name: string;
  student_count: number;
  today_present: number;
  today_total: number;
}

interface RecentAttendance {
  date: string;
  present: number;
  total: number;
}

export default function DashboardPage() {
  const { user, isAdmin, getAssignedClassIds } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalGrades: 0,
    totalClasses: 0,
    totalStudents: 0,
    todayAttendance: { present: 0, total: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [schoolYears, setSchoolYears] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('2025-2026');
  const [classBreakdown, setClassBreakdown] = useState<ClassBreakdown[]>([]);
  const [recentAttendance, setRecentAttendance] = useState<RecentAttendance[]>([]);
  const [todayDiary, setTodayDiary] = useState<TeachingDiary[]>([]);

  useEffect(() => {
    loadSchoolYears();
  }, []);

  useEffect(() => {
    if (selectedYear) {
      loadStats();
    }
  }, [selectedYear]);

  async function loadSchoolYears() {
    const { data: classesData } = await supabase
      .from('classes')
      .select('school_year')
      .order('school_year', { ascending: false });

    const uniqueYears = Array.from(new Set(classesData?.map((c) => c.school_year) || []));
    setSchoolYears(uniqueYears);

    if (uniqueYears.length > 0 && !selectedYear) {
      setSelectedYear(uniqueYears[0]);
    }
  }

  async function loadStats() {
    try {
      setLoading(true);

      // Get assigned class IDs for non-admin users
      const assignedClassIds = isAdmin ? null : getAssignedClassIds();

      // Total grades
      const { count: gradesCount } = await supabase
        .from('grades')
        .select('*', { count: 'exact', head: true });

      // Total classes for selected year (filtered by assignment for teachers)
      let classesQuery = supabase
        .from('classes')
        .select('*, grades(name)', { count: 'exact' })
        .eq('school_year', selectedYear);

      // Filter by assigned classes if not admin
      if (!isAdmin && assignedClassIds && assignedClassIds.length > 0) {
        classesQuery = classesQuery.in('id', assignedClassIds);
      } else if (!isAdmin && (!assignedClassIds || assignedClassIds.length === 0)) {
        // Teacher with no assignments - show no classes
        classesQuery = classesQuery.in('id', ['no-match']);
      }

      const { data: classesData, count: classesCount } = await classesQuery;

      // Total students for selected year
      const classIds = classesData?.map(c => c.id) || [];
      const { count: studentsCount } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .in('class_id', classIds.length > 0 ? classIds : ['']);

      // Today's attendance (filtered by assigned classes for teachers)
      const today = format(new Date(), 'yyyy-MM-dd');
      let attendanceQuery = supabase
        .from('attendance')
        .select('status, class_id')
        .eq('date', today);

      if (!isAdmin && classIds.length > 0) {
        attendanceQuery = attendanceQuery.in('class_id', classIds);
      } else if (!isAdmin && classIds.length === 0) {
        attendanceQuery = attendanceQuery.in('class_id', ['no-match']);
      }

      const { data: todayAttendance } = await attendanceQuery;

      const presentToday = todayAttendance?.filter(a => a.status === 'present').length || 0;
      const totalToday = todayAttendance?.length || 0;

      setStats({
        totalGrades: gradesCount || 0,
        totalClasses: classesCount || 0,
        totalStudents: studentsCount || 0,
        todayAttendance: {
          present: presentToday,
          total: totalToday,
        },
      });

      // Load class breakdown
      await loadClassBreakdown(classesData || [], todayAttendance || []);

      // Load recent attendance (last 7 days)
      await loadRecentAttendance(classIds);

      // Load today's diary entries
      await loadTodayDiary();
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadClassBreakdown(classes: any[], todayAttendance: any[]) {
    const breakdown: ClassBreakdown[] = [];

    for (const cls of classes) {
      // Count students in this class
      const { count: studentCount } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('class_id', cls.id);

      // Today's attendance for this class
      const classAttendance = todayAttendance.filter(a => a.class_id === cls.id);
      const classPresent = classAttendance.filter(a => a.status === 'present').length;

      breakdown.push({
        id: cls.id,
        name: cls.name,
        grade_name: cls.grades?.name || 'N/A',
        student_count: studentCount || 0,
        today_present: classPresent,
        today_total: classAttendance.length,
      });
    }

    setClassBreakdown(breakdown);
  }

  async function loadRecentAttendance(classIds: string[]) {
    const recent: RecentAttendance[] = [];

    for (let i = 0; i < 7; i++) {
      const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
      let query = supabase
        .from('attendance')
        .select('status')
        .eq('date', date);

      // Filter by class IDs for teachers
      if (!isAdmin && classIds.length > 0) {
        query = query.in('class_id', classIds);
      } else if (!isAdmin && classIds.length === 0) {
        query = query.in('class_id', ['no-match']);
      }

      const { data } = await query;

      const present = data?.filter(a => a.status === 'present').length || 0;
      const total = data?.length || 0;

      recent.push({ date, present, total });
    }

    setRecentAttendance(recent.reverse());
  }

  async function loadTodayDiary() {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');

      let query = supabase
        .from('teaching_diary')
        .select(`
          *,
          classes (name, grades (name)),
          subjects (name)
        `)
        .eq('date', today)
        .order('period', { ascending: true });

      // Filter by user if not admin
      if (!isAdmin && user) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTodayDiary(data || []);
    } catch (error) {
      console.error('Error loading today diary:', error);
    }
  }

  const statCards = [
    {
      title: 'Tổng số khối',
      value: stats.totalGrades,
      icon: Layers,
      color: 'bg-purple-500',
      link: '/grades',
    },
    {
      title: 'Tổng số lớp',
      value: stats.totalClasses,
      icon: BookOpen,
      color: 'bg-blue-500',
      link: '/classes',
    },
    {
      title: 'Tổng số học sinh',
      value: stats.totalStudents,
      icon: Users,
      color: 'bg-green-500',
      link: '/students',
    },
    {
      title: 'Điểm danh hôm nay',
      value: `${stats.todayAttendance.present}/${stats.todayAttendance.total}`,
      icon: ClipboardList,
      color: 'bg-yellow-500',
      link: '/attendance',
    },
  ];

  const attendancePercentage = stats.todayAttendance.total > 0
    ? Math.round((stats.todayAttendance.present / stats.todayAttendance.total) * 100)
    : 0;

  return (
    <div className="p-4 lg:p-8 pb-20 lg:pb-8">
      <div className="mb-6 lg:mb-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-800">Tổng quan</h1>
          <p className="text-sm lg:text-base text-gray-600 mt-1">Hệ thống đánh giá học sinh</p>
        </div>
        {schoolYears.length > 0 && (
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-lg shadow-md border-2 border-blue-100">
            <Calendar className="text-blue-600" size={20} />
            <label className="text-sm font-semibold text-gray-700">Năm học:</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-3 py-1.5 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none font-semibold text-gray-800"
            >
              {schoolYears.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6 mb-6 lg:mb-8">
            {statCards.map((card) => {
              const Icon = card.icon;
              return (
                <Link
                  key={card.title}
                  href={card.link}
                  className="bg-white rounded-lg lg:rounded-xl shadow-md hover:shadow-xl transition-all p-3 lg:p-6 border-2 border-transparent hover:border-blue-400"
                >
                  <div className="flex items-center justify-between mb-2 lg:mb-4">
                    <div className={`${card.color} w-8 h-8 lg:w-12 lg:h-12 rounded-lg flex items-center justify-center`}>
                      <Icon className="text-white w-4 h-4 lg:w-6 lg:h-6" />
                    </div>
                  </div>
                  <h3 className="text-gray-600 text-xs lg:text-sm font-semibold mb-1">{card.title}</h3>
                  <p className="text-xl lg:text-3xl font-bold text-gray-800">{card.value}</p>
                </Link>
              );
            })}
          </div>

          {/* Attendance Stats */}
          {stats.todayAttendance.total > 0 && (
            <div className="bg-white rounded-lg lg:rounded-xl shadow-md p-4 lg:p-6 mb-6 lg:mb-8">
              <h2 className="text-lg lg:text-xl font-bold text-gray-800 mb-3 lg:mb-4 flex items-center gap-2">
                <ClipboardList className="text-yellow-500" size={20} />
                Điểm danh hôm nay ({format(new Date(), 'dd/MM/yyyy')})
              </h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Có mặt:</span>
                  <span className="text-2xl font-bold text-green-600">{stats.todayAttendance.present}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Tổng số:</span>
                  <span className="text-2xl font-bold text-gray-800">{stats.todayAttendance.total}</span>
                </div>
                <div className="pt-4 border-t">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-600 font-semibold">Tỷ lệ:</span>
                    <span className="text-xl font-bold text-blue-600">{attendancePercentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-green-400 to-green-600 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${attendancePercentage}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Today's Teaching Diary */}
          <div className="bg-white rounded-lg lg:rounded-xl shadow-md p-4 lg:p-6 mb-6 lg:mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg lg:text-xl font-bold text-gray-800 flex items-center gap-2">
                <PenLine className="text-purple-500" size={20} />
                Nhật ký tiết dạy hôm nay ({format(new Date(), 'dd/MM/yyyy', { locale: vi })})
              </h2>
              <Link
                href="/teaching-diary"
                className="flex items-center gap-1 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm font-semibold"
              >
                <Plus size={16} />
                Thêm mới
              </Link>
            </div>

            {todayDiary.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <PenLine size={48} className="mx-auto mb-3 opacity-30" />
                <p>Chưa có nhật ký tiết dạy nào hôm nay</p>
                <Link
                  href="/teaching-diary"
                  className="inline-block mt-3 text-purple-600 hover:text-purple-800 font-semibold"
                >
                  Thêm nhật ký tiết dạy →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {todayDiary.map((entry) => (
                  <div
                    key={entry.id}
                    className="border-2 border-gray-200 rounded-lg p-4 hover:border-purple-300 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 bg-orange-100 text-orange-800 text-xs font-semibold rounded">
                            Tiết {entry.period}
                          </span>
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-xs font-semibold rounded">
                            Tuần {entry.week_number}
                          </span>
                          <span className="text-sm text-blue-600 font-medium">
                            {(entry as any).classes?.grades?.name} - {(entry as any).classes?.name}
                          </span>
                        </div>
                        <h3 className="font-semibold text-gray-800">{entry.lesson_name}</h3>
                        {entry.content && (
                          <p className="text-gray-600 text-sm mt-1 line-clamp-2">{entry.content}</p>
                        )}
                      </div>
                      <Link
                        href="/teaching-diary"
                        className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        title="Chỉnh sửa"
                      >
                        <Edit2 size={18} />
                      </Link>
                    </div>
                  </div>
                ))}

                <Link
                  href="/teaching-diary/summary"
                  className="block text-center py-3 text-purple-600 hover:text-purple-800 font-semibold border-t border-gray-200 mt-4"
                >
                  Xem tổng hợp nhật ký →
                </Link>
              </div>
            )}
          </div>

          {/* Recent Attendance Trend */}
          {recentAttendance.length > 0 && (
            <div className="bg-white rounded-lg lg:rounded-xl shadow-md p-4 lg:p-6 mb-6 lg:mb-8">
              <h2 className="text-lg lg:text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <TrendingUp className="text-purple-500" size={20} />
                xu hướng điểm danh 7 ngày qua
              </h2>
              <div className="overflow-x-auto">
                <div className="flex gap-2 min-w-max lg:min-w-0">
                  {recentAttendance.map((day, index) => {
                    const percentage = day.total > 0
                      ? Math.round((day.present / day.total) * 100)
                      : 0;
                    const maxHeight = 120;
                    const barHeight = percentage > 0 ? Math.max((percentage / 100) * maxHeight, 10) : 0;

                    return (
                      <div key={index} className="flex-1 min-w-[80px]">
                        <div className="flex flex-col items-center">
                          <div className="w-full bg-gray-100 rounded-t-lg flex items-end justify-center" style={{ height: `${maxHeight}px` }}>
                            {day.total > 0 ? (
                              <div
                                className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-lg flex flex-col items-center justify-end pb-2 transition-all"
                                style={{ height: `${barHeight}px` }}
                              >
                                <span className="text-white text-xs font-bold">{percentage}%</span>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs mb-2">N/A</span>
                            )}
                          </div>
                          <div className="text-center mt-2">
                            <p className="text-xs font-semibold text-gray-700">
                              {format(new Date(day.date), 'dd/MM')}
                            </p>
                            <p className="text-xs text-gray-500">
                              {day.present}/{day.total}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Quick Start Guide */}
          {stats.totalGrades === 0 && (
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 lg:p-8 text-white">
              <h2 className="text-xl lg:text-2xl font-bold mb-3">Chào mừng đến với Hệ thống Đánh giá Học sinh! 🎓</h2>
              <p className="mb-4 text-blue-50">Để bắt đầu sử dụng, hãy thực hiện các bước sau:</p>
              <div className="space-y-3">
                <div className="flex items-start gap-3 bg-white/10 p-3 rounded-lg">
                  <div className="bg-white text-blue-600 w-8 h-8 rounded-full flex items-center justify-center font-bold flex-shrink-0">1</div>
                  <div>
                    <p className="font-semibold">Tạo Khối lớp</p>
                    <p className="text-sm text-blue-100">Ví dụ: Khối 3, Khối 4, Khối 5</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 bg-white/10 p-3 rounded-lg">
                  <div className="bg-white text-blue-600 w-8 h-8 rounded-full flex items-center justify-center font-bold flex-shrink-0">2</div>
                  <div>
                    <p className="font-semibold">Tạo Lớp học</p>
                    <p className="text-sm text-blue-100">Thêm các lớp vào khối đã tạo</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 bg-white/10 p-3 rounded-lg">
                  <div className="bg-white text-blue-600 w-8 h-8 rounded-full flex items-center justify-center font-bold flex-shrink-0">3</div>
                  <div>
                    <p className="font-semibold">Thêm Học sinh</p>
                    <p className="text-sm text-blue-100">Thêm học sinh vào lớp và gán tên máy (A1-E8)</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 bg-white/10 p-3 rounded-lg">
                  <div className="bg-white text-blue-600 w-8 h-8 rounded-full flex items-center justify-center font-bold flex-shrink-0">4</div>
                  <div>
                    <p className="font-semibold">Tạo Chủ đề & Tiêu chí</p>
                    <p className="text-sm text-blue-100">Thiết lập các chủ đề và tiêu chí đánh giá</p>
                  </div>
                </div>
              </div>
              <Link
                href="/grades"
                className="inline-block mt-6 px-6 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
              >
                Bắt đầu ngay
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
