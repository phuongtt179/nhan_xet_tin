'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Class, Subject, Student } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { Dice5, RotateCcw } from 'lucide-react';

export default function RandomPickerPage() {
  const { isAdmin, getAssignedClassIds, getAssignedSubjects } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [schoolYears, setSchoolYears] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('2025-2026');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [assignedSubjects, setAssignedSubjects] = useState<Subject[]>([]);

  const [noRepeat, setNoRepeat] = useState(true);
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [display, setDisplay] = useState<Student | null>(null);
  const [winner, setWinner] = useState<Student | null>(null);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadSchoolYears();
    if (!isAdmin) {
      const subjects = getAssignedSubjects();
      setAssignedSubjects(subjects);
      if (subjects.length === 1) setSelectedSubjectId(subjects[0].id);
    } else {
      loadAllSubjects();
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin || selectedSubjectId || assignedSubjects.length <= 1) {
      loadClasses();
    }
    setSelectedClassId('');
  }, [selectedYear, selectedSubjectId, isAdmin]);

  useEffect(() => {
    if (selectedClassId) loadStudents();
  }, [selectedClassId]);

  async function loadAllSubjects() {
    const { data } = await supabase.from('subjects').select('*').eq('is_active', true).order('name');
    setAssignedSubjects(data || []);
    if (data && data.length > 0) setSelectedSubjectId(data[0].id);
  }

  async function loadSchoolYears() {
    const { data } = await supabase.from('classes').select('school_year').order('school_year', { ascending: false });
    const uniqueYears = Array.from(new Set(data?.map((c) => c.school_year) || []));
    setSchoolYears(uniqueYears);
    if (uniqueYears.length > 0 && !selectedYear) setSelectedYear(uniqueYears[0]);
  }

  async function loadClasses() {
    const assignedClassIds = isAdmin ? null : getAssignedClassIds(selectedSubjectId);

    let query = supabase
      .from('classes')
      .select(`*, grades ( id, name )`)
      .eq('school_year', selectedYear)
      .order('name');

    if (!isAdmin && assignedClassIds && assignedClassIds.length > 0) {
      query = query.in('id', assignedClassIds);
    } else if (!isAdmin && (!assignedClassIds || assignedClassIds.length === 0)) {
      setClasses([]);
      return;
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error loading classes:', error);
      return;
    }
    setClasses(data || []);
    if (data && data.length > 0 && !selectedClassId) setSelectedClassId(data[0].id);
  }

  async function loadStudents() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('class_id', selectedClassId)
        .order('computer_name', { ascending: true, nullsFirst: false });
      if (error) throw error;
      setStudents(data || []);
      setPickedIds([]);
      setWinner(null);
      setDisplay(null);
    } catch (error) {
      console.error('Error loading students:', error);
    } finally {
      setLoading(false);
    }
  }

  function eligibleStudents(): Student[] {
    if (!noRepeat) return students;
    const pool = students.filter((s) => !pickedIds.includes(s.id));
    return pool.length > 0 ? pool : students;
  }

  function spin() {
    if (spinning || students.length === 0) return;

    const pool = eligibleStudents();
    if (noRepeat && pool.length === students.length) {
      setPickedIds([]);
    }

    setSpinning(true);
    setWinner(null);

    const finalWinner = pool[Math.floor(Math.random() * pool.length)];
    const totalSteps = 18;
    let step = 0;

    function tick() {
      const random = students[Math.floor(Math.random() * students.length)];
      setDisplay(random);
      step += 1;

      if (step >= totalSteps) {
        setDisplay(finalWinner);
        setWinner(finalWinner);
        setSpinning(false);
        setPickedIds((prev) => (prev.includes(finalWinner.id) ? prev : [...prev, finalWinner.id]));
        return;
      }

      const delay = 60 + step * 12;
      timeoutRef.current = setTimeout(tick, delay);
    }

    tick();
  }

  function resetTurns() {
    setPickedIds([]);
    setWinner(null);
    setDisplay(null);
  }

  const history = students.filter((s) => pickedIds.includes(s.id));

  return (
    <div className="p-4 lg:p-8 pb-24 lg:pb-24">
      <div className="mb-4 lg:mb-6 flex items-center gap-2">
        <Dice5 className="text-purple-500" size={28} />
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-800">Chọn ngẫu nhiên</h1>
          <p className="text-sm lg:text-base text-gray-600 mt-1">Gọi tên học sinh ngẫu nhiên để trả lời</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow mb-4 lg:mb-6 p-4 lg:p-6 space-y-4">
        {assignedSubjects.length > 1 && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Môn học</label>
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
                <option key={subject.id} value={subject.id}>{subject.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Năm học</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full px-3 lg:px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm lg:text-base"
            >
              {schoolYears.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Lớp</label>
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
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : !selectedClassId ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 text-sm lg:text-lg">Vui lòng chọn lớp để bắt đầu</p>
        </div>
      ) : students.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 text-sm lg:text-lg">Lớp này chưa có học sinh</p>
        </div>
      ) : (
        <>
          <label className="flex items-center gap-2 text-sm text-gray-700 mb-4">
            <input
              type="checkbox"
              checked={noRepeat}
              onChange={(e) => setNoRepeat(e.target.checked)}
              className="w-5 h-5"
            />
            Không lặp lại tới khi hết lượt ({pickedIds.length}/{students.length} đã gọi)
          </label>

          <div className="bg-white border-2 border-gray-200 rounded-2xl p-8 lg:p-12 flex flex-col items-center justify-center text-center min-h-[180px] mb-4">
            {display ? (
              <>
                <div className={`text-3xl lg:text-4xl font-bold ${winner ? 'text-blue-600' : 'text-gray-800'}`}>
                  {display.name}
                </div>
                <div className="text-gray-500 mt-2">{display.computer_name || '—'}</div>
              </>
            ) : (
              <div className="text-gray-400">Nhấn QUAY để chọn ngẫu nhiên 1 học sinh</div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={spin}
              disabled={spinning}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white font-semibold py-4 rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-300 transition-colors text-base"
            >
              <Dice5 size={20} />
              {spinning ? 'Đang quay...' : 'QUAY'}
            </button>
            <button
              onClick={resetTurns}
              className="px-4 py-4 border-2 border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 active:bg-gray-100 flex items-center gap-2"
            >
              <RotateCcw size={18} />
              Đặt lại lượt
            </button>
          </div>

          {history.length > 0 && (
            <div className="mt-6">
              <div className="text-sm font-semibold text-gray-700 mb-2">Đã gọi trong buổi:</div>
              <div className="flex flex-wrap gap-2">
                {history.map((s) => (
                  <span key={s.id} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-lg">
                    {s.computer_name || '—'} · {s.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
