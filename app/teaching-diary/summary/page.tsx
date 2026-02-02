'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Subject, TeachingDiary } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { BookOpen, ChevronDown, ChevronRight, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface GroupedDiary {
  week: number;
  entries: TeachingDiary[];
}

export default function TeachingDiarySummaryPage() {
  const { user, isAdmin, getAssignedSubjects } = useAuth();
  const [schoolYears, setSchoolYears] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('2025-2026');
  const [loading, setLoading] = useState(false);

  // Subject selection
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [assignedSubjects, setAssignedSubjects] = useState<Subject[]>([]);

  // Week range filter
  const [weekFrom, setWeekFrom] = useState<number>(1);
  const [weekTo, setWeekTo] = useState<number>(35);

  // Grouped data by week
  const [groupedData, setGroupedData] = useState<GroupedDiary[]>([]);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadSchoolYears();
    if (!isAdmin) {
      const subjects = getAssignedSubjects();
      setAssignedSubjects(subjects);
      if (subjects.length === 1) {
        setSelectedSubjectId(subjects[0].id);
      }
    } else {
      loadAllSubjects();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (selectedSubjectId) {
      loadDiaryEntries();
    }
  }, [selectedYear, selectedSubjectId, weekFrom, weekTo]);

  async function loadAllSubjects() {
    try {
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setAssignedSubjects(data || []);
      if (data && data.length > 0) {
        setSelectedSubjectId(data[0].id);
      }
    } catch (error) {
      console.error('Error loading subjects:', error);
    }
  }

  async function loadSchoolYears() {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('school_year')
        .order('school_year', { ascending: false });

      if (error) throw error;

      const uniqueYears = Array.from(new Set(data?.map(c => c.school_year) || []));
      setSchoolYears(uniqueYears);

      if (uniqueYears.length > 0 && !selectedYear) {
        setSelectedYear(uniqueYears[0]);
      }
    } catch (error) {
      console.error('Error loading school years:', error);
    }
  }

  async function loadDiaryEntries() {
    try {
      setLoading(true);

      let query = supabase
        .from('teaching_diary')
        .select(`
          *,
          classes (name, grades (name)),
          subjects (name)
        `)
        .eq('subject_id', selectedSubjectId)
        .gte('week_number', weekFrom)
        .lte('week_number', weekTo)
        .order('week_number', { ascending: true })
        .order('date', { ascending: true })
        .order('period', { ascending: true });

      // Filter by user if not admin
      if (!isAdmin && user) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Group by week
      const grouped: Map<number, TeachingDiary[]> = new Map();
      (data || []).forEach((entry) => {
        const week = entry.week_number;
        if (!grouped.has(week)) {
          grouped.set(week, []);
        }
        grouped.get(week)!.push(entry);
      });

      // Convert to array
      const result: GroupedDiary[] = [];
      grouped.forEach((entries, week) => {
        result.push({ week, entries });
      });

      setGroupedData(result);

      // Expand all weeks by default
      setExpandedWeeks(new Set(result.map(g => g.week)));
    } catch (error) {
      console.error('Error loading diary entries:', error);
    } finally {
      setLoading(false);
    }
  }

  function toggleWeek(week: number) {
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(week)) {
        next.delete(week);
      } else {
        next.add(week);
      }
      return next;
    });
  }

  function expandAll() {
    setExpandedWeeks(new Set(groupedData.map(g => g.week)));
  }

  function collapseAll() {
    setExpandedWeeks(new Set());
  }

  const totalEntries = groupedData.reduce((sum, g) => sum + g.entries.length, 0);

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-4 lg:mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-800 flex items-center gap-2">
          <BookOpen className="text-purple-600" />
          Tổng hợp nhật ký tiết dạy
        </h1>
        <p className="text-sm lg:text-base text-gray-600 mt-1">Xem tổng hợp nhật ký theo tuần</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow mb-6 p-4 lg:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={20} className="text-gray-500" />
          <h2 className="font-semibold text-gray-800">Bộ lọc</h2>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Subject selector */}
          {assignedSubjects.length > 1 && (
            <div className="col-span-2 lg:col-span-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Môn học</label>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="w-full px-3 py-2 border-2 border-blue-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm bg-blue-50"
              >
                <option value="">-- Chọn môn học --</option>
                {assignedSubjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Năm học</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
            >
              {schoolYears.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Từ tuần</label>
            <input
              type="number"
              min={1}
              max={35}
              value={weekFrom}
              onChange={(e) => setWeekFrom(Number(e.target.value))}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Đến tuần</label>
            <input
              type="number"
              min={1}
              max={35}
              value={weekTo}
              onChange={(e) => setWeekTo(Number(e.target.value))}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
            />
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={expandAll}
              className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Mở tất cả
            </button>
            <button
              onClick={collapseAll}
              className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Đóng tất cả
            </button>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-purple-600 font-medium">Tổng số tiết đã dạy:</span>
            <span className="ml-2 text-2xl font-bold text-purple-800">{totalEntries}</span>
          </div>
          <div>
            <span className="text-sm text-purple-600 font-medium">Số tuần có dữ liệu:</span>
            <span className="ml-2 text-2xl font-bold text-purple-800">{groupedData.length}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      ) : !selectedSubjectId ? (
        <div className="text-center py-12 bg-white rounded-lg shadow text-gray-500">
          <BookOpen size={48} className="mx-auto mb-4 opacity-30" />
          <p>Vui lòng chọn môn học để xem nhật ký</p>
        </div>
      ) : groupedData.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow text-gray-500">
          <BookOpen size={48} className="mx-auto mb-4 opacity-30" />
          <p>Chưa có nhật ký nào trong khoảng tuần đã chọn</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedData.map(({ week, entries }) => (
            <div key={week} className="bg-white rounded-lg shadow overflow-hidden">
              {/* Week header */}
              <div
                onClick={() => toggleWeek(week)}
                className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white cursor-pointer hover:from-purple-600 hover:to-purple-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {expandedWeeks.has(week) ? (
                    <ChevronDown size={24} />
                  ) : (
                    <ChevronRight size={24} />
                  )}
                  <span className="text-lg font-bold">Tuần {week}</span>
                  <span className="px-2 py-1 bg-white/20 rounded text-sm">
                    {entries.length} tiết
                  </span>
                </div>
              </div>

              {/* Week content */}
              {expandedWeeks.has(week) && (
                <div className="divide-y divide-gray-200">
                  {entries.map((entry) => (
                    <div key={entry.id} className="p-4 hover:bg-gray-50">
                      <div className="flex items-start gap-4">
                        <div className="flex flex-col items-center min-w-[80px]">
                          <span className="text-sm font-semibold text-gray-800">
                            {format(new Date(entry.date), 'dd/MM', { locale: vi })}
                          </span>
                          <span className="text-xs text-gray-500">
                            {format(new Date(entry.date), 'EEEE', { locale: vi })}
                          </span>
                          <span className="mt-1 px-2 py-0.5 bg-orange-100 text-orange-800 text-xs font-semibold rounded">
                            Tiết {entry.period}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm text-blue-600 font-medium">
                              {(entry as any).classes?.grades?.name} - {(entry as any).classes?.name}
                            </span>
                          </div>
                          <h3 className="font-semibold text-gray-800">{entry.lesson_name}</h3>
                          {entry.content && (
                            <p className="text-gray-600 text-sm mt-1 whitespace-pre-line">{entry.content}</p>
                          )}
                          {entry.notes && (
                            <p className="text-gray-500 text-sm mt-1 italic">Ghi chú: {entry.notes}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
