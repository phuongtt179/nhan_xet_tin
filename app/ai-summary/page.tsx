'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Class } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { Sparkles, Loader2, Save, Check } from 'lucide-react';
import { format, endOfMonth } from 'date-fns';

interface StudentRef {
  id: string;
  name: string;
  computer_name: string | null;
}

interface SummaryResult {
  student_id: string;
  student_name: string;
  computer_name: string | null;
  note_count: number;
  absent_count: number;
  forgot_count: number;
  competency_text: string;
  character_text: string | null;
  overall_rating: 'Hoàn thành tốt' | 'Hoàn thành' | 'Chưa hoàn thành';
  overall_reason: string;
  error?: string;
}

const RATING_OPTIONS: SummaryResult['overall_rating'][] = ['Hoàn thành tốt', 'Hoàn thành', 'Chưa hoàn thành'];

const RATING_COLOR: Record<string, string> = {
  'Hoàn thành tốt': 'text-green-700 bg-green-50 border-green-300',
  'Hoàn thành': 'text-blue-700 bg-blue-50 border-blue-300',
  'Chưa hoàn thành': 'text-red-700 bg-red-50 border-red-300',
};

export default function AiSummaryPage() {
  const { user, isAdmin, getAssignedClassIds } = useAuth();

  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [students, setStudents] = useState<StudentRef[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');

  const [mode, setMode] = useState<'student' | 'class'>('student');
  const [periodType, setPeriodType] = useState<'month' | 'range'>('month');
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [rangeStart, setRangeStart] = useState(format(new Date(), 'yyyy-MM-01'));
  const [rangeEnd, setRangeEnd] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [results, setResults] = useState<SummaryResult[]>([]);
  const [edited, setEdited] = useState<Record<string, { competency: string; character: string; rating: string }>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [includeCharacter, setIncludeCharacter] = useState(false);

  useEffect(() => {
    loadClasses();
  }, [isAdmin]);

  useEffect(() => {
    if (selectedClassId) loadStudents();
    else setStudents([]);
    setSelectedStudentId('');
    setResults([]);
  }, [selectedClassId]);

  async function loadClasses() {
    try {
      setLoadingClasses(true);
      const assignedIds = isAdmin ? null : getAssignedClassIds();
      let q = supabase.from('classes').select('*, grades(id,name)').order('name');
      if (!isAdmin && assignedIds && assignedIds.length > 0) q = q.in('id', assignedIds);
      else if (!isAdmin) q = q.in('id', ['no-match']);
      const { data } = await q;
      setClasses(data || []);
      if (data && data.length > 0 && !selectedClassId) setSelectedClassId(data[0].id);
    } finally {
      setLoadingClasses(false);
    }
  }

  async function loadStudents() {
    const { data } = await supabase
      .from('students')
      .select('id, name, computer_name')
      .eq('class_id', selectedClassId)
      .order('computer_name', { ascending: true, nullsFirst: false });
    setStudents(data || []);
  }

  function getDateRange(): { startDate: string; endDate: string; periodLabel: string } {
    if (periodType === 'month') {
      const start = `${month}-01`;
      const end = format(endOfMonth(new Date(`${month}-01`)), 'yyyy-MM-dd');
      const [y, m] = month.split('-');
      return { startDate: start, endDate: end, periodLabel: `Tháng ${Number(m)}/${y}` };
    }
    return {
      startDate: rangeStart,
      endDate: rangeEnd,
      periodLabel: `${format(new Date(rangeStart), 'dd/MM/yyyy')} - ${format(new Date(rangeEnd), 'dd/MM/yyyy')}`,
    };
  }

  async function handleGenerate() {
    if (!selectedClassId) {
      alert('Vui lòng chọn lớp');
      return;
    }
    if (mode === 'student' && !selectedStudentId) {
      alert('Vui lòng chọn học sinh');
      return;
    }

    const { startDate, endDate, periodLabel } = getDateRange();
    setGenerating(true);
    setResults([]);
    setSaved({});

    try {
      const res = await fetch('/api/ai-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          studentId: mode === 'student' ? selectedStudentId : undefined,
          classId: selectedClassId,
          isAdmin,
          startDate,
          endDate,
          periodLabel,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error === 'no_api_key' ? 'Chưa cấu hình GEMINI_API_KEY.' : 'Có lỗi khi tạo tổng hợp.');
        return;
      }
      const list: SummaryResult[] = data.results || [];
      setResults(list);
      setIncludeCharacter(!!data.includeCharacter);
      const editMap: Record<string, { competency: string; character: string; rating: string }> = {};
      list.forEach((r) => {
        editMap[r.student_id] = {
          competency: r.competency_text,
          character: r.character_text || '',
          rating: r.overall_rating,
        };
      });
      setEdited(editMap);
    } catch {
      alert('Không kết nối được máy chủ.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave(result: SummaryResult) {
    const e = edited[result.student_id];
    if (!e) return;

    let content = `[Năng lực] ${e.competency}`;
    if (includeCharacter && e.character) content += `\n[Phẩm chất] ${e.character}`;
    content += `\n[Xếp loại] ${e.rating}`;

    const { error } = await supabase.from('student_notes').insert([
      {
        student_id: result.student_id,
        class_id: selectedClassId,
        subject_id: null,
        user_id: user?.id || null,
        date: format(new Date(), 'yyyy-MM-dd'),
        content,
        category: periodType === 'month' ? 'summary_month' : 'summary_semester',
      },
    ]);

    if (error) {
      alert('Lỗi khi lưu: ' + error.message);
      return;
    }
    setSaved((prev) => ({ ...prev, [result.student_id]: true }));
  }

  return (
    <div className="p-4 lg:p-8 pb-24">
      <div className="mb-4 lg:mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-800 flex items-center gap-2">
          <Sparkles className="text-purple-600" />
          Tổng hợp AI
        </h1>
        <p className="text-sm lg:text-base text-gray-600 mt-1">
          AI tổng hợp nhận xét, điểm danh, quên đồ theo tháng/kỳ — phân loại Năng lực/Phẩm chất theo Thông tư 27
        </p>
      </div>

      <div className="bg-white rounded-lg shadow mb-6 p-4 lg:p-6 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Chế độ</label>
            <div className="flex gap-2">
              <button
                onClick={() => setMode('student')}
                className={`flex-1 px-4 py-2 rounded-lg border-2 text-sm font-medium ${mode === 'student' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white border-gray-300 text-gray-700'}`}
              >
                Theo học sinh
              </button>
              <button
                onClick={() => setMode('class')}
                className={`flex-1 px-4 py-2 rounded-lg border-2 text-sm font-medium ${mode === 'class' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white border-gray-300 text-gray-700'}`}
              >
                Theo cả lớp
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Khoảng thời gian</label>
            <div className="flex gap-2">
              <button
                onClick={() => setPeriodType('month')}
                className={`flex-1 px-4 py-2 rounded-lg border-2 text-sm font-medium ${periodType === 'month' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white border-gray-300 text-gray-700'}`}
              >
                Theo tháng
              </button>
              <button
                onClick={() => setPeriodType('range')}
                className={`flex-1 px-4 py-2 rounded-lg border-2 text-sm font-medium ${periodType === 'range' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white border-gray-300 text-gray-700'}`}
              >
                Theo khoảng ngày (kỳ...)
              </button>
            </div>
          </div>
        </div>

        {periodType === 'month' ? (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Tháng</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none text-sm"
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Từ ngày</label>
              <input
                type="date"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Đến ngày</label>
              <input
                type="date"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none text-sm"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Lớp</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              disabled={loadingClasses}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none text-sm"
            >
              <option value="">-- Chọn lớp --</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {(c as any).grades?.name} - {c.name}
                </option>
              ))}
            </select>
          </div>

          {mode === 'student' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Học sinh</label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                disabled={!selectedClassId}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none text-sm disabled:bg-gray-100"
              >
                <option value="">-- Chọn học sinh --</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.computer_name ? `${s.computer_name} - ` : ''}
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold disabled:bg-gray-300"
        >
          {generating ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
          {generating ? 'Đang tạo tổng hợp...' : 'Tạo tổng hợp AI'}
        </button>
      </div>

      {results.length > 0 && (
        <div className="space-y-4">
          {results.map((r) => {
            const e = edited[r.student_id] || { competency: '', character: '', rating: r.overall_rating };
            return (
              <div key={r.student_id} className="bg-white rounded-lg shadow p-4 lg:p-6 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="font-bold text-lg text-gray-800">
                      {r.computer_name ? `${r.computer_name} - ` : ''}
                      {r.student_name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {r.note_count} nhận xét · {r.absent_count} buổi vắng · {r.forgot_count} lần quên đồ
                    </div>
                  </div>
                  <select
                    value={e.rating}
                    onChange={(ev) =>
                      setEdited((prev) => ({ ...prev, [r.student_id]: { ...e, rating: ev.target.value } }))
                    }
                    className={`px-3 py-1.5 rounded-lg border-2 font-medium text-sm ${RATING_COLOR[e.rating] || ''}`}
                  >
                    {RATING_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                {r.error ? (
                  <div className="text-sm text-red-600">
                    Lỗi khi tạo tổng hợp cho học sinh này (
                    {r.error === 'quota_rpd' ? 'hết lượt Gemini hôm nay' : r.error === 'quota_rpm' ? 'gọi quá nhanh' : 'lỗi không rõ'}
                    ).
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Năng lực</label>
                      <textarea
                        value={e.competency}
                        onChange={(ev) =>
                          setEdited((prev) => ({ ...prev, [r.student_id]: { ...e, competency: ev.target.value } }))
                        }
                        rows={3}
                        className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none text-sm resize-none"
                      />
                    </div>
                    {includeCharacter && (
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Phẩm chất (GVCN)</label>
                        <textarea
                          value={e.character}
                          onChange={(ev) =>
                            setEdited((prev) => ({ ...prev, [r.student_id]: { ...e, character: ev.target.value } }))
                          }
                          rows={3}
                          className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none text-sm resize-none"
                        />
                      </div>
                    )}
                    {r.overall_reason && <p className="text-xs text-gray-500 italic">Gợi ý xếp loại: {r.overall_reason}</p>}

                    <button
                      onClick={() => handleSave(r)}
                      disabled={saved[r.student_id]}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm disabled:bg-green-600"
                    >
                      {saved[r.student_id] ? <Check size={16} /> : <Save size={16} />}
                      {saved[r.student_id] ? 'Đã lưu' : 'Lưu bản tổng hợp này'}
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
