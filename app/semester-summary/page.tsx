'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Class, Subject } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { getWeek } from 'date-fns';
import { GraduationCap, FileDown, Loader2 } from 'lucide-react';
import { printSemesterSummary } from '@/lib/printUtils';

// ── Tính tuần học (đồng bộ với teaching-diary) ──────────────────────────────
const SCHOOL_YEAR_START_WEEK = 38;

function getSchoolWeek(date: Date): number {
  const w = getWeek(date, { weekStartsOn: 1 });
  return w >= SCHOOL_YEAR_START_WEEK
    ? w - SCHOOL_YEAR_START_WEEK + 1
    : (52 - SCHOOL_YEAR_START_WEEK) + w + 1;
}

// ── Nhãn ngắn cho PDF / bảng ─────────────────────────────────────────────────
const SHORT_LABEL: Record<string, string> = {
  'Hoàn thành tốt': 'T',
  'Hoàn thành': 'H',
  'Chưa hoàn thành': 'C',
};

const LONG_LABEL: Record<string, string> = {
  'Hoàn thành tốt': 'Hoàn thành tốt',
  'Hoàn thành': 'Hoàn thành',
  'Chưa hoàn thành': 'Chưa hoàn thành',
};

const LABEL_COLOR: Record<string, string> = {
  'Hoàn thành tốt': 'text-green-700 bg-green-50',
  'Hoàn thành': 'text-blue-700 bg-blue-50',
  'Chưa hoàn thành': 'text-red-700 bg-red-50',
};

// ── Tính kết quả từ danh sách rating (1-4) ───────────────────────────────────
function calcResult(ratings: number[]): string {
  const valid = ratings.filter(r => r > 0);
  if (valid.length === 0) return '';
  const n = valid.length;
  const goodPlus = valid.filter(r => r >= 3).length;
  const notDone = valid.filter(r => r === 1).length;
  if (goodPlus >= n * 0.75 && notDone === 0) return 'Hoàn thành tốt';
  if (notDone >= n * 0.5) return 'Chưa hoàn thành';
  return 'Hoàn thành';
}

// ── Interfaces ────────────────────────────────────────────────────────────────
interface StudentRow {
  id: string;
  name: string;
  computer_name: string | null;
  weeks: Record<number, string>; // weekNum → result label
  total: string;
}

export default function SemesterSummaryPage() {
  const { isAdmin, getAssignedClassIds, getAssignedSubjects } = useAuth();

  const [classes, setClasses] = useState<Class[]>([]);
  const [assignedSubjects, setAssignedSubjects] = useState<Subject[]>([]);

  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [weekFrom, setWeekFrom] = useState<number>(1);
  const [weekTo, setWeekTo] = useState<number>(18);

  const [rows, setRows] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  // ── Load danh sách môn / lớp ───────────────────────────────────────────────
  useEffect(() => {
    if (isAdmin) {
      loadAllSubjects();
    } else {
      const s = getAssignedSubjects();
      setAssignedSubjects(s);
      if (s.length === 1) setSelectedSubjectId(s[0].id);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadClasses();
    setSelectedClassId('');
    setGenerated(false);
  }, [selectedSubjectId, isAdmin]);

  async function loadAllSubjects() {
    const { data } = await supabase.from('subjects').select('*').eq('is_active', true).order('name');
    setAssignedSubjects(data || []);
    if (data && data.length > 0) setSelectedSubjectId(data[0].id);
  }

  async function loadClasses() {
    const assignedIds = isAdmin ? null : getAssignedClassIds(selectedSubjectId);
    let q = supabase.from('classes').select('*, grades(id,name)').order('name');
    if (!isAdmin && assignedIds && assignedIds.length > 0) q = q.in('id', assignedIds);
    else if (!isAdmin) q = q.in('id', ['no-match']);
    const { data } = await q;
    setClasses(data || []);
  }

  // ── Tạo bảng tổng hợp ─────────────────────────────────────────────────────
  async function generate() {
    if (!selectedClassId || !selectedSubjectId) {
      alert('Vui lòng chọn lớp và môn học');
      return;
    }
    if (weekFrom > weekTo) {
      alert('Tuần bắt đầu phải nhỏ hơn hoặc bằng tuần kết thúc');
      return;
    }

    setLoading(true);
    setGenerated(false);
    try {
      // 1. Lấy học sinh
      const { data: students } = await supabase
        .from('students')
        .select('id, name, computer_name')
        .eq('class_id', selectedClassId)
        .order('name');

      if (!students || students.length === 0) {
        alert('Lớp này chưa có học sinh');
        setLoading(false);
        return;
      }

      // 2. Lấy criteria thuộc môn đã chọn (qua topic → subject)
      const { data: classData } = await supabase
        .from('classes').select('grade_id').eq('id', selectedClassId).single();
      if (!classData) return;

      const { data: topics } = await supabase
        .from('topics')
        .select('id')
        .eq('grade_id', classData.grade_id)
        .eq('subject_id', selectedSubjectId);

      const topicIds = (topics || []).map(t => t.id);
      let criteriaIds: string[] = [];
      if (topicIds.length > 0) {
        const { data: criteria } = await supabase
          .from('criteria').select('id').in('topic_id', topicIds);
        criteriaIds = (criteria || []).map(c => c.id);
      }

      // 3. Lấy tất cả evaluations của lớp
      let evalQuery = supabase
        .from('evaluations')
        .select('student_id, criterion_id, rating, evaluated_date')
        .eq('class_id', selectedClassId)
        .in('student_id', students.map(s => s.id));

      if (criteriaIds.length > 0) evalQuery = evalQuery.in('criterion_id', criteriaIds);

      const { data: evals } = await evalQuery;

      // 4. Nhóm evaluations theo student_id + school_week
      const byStudentWeek: Record<string, Record<number, number[]>> = {};
      for (const e of evals || []) {
        const week = getSchoolWeek(new Date(e.evaluated_date));
        if (week < weekFrom || week > weekTo) continue;
        if (!byStudentWeek[e.student_id]) byStudentWeek[e.student_id] = {};
        if (!byStudentWeek[e.student_id][week]) byStudentWeek[e.student_id][week] = [];
        byStudentWeek[e.student_id][week].push(e.rating);
      }

      // 5. Build rows
      const weekRange = Array.from({ length: weekTo - weekFrom + 1 }, (_, i) => weekFrom + i);

      const result: StudentRow[] = students.map(s => {
        const weekMap = byStudentWeek[s.id] || {};
        const weeks: Record<number, string> = {};
        const allRatings: number[] = [];

        for (const w of weekRange) {
          const ratings = weekMap[w] || [];
          weeks[w] = calcResult(ratings);
          allRatings.push(...ratings);
        }

        return {
          id: s.id,
          name: s.name,
          computer_name: s.computer_name,
          weeks,
          total: calcResult(allRatings),
        };
      });

      setRows(result);
      setGenerated(true);
    } catch (err) {
      console.error(err);
      alert('Lỗi khi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }

  function handleExportPDF() {
    const cls = classes.find(c => c.id === selectedClassId);
    const sub = assignedSubjects.find(s => s.id === selectedSubjectId);
    if (!cls || !sub) return;

    printSemesterSummary({
      className: cls.name,
      gradeName: (cls as any).grades?.name || '',
      subjectName: sub.name,
      weekFrom,
      weekTo,
      rows,
    });
  }

  const weekRange = Array.from({ length: weekTo - weekFrom + 1 }, (_, i) => weekFrom + i);

  return (
    <div className="p-4 lg:p-8 pb-24">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-800 flex items-center gap-2">
            <GraduationCap className="text-violet-600" />
            Tổng hợp cuối kì
          </h1>
          <p className="text-sm text-gray-600 mt-1">Kết quả học sinh theo từng tuần trong kì</p>
        </div>
        {generated && rows.length > 0 && (
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-semibold text-sm"
          >
            <FileDown size={18} />
            Xuất PDF
          </button>
        )}
      </div>

      {/* Bộ lọc */}
      <div className="bg-white rounded-lg shadow p-4 lg:p-6 mb-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          {/* Môn học */}
          {assignedSubjects.length > 1 && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Môn học <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedSubjectId}
                onChange={e => { setSelectedSubjectId(e.target.value); setGenerated(false); }}
                className="w-full px-3 py-2 border-2 border-blue-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none bg-blue-50"
              >
                <option value="">-- Chọn môn --</option>
                {assignedSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}

          {/* Lớp */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Lớp <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedClassId}
              onChange={e => { setSelectedClassId(e.target.value); setGenerated(false); }}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:border-violet-500 focus:outline-none"
            >
              <option value="">-- Chọn lớp --</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {(c as any).grades?.name} - {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tuần từ */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Tuần từ</label>
            <input
              type="number" min={1} max={52}
              value={weekFrom}
              onChange={e => { setWeekFrom(Number(e.target.value)); setGenerated(false); }}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:border-violet-500 focus:outline-none"
            />
          </div>

          {/* Tuần đến */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Tuần đến</label>
            <div className="flex gap-2">
              <input
                type="number" min={1} max={52}
                value={weekTo}
                onChange={e => { setWeekTo(Number(e.target.value)); setGenerated(false); }}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:border-violet-500 focus:outline-none"
              />
              <button
                onClick={generate}
                disabled={loading || !selectedClassId || !selectedSubjectId}
                className="flex items-center gap-1 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-semibold text-sm whitespace-nowrap disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                {loading ? 'Đang tải...' : 'Tạo bảng'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bảng kết quả */}
      {!generated ? (
        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-400">
          <GraduationCap size={48} className="mx-auto mb-3 opacity-30" />
          <p>Chọn lớp, môn học và khoảng tuần rồi bấm <strong>Tạo bảng</strong></p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-bold text-gray-800">
              {(classes.find(c => c.id === selectedClassId) as any)?.grades?.name} - {classes.find(c => c.id === selectedClassId)?.name}
              &nbsp;·&nbsp; {assignedSubjects.find(s => s.id === selectedSubjectId)?.name}
              &nbsp;·&nbsp; Tuần {weekFrom} – {weekTo}
            </h2>
            <span className="text-sm text-gray-500">{rows.length} học sinh</span>
          </div>

          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-violet-600 text-white">
                <th className="px-3 py-2 text-center border border-violet-500 w-10">STT</th>
                <th className="px-3 py-2 text-left border border-violet-500 min-w-[150px]">Họ và tên</th>
                {weekRange.map(w => (
                  <th key={w} className="px-2 py-2 text-center border border-violet-500 min-w-[50px]">
                    T{w}
                  </th>
                ))}
                <th className="px-3 py-2 text-center border border-violet-500 min-w-[90px] bg-violet-800">Tổng</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-2 py-2 text-center border border-gray-200 text-gray-500">{idx + 1}</td>
                  <td className="px-3 py-2 text-left border border-gray-200 font-medium text-gray-800">
                    {row.name}
                    {row.computer_name && <span className="text-xs text-gray-400 ml-1">({row.computer_name})</span>}
                  </td>
                  {weekRange.map(w => {
                    const result = row.weeks[w] || '';
                    return (
                      <td key={w} className="px-1 py-2 text-center border border-gray-200">
                        {result ? (
                          <span className={`text-xs font-semibold px-1 py-0.5 rounded ${LABEL_COLOR[result] || ''}`}>
                            {SHORT_LABEL[result] || result}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">–</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 text-center border border-gray-200 bg-violet-50">
                    {row.total ? (
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${LABEL_COLOR[row.total] || ''}`}>
                        {LONG_LABEL[row.total] || row.total}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">–</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Chú thích */}
          <div className="p-4 border-t border-gray-100 text-xs text-gray-500 flex gap-4 flex-wrap">
            <span><span className="font-bold text-green-700">T</span> = Hoàn thành tốt</span>
            <span><span className="font-bold text-blue-700">H</span> = Hoàn thành</span>
            <span><span className="font-bold text-red-700">C</span> = Chưa hoàn thành</span>
            <span><span className="text-gray-300">–</span> = Chưa có dữ liệu</span>
          </div>
        </div>
      )}
    </div>
  );
}
