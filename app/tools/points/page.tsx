'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Class, Subject } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { Save, ChevronDown, ChevronUp, Minus, Plus, Trophy } from 'lucide-react';
import { format } from 'date-fns';

interface PointRecord {
  studentId: string;
  studentName: string;
  computerName: string | null;
  points: number; // Điểm của tiết đang chọn
  total: number; // Tổng điểm cộng dồn cả lớp học (mọi ngày/tiết)
}

export default function PointsToolPage() {
  const { user, isAdmin, getAssignedClassIds, getAssignedSubjects } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [schoolYears, setSchoolYears] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('2025-2026');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [pointRecords, setPointRecords] = useState<PointRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isControlsCollapsed, setIsControlsCollapsed] = useState(false);

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [assignedSubjects, setAssignedSubjects] = useState<Subject[]>([]);

  const [selectedPeriod, setSelectedPeriod] = useState<number>(1);
  const PERIODS = [1, 2, 3, 4, 5, 6, 7];

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
    if (isAdmin || selectedSubjectId || assignedSubjects.length <= 1) {
      loadClasses();
    }
    setSelectedClassId('');
  }, [selectedYear, selectedSubjectId, isAdmin]);

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

  useEffect(() => {
    if (selectedClassId && selectedDate && selectedPeriod) {
      loadPoints();
    }
  }, [selectedClassId, selectedDate, selectedPeriod]);

  async function loadSchoolYears() {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('school_year')
        .order('school_year', { ascending: false });

      if (error) throw error;

      const uniqueYears = Array.from(new Set(data?.map((c) => c.school_year) || []));
      setSchoolYears(uniqueYears);

      if (uniqueYears.length > 0 && !selectedYear) {
        setSelectedYear(uniqueYears[0]);
      }
    } catch (error) {
      console.error('Error loading school years:', error);
    }
  }

  async function loadClasses() {
    try {
      const assignedClassIds = isAdmin ? null : getAssignedClassIds(selectedSubjectId);

      let query = supabase
        .from('classes')
        .select(`
          *,
          grades (
            id,
            name
          )
        `)
        .eq('school_year', selectedYear)
        .order('name');

      if (!isAdmin && assignedClassIds && assignedClassIds.length > 0) {
        query = query.in('id', assignedClassIds);
      } else if (!isAdmin && (!assignedClassIds || assignedClassIds.length === 0)) {
        setClasses([]);
        return;
      }

      const { data, error } = await query;

      if (error) throw error;
      setClasses(data || []);
      if (data && data.length > 0 && !selectedClassId) {
        setSelectedClassId(data[0].id);
      }
    } catch (error) {
      console.error('Error loading classes:', error);
    }
  }

  async function loadPoints() {
    try {
      setLoading(true);

      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id, name, computer_name')
        .eq('class_id', selectedClassId)
        .order('computer_name', { ascending: true, nullsFirst: false });

      if (studentsError) throw studentsError;

      const studentIds = (studentsData || []).map((s) => s.id);

      const [todayResult, totalResult] = await Promise.all([
        supabase
          .from('student_points')
          .select('student_id, points')
          .eq('class_id', selectedClassId)
          .eq('date', selectedDate)
          .eq('period', selectedPeriod),
        studentIds.length > 0
          ? supabase.from('student_points').select('student_id, points').in('student_id', studentIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (todayResult.error) throw todayResult.error;
      if (totalResult.error) throw totalResult.error;

      const totalsMap: Record<string, number> = {};
      (totalResult.data || []).forEach((r: any) => {
        totalsMap[r.student_id] = (totalsMap[r.student_id] || 0) + r.points;
      });

      const records: PointRecord[] = (studentsData || []).map((student) => {
        const existing = todayResult.data?.find((r: any) => r.student_id === student.id);
        return {
          studentId: student.id,
          studentName: student.name,
          computerName: student.computer_name,
          points: existing?.points || 0,
          total: totalsMap[student.id] || 0,
        };
      });

      setPointRecords(records);
    } catch (error) {
      console.error('Error loading points:', error);
      alert('Lỗi khi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }

  function addPoint(studentId: string, delta: number) {
    setPointRecords((records) =>
      records.map((r) => (r.studentId === studentId ? { ...r, points: r.points + delta } : r))
    );
  }

  async function handleSave() {
    if (!selectedClassId || !selectedDate || !selectedPeriod) {
      alert('Vui lòng chọn lớp, ngày và tiết học');
      return;
    }

    try {
      setSaving(true);

      for (const record of pointRecords) {
        const { data: existing } = await supabase
          .from('student_points')
          .select('id')
          .eq('student_id', record.studentId)
          .eq('class_id', selectedClassId)
          .eq('date', selectedDate)
          .eq('period', selectedPeriod)
          .single();

        if (existing) {
          await supabase
            .from('student_points')
            .update({
              points: record.points,
              subject_id: selectedSubjectId || null,
              user_id: user?.id || null,
            })
            .eq('id', existing.id);
        } else {
          await supabase.from('student_points').insert([
            {
              student_id: record.studentId,
              class_id: selectedClassId,
              subject_id: selectedSubjectId || null,
              date: selectedDate,
              period: selectedPeriod,
              points: record.points,
              user_id: user?.id || null,
            },
          ]);
        }
      }

      alert('Lưu điểm thưởng thành công!');
      await loadPoints();
    } catch (error) {
      console.error('Error saving points:', error);
      alert('Lỗi khi lưu điểm thưởng');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 lg:p-8 pb-24 lg:pb-24">
      <div className="mb-4 lg:mb-6 flex items-center gap-2">
        <Trophy className="text-yellow-500" size={28} />
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-800">Điểm thưởng</h1>
          <p className="text-sm lg:text-base text-gray-600 mt-1">Cộng/trừ điểm khi học sinh phát biểu</p>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow mb-4 lg:mb-6">
        <div
          onClick={() => setIsControlsCollapsed(!isControlsCollapsed)}
          className="flex items-center justify-between p-4 lg:p-6 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-200"
        >
          <div className="flex items-center gap-2">
            <h2 className="text-base lg:text-lg font-bold text-gray-800">Thông tin</h2>
            {isControlsCollapsed && (
              <span className="text-sm text-gray-600">
                {classes.find((c) => c.id === selectedClassId)?.name || 'Chưa chọn'} -{' '}
                {format(new Date(selectedDate), 'dd/MM/yyyy')} - Tiết {selectedPeriod}
              </span>
            )}
          </div>
          {isControlsCollapsed ? <ChevronDown size={24} /> : <ChevronUp size={24} />}
        </div>

        {!isControlsCollapsed && (
          <div className="p-4 lg:p-6 space-y-4">
            {assignedSubjects.length > 1 && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Môn học <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => {
                    setSelectedSubjectId(e.target.value);
                    setSelectedClassId('');
                  }}
                  className="w-full px-3 lg:px-4 py-2 border-2 border-blue-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm lg:text-base bg-blue-50"
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

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Năm học <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full px-3 lg:px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm lg:text-base"
                >
                  {schoolYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Lớp <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  disabled={!isAdmin && assignedSubjects.length > 1 && !selectedSubjectId}
                  className="w-full px-3 lg:px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm lg:text-base disabled:bg-gray-100"
                >
                  {classes.length === 0 ? (
                    <option value="">Chưa có lớp học</option>
                  ) : (
                    classes.map((classItem) => (
                      <option key={classItem.id} value={classItem.id}>
                        {(classItem as any).grades?.name} - {classItem.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="min-w-0">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Ngày <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full max-w-full min-w-0 px-3 lg:px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm lg:text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tiết <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(Number(e.target.value))}
                  className="w-full px-3 lg:px-4 py-2 border-2 border-orange-300 rounded-lg focus:border-orange-500 focus:outline-none text-sm lg:text-base bg-orange-50"
                >
                  {PERIODS.map((period) => (
                    <option key={period} value={period}>
                      Tiết {period} {period <= 4 ? '(Sáng)' : '(Chiều)'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Points list */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : !isAdmin && assignedSubjects.length > 1 && !selectedSubjectId ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 text-sm lg:text-lg">Vui lòng chọn môn học để bắt đầu</p>
        </div>
      ) : !selectedClassId ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 text-sm lg:text-lg">Vui lòng chọn lớp để bắt đầu</p>
        </div>
      ) : pointRecords.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 text-sm lg:text-lg">Lớp này chưa có học sinh</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow divide-y divide-gray-100">
          {pointRecords.map((record) => (
            <div key={record.studentId} className="p-3 lg:p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-800 truncate">{record.studentName}</div>
                <div className="text-xs lg:text-sm text-gray-500">
                  {record.computerName || '—'} · Tổng: {record.total}đ
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => addPoint(record.studentId, -1)}
                  className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100 active:scale-95 transition"
                  aria-label="Trừ điểm"
                >
                  <Minus size={18} />
                </button>
                <span
                  className={`w-10 text-center font-bold text-lg tabular-nums ${
                    record.points > 0 ? 'text-green-600' : record.points < 0 ? 'text-red-600' : 'text-gray-700'
                  }`}
                >
                  {record.points}
                </span>
                <button
                  onClick={() => addPoint(record.studentId, 1)}
                  className="w-10 h-10 rounded-lg bg-green-50 text-green-600 flex items-center justify-center hover:bg-green-100 active:scale-95 transition"
                  aria-label="Cộng điểm"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fixed Save Button */}
      {selectedClassId && pointRecords.length > 0 && (
        <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 lg:left-64 bg-white border-t-2 border-gray-200 shadow-lg p-4 z-20">
          <div className="max-w-7xl mx-auto flex justify-center lg:justify-start">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full lg:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed shadow-md"
            >
              <Save size={20} />
              {saving ? 'Đang lưu...' : 'Lưu điểm thưởng'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
