'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Class, Subject, TeachingDiary, Curriculum } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { Save, Plus, Edit2, Trash2, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { format, getWeek } from 'date-fns';
import { vi } from 'date-fns/locale';

const PERIODS = [1, 2, 3, 4, 5, 6, 7];

// Tuần học bắt đầu từ ISO week 38 (khoảng 15/9)
// Tuần 1 = ISO week 38, tuần 29 = ISO week 14 của năm sau
const SCHOOL_YEAR_START_WEEK = 38;

function getSchoolWeek(date: Date): number {
  const currentWeek = getWeek(date, { weekStartsOn: 1 });
  if (currentWeek >= SCHOOL_YEAR_START_WEEK) {
    return currentWeek - SCHOOL_YEAR_START_WEEK + 1;
  } else {
    return (52 - SCHOOL_YEAR_START_WEEK) + currentWeek + 1;
  }
}

export default function TeachingDiaryPage() {
  const { user, isAdmin, getAssignedClassIds, getAssignedSubjects } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [schoolYears, setSchoolYears] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('2025-2026');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedPeriod, setSelectedPeriod] = useState<number>(1);
  const [weekNumber, setWeekNumber] = useState<number>(getSchoolWeek(new Date()));
  const [lessonName, setLessonName] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isFormCollapsed, setIsFormCollapsed] = useState(false);

  // Subject selection
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [assignedSubjects, setAssignedSubjects] = useState<Subject[]>([]);

  // Curriculum
  const [curriculumList, setCurriculumList] = useState<Curriculum[]>([]);
  const [useCustomLesson, setUseCustomLesson] = useState(false);

  // Existing diary entries
  const [diaryEntries, setDiaryEntries] = useState<TeachingDiary[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

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

  useEffect(() => {
    // Auto-calculate week number when date changes
    const date = new Date(selectedDate);
    setWeekNumber(getSchoolWeek(date));
  }, [selectedDate]);

  useEffect(() => {
    if (selectedSubjectId) {
      loadDiaryEntries();
    }
  }, [selectedSubjectId, selectedDate]);

  useEffect(() => {
    if (selectedSubjectId && selectedClassId) {
      loadCurriculum();
    } else {
      setCurriculumList([]);
    }
  }, [selectedSubjectId, selectedClassId, weekNumber, selectedYear]);

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

  async function loadDiaryEntries() {
    try {
      setLoading(true);

      // Load ALL diary entries for this date and subject (all classes)
      let query = supabase
        .from('teaching_diary')
        .select(`
          *,
          classes (name, grades (name)),
          subjects (name)
        `)
        .eq('subject_id', selectedSubjectId)
        .eq('date', selectedDate)
        .order('period', { ascending: true });

      // Filter by user if not admin
      if (!isAdmin && user) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setDiaryEntries(data || []);
    } catch (error) {
      console.error('Error loading diary entries:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadCurriculum() {
    try {
      // Lấy grade_id từ lớp đang chọn
      const selectedClass = classes.find(c => c.id === selectedClassId);
      if (!selectedClass) return;

      const { data, error } = await supabase
        .from('curriculum')
        .select('*')
        .eq('grade_id', selectedClass.grade_id)
        .eq('subject_id', selectedSubjectId)
        .eq('school_year', selectedYear)
        .eq('week_number', weekNumber)
        .order('period_number', { ascending: true, nullsFirst: true });

      if (error) throw error;
      setCurriculumList(data || []);
      // Reset về dropdown nếu có dữ liệu
      if (data && data.length > 0 && !editingId) {
        setUseCustomLesson(false);
      }
    } catch (err) {
      console.error('Error loading curriculum:', err);
    }
  }

  async function handleSave() {
    if (!selectedClassId || !selectedSubjectId || !lessonName.trim()) {
      alert('Vui lòng chọn lớp, môn học và nhập tên bài học');
      return;
    }

    try {
      setSaving(true);

      if (editingId) {
        // Update existing
        const { error } = await supabase
          .from('teaching_diary')
          .update({
            period: selectedPeriod,
            week_number: weekNumber,
            lesson_name: lessonName.trim(),
            content: content.trim() || null,
            notes: notes.trim() || null,
          })
          .eq('id', editingId);

        if (error) throw error;
        alert('Cập nhật nhật ký thành công!');
      } else {
        // Check if entry exists for this date/period/class/subject
        const { data: existing } = await supabase
          .from('teaching_diary')
          .select('id')
          .eq('class_id', selectedClassId)
          .eq('subject_id', selectedSubjectId)
          .eq('date', selectedDate)
          .eq('period', selectedPeriod)
          .single();

        if (existing) {
          // Update
          const { error } = await supabase
            .from('teaching_diary')
            .update({
              week_number: weekNumber,
              lesson_name: lessonName.trim(),
              content: content.trim() || null,
              notes: notes.trim() || null,
              user_id: user?.id || null,
            })
            .eq('id', existing.id);

          if (error) throw error;
        } else {
          // Insert
          const { error } = await supabase
            .from('teaching_diary')
            .insert([{
              user_id: user?.id || null,
              class_id: selectedClassId,
              subject_id: selectedSubjectId,
              date: selectedDate,
              period: selectedPeriod,
              week_number: weekNumber,
              lesson_name: lessonName.trim(),
              content: content.trim() || null,
              notes: notes.trim() || null,
            }]);

          if (error) throw error;
        }
        alert('Lưu nhật ký thành công!');
      }

      // Reset form
      setLessonName('');
      setContent('');
      setNotes('');
      setEditingId(null);
      loadDiaryEntries();
    } catch (error) {
      console.error('Error saving diary:', error);
      alert('Lỗi khi lưu nhật ký');
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(entry: TeachingDiary) {
    setSelectedClassId(entry.class_id);
    setSelectedPeriod(entry.period);
    setWeekNumber(entry.week_number);
    setLessonName(entry.lesson_name);
    setContent(entry.content || '');
    setNotes(entry.notes || '');
    setEditingId(entry.id);
    setUseCustomLesson(true); // Khi sửa, luôn dùng text input
    setIsFormCollapsed(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Bạn có chắc muốn xóa nhật ký này?')) return;

    try {
      const { error } = await supabase
        .from('teaching_diary')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadDiaryEntries();
    } catch (error) {
      console.error('Error deleting diary:', error);
      alert('Lỗi khi xóa nhật ký');
    }
  }

  function handleCancelEdit() {
    setLessonName('');
    setContent('');
    setNotes('');
    setEditingId(null);
  }

  return (
    <div className="p-4 lg:p-8 pb-24">
      <div className="mb-4 lg:mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-800 flex items-center gap-2">
          <BookOpen className="text-purple-600" />
          Nhật ký tiết dạy
        </h1>
        <p className="text-sm lg:text-base text-gray-600 mt-1">Ghi chép nội dung bài dạy theo tiết</p>
      </div>

      {/* Form nhập nhật ký */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div
          onClick={() => setIsFormCollapsed(!isFormCollapsed)}
          className="flex items-center justify-between p-4 lg:p-6 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-200"
        >
          <div className="flex items-center gap-2">
            <h2 className="text-base lg:text-lg font-bold text-gray-800">
              {editingId ? 'Chỉnh sửa nhật ký' : 'Thêm nhật ký mới'}
            </h2>
            {isFormCollapsed && selectedClassId && (
              <span className="text-sm text-gray-600">
                {classes.find(c => c.id === selectedClassId)?.name} - {format(new Date(selectedDate), 'dd/MM/yyyy')} - Tiết {selectedPeriod}
              </span>
            )}
          </div>
          {isFormCollapsed ? <ChevronDown size={24} /> : <ChevronUp size={24} />}
        </div>

        {!isFormCollapsed && (
          <div className="p-4 lg:p-6 space-y-4">
            {/* Subject selector */}
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

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
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
                <label className="block text-sm font-semibold text-gray-700 mb-2">Lớp <span className="text-red-500">*</span></label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  disabled={!isAdmin && assignedSubjects.length > 1 && !selectedSubjectId}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm disabled:bg-gray-100"
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

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Ngày</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Tiết</label>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(Number(e.target.value))}
                  className="w-full px-3 py-2 border-2 border-orange-300 rounded-lg focus:border-orange-500 focus:outline-none text-sm bg-orange-50"
                >
                  {PERIODS.map((period) => (
                    <option key={period} value={period}>
                      Tiết {period} {period <= 4 ? '(Sáng)' : '(Chiều)'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Tuần học</label>
                <input
                  type="number"
                  min={1}
                  max={35}
                  value={weekNumber}
                  onChange={(e) => setWeekNumber(Number(e.target.value))}
                  className="w-full px-3 py-2 border-2 border-purple-300 rounded-lg focus:border-purple-500 focus:outline-none text-sm bg-purple-50"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Tên bài học <span className="text-red-500">*</span>
                </label>
                {curriculumList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setUseCustomLesson(!useCustomLesson);
                      if (!useCustomLesson) setLessonName('');
                    }}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {useCustomLesson ? '← Chọn từ chương trình' : 'Nhập tay...'}
                  </button>
                )}
              </div>
              {curriculumList.length > 0 && !useCustomLesson ? (
                <select
                  value={lessonName}
                  onChange={(e) => setLessonName(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-blue-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm bg-blue-50"
                >
                  <option value="">-- Chọn bài học từ chương trình --</option>
                  {curriculumList.map((c) => (
                    <option key={c.id} value={c.lesson_name}>
                      {c.period_number ? `Tiết ${c.period_number}: ` : ''}{c.lesson_name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={lessonName}
                  onChange={(e) => setLessonName(e.target.value)}
                  placeholder={curriculumList.length === 0 ? 'VD: Bài 4: Chèn ảnh vào văn bản (chưa có PPCT cho tuần này)' : 'Nhập tên bài học...'}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
                />
              )}
              {curriculumList.length === 0 && selectedClassId && selectedSubjectId && (
                <p className="text-xs text-amber-600 mt-1">
                  ⚠ Chưa có phân phối chương trình cho tuần {weekNumber}. Admin có thể thêm tại mục "Phân phối chương trình".
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Nội dung bài dạy</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Mô tả chi tiết nội dung đã dạy..."
                rows={3}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Ghi chú</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ghi chú thêm (nếu có)..."
                rows={2}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm resize-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving || !lessonName.trim()}
                className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                <Save size={18} />
                {saving ? 'Đang lưu...' : editingId ? 'Cập nhật' : 'Lưu nhật ký'}
              </button>
              {editingId && (
                <button
                  onClick={handleCancelEdit}
                  className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-semibold"
                >
                  Hủy
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Danh sách nhật ký trong ngày */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 lg:p-6 border-b border-gray-200">
          <h2 className="text-base lg:text-lg font-bold text-gray-800">
            Nhật ký ngày {format(new Date(selectedDate), 'dd/MM/yyyy', { locale: vi })}
          </h2>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : diaryEntries.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <BookOpen size={48} className="mx-auto mb-4 opacity-30" />
            <p>Chưa có nhật ký nào cho ngày này</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {diaryEntries.map((entry) => (
              <div key={entry.id} className="p-4 lg:p-6 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-semibold rounded">
                        Tiết {entry.period}
                      </span>
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded">
                        Tuần {entry.week_number}
                      </span>
                      <span className="text-sm text-gray-500">
                        {(entry as any).classes?.grades?.name} - {(entry as any).classes?.name}
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-800 text-lg">{entry.lesson_name}</h3>
                    {entry.content && (
                      <p className="text-gray-600 mt-1 text-sm whitespace-pre-line">{entry.content}</p>
                    )}
                    {entry.notes && (
                      <p className="text-gray-500 mt-2 text-sm italic">Ghi chú: {entry.notes}</p>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleEdit(entry)}
                      className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                      title="Chỉnh sửa"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                      title="Xóa"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
