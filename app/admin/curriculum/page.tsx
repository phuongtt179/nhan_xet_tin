'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Grade, Subject, Curriculum } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {
  BookText, Plus, Edit2, Trash2, Save, X,
  ChevronDown, ChevronUp, Upload, FileSpreadsheet,
  CheckCircle, AlertCircle, Loader2
} from 'lucide-react';
import * as XLSX from 'xlsx';

// ─── Kiểu dữ liệu cho preview import ───────────────────────────────────────
interface ImportRow {
  rowIndex: number;
  gradeName: string;
  subjectName: string;
  weekNumber: number | null;
  periodNumber: number | null; // null = tất cả tiết
  lessonName: string;
  description: string;
  // Sau khi validate
  gradeId?: string;
  subjectId?: string;
  errors: string[];
}

export default function CurriculumPage() {
  const { isAdmin, loading } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [schoolYears, setSchoolYears] = useState<string[]>([]);

  const [filterGradeId, setFilterGradeId] = useState<string>('');
  const [filterSubjectId, setFilterSubjectId] = useState<string>('');
  const [filterYear, setFilterYear] = useState<string>('2025-2026');

  const [items, setItems] = useState<Curriculum[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set());

  // Form thêm/sửa đơn
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formGradeId, setFormGradeId] = useState<string>('');
  const [formSubjectId, setFormSubjectId] = useState<string>('');
  const [formYear, setFormYear] = useState<string>('2025-2026');
  const [formWeek, setFormWeek] = useState<number>(1);
  const [formPeriod, setFormPeriod] = useState<string>('');
  const [formLesson, setFormLesson] = useState<string>('');
  const [formDesc, setFormDesc] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Import Excel
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importYear, setImportYear] = useState<string>('2025-2026');
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);

  // ─── Auth guard ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!loading && !isAdmin) router.push('/');
  }, [isAdmin, loading, router]);

  useEffect(() => {
    loadGrades();
    loadSubjects();
    loadSchoolYears();
  }, []);

  useEffect(() => {
    if (filterGradeId && filterSubjectId) loadCurriculum();
    else setItems([]);
  }, [filterGradeId, filterSubjectId, filterYear]);

  // ─── Loaders ─────────────────────────────────────────────────────────────
  async function loadGrades() {
    const { data } = await supabase.from('grades').select('*').order('name');
    setGrades(data || []);
    if (data && data.length > 0) setFilterGradeId(data[0].id);
  }

  async function loadSubjects() {
    const { data } = await supabase.from('subjects').select('*').eq('is_active', true).order('name');
    setSubjects(data || []);
    if (data && data.length > 0) setFilterSubjectId(data[0].id);
  }

  async function loadSchoolYears() {
    const { data } = await supabase.from('classes').select('school_year').order('school_year', { ascending: false });
    const unique = Array.from(new Set(data?.map(c => c.school_year) || []));
    const list = unique.length > 0 ? unique : ['2025-2026'];
    setSchoolYears(list);
    setImportYear(list[0]);
  }

  async function loadCurriculum() {
    setLoadingData(true);
    try {
      const { data, error } = await supabase
        .from('curriculum')
        .select('*, grades(name), subjects(name)')
        .eq('grade_id', filterGradeId)
        .eq('subject_id', filterSubjectId)
        .eq('school_year', filterYear)
        .order('week_number', { ascending: true })
        .order('period_number', { ascending: true, nullsFirst: true });

      if (error) throw error;
      setItems(data || []);
      const weeks = new Set<number>((data || []).map(i => i.week_number));
      setExpandedWeeks(weeks);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingData(false);
    }
  }

  // ─── Form đơn ─────────────────────────────────────────────────────────────
  function openAddForm() {
    setEditingId(null);
    setFormGradeId(filterGradeId);
    setFormSubjectId(filterSubjectId);
    setFormYear(filterYear);
    setFormWeek(1);
    setFormPeriod('');
    setFormLesson('');
    setFormDesc('');
    setShowForm(true);
  }

  function openEditForm(item: Curriculum) {
    setEditingId(item.id);
    setFormGradeId(item.grade_id);
    setFormSubjectId(item.subject_id);
    setFormYear(item.school_year);
    setFormWeek(item.week_number);
    setFormPeriod(item.period_number?.toString() || '');
    setFormLesson(item.lesson_name);
    setFormDesc(item.description || '');
    setShowForm(true);
  }

  function closeForm() { setShowForm(false); setEditingId(null); }

  async function handleSave() {
    if (!formGradeId || !formSubjectId || !formLesson.trim()) {
      alert('Vui lòng chọn khối lớp, môn học và nhập tên bài học');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        grade_id: formGradeId,
        subject_id: formSubjectId,
        school_year: formYear,
        week_number: formWeek,
        period_number: formPeriod ? parseInt(formPeriod) : null,
        lesson_name: formLesson.trim(),
        description: formDesc.trim() || null,
      };
      if (editingId) {
        const { error } = await supabase.from('curriculum').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('curriculum').insert([payload]);
        if (error) throw error;
      }
      closeForm();
      loadCurriculum();
    } catch (err) {
      console.error(err);
      alert('Lỗi khi lưu. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Xóa bài học này khỏi phân phối chương trình?')) return;
    try {
      const { error } = await supabase.from('curriculum').delete().eq('id', id);
      if (error) throw error;
      loadCurriculum();
    } catch (err) {
      console.error(err);
      alert('Lỗi khi xóa');
    }
  }

  function toggleWeek(week: number) {
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(week)) next.delete(week); else next.add(week);
      return next;
    });
  }

  // ─── Import Excel ─────────────────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const wb = XLSX.read(data, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        // Đọc từ hàng 2 (bỏ header)
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        const parsed: ImportRow[] = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          // Bỏ qua hàng trống
          if (!row || row.every((c: any) => c === '' || c === null || c === undefined)) continue;

          const gradeName = String(row[0] || '').trim();
          const subjectName = String(row[1] || '').trim();
          const weekRaw = row[2];
          const periodRaw = String(row[3] || '').trim().toLowerCase();
          const lessonName = String(row[4] || '').trim();
          const description = String(row[5] || '').trim();

          const weekNumber = weekRaw !== '' && weekRaw !== null ? parseInt(String(weekRaw)) : null;
          let periodNumber: number | null = null;
          if (periodRaw !== '' && periodRaw !== 'all' && periodRaw !== 'tất cả') {
            periodNumber = parseInt(periodRaw) || null;
          }

          const errors: string[] = [];
          if (!gradeName) errors.push('Thiếu khối');
          if (!subjectName) errors.push('Thiếu môn');
          if (!weekNumber || isNaN(weekNumber) || weekNumber < 1) errors.push('Tuần không hợp lệ');
          if (!lessonName) errors.push('Thiếu tên bài');

          parsed.push({ rowIndex: i + 1, gradeName, subjectName, weekNumber, periodNumber, lessonName, description, errors });
        }

        // Validate grade & subject IDs
        const validated = parsed.map(r => {
          const gradeVal = r.gradeName.toLowerCase().replace(/\s+/g, '');
          const grade = grades.find(g => {
            const gName = g.name.toLowerCase().replace(/\s+/g, '');
            return (
              gName === gradeVal ||                          // "khối5" === "khối5"
              gName === `khối${gradeVal}` ||                // "khối5" === "khối" + "5"
              gName === `lớp${gradeVal}` ||                 // "lớp5" === "lớp" + "5"
              g.name.replace(/\D/g, '') === r.gradeName.replace(/\D/g, '') // chỉ lấy số: "5" === "5"
            );
          });
          const subjectVal = r.subjectName.toLowerCase().replace(/\s+/g, '');
          const subject = subjects.find(s => {
            const sName = s.name.toLowerCase().replace(/\s+/g, '');
            return sName === subjectVal || sName.includes(subjectVal) || subjectVal.includes(sName);
          });

          const errors = [...r.errors];
          if (!grade) errors.push(`Không tìm thấy khối "${r.gradeName}"`);
          if (!subject) errors.push(`Không tìm thấy môn "${r.subjectName}"`);

          return { ...r, gradeId: grade?.id, subjectId: subject?.id, errors };
        });

        setImportRows(validated);
        setImportDone(false);
        setShowImport(true);
      } catch (err) {
        console.error(err);
        alert('Lỗi đọc file Excel. Vui lòng kiểm tra định dạng file.');
      }
    };
    reader.readAsBinaryString(file);
    // Reset input để có thể chọn lại cùng file
    e.target.value = '';
  }

  async function handleImportConfirm() {
    const validRows = importRows.filter(r => r.errors.length === 0 && r.gradeId && r.subjectId);
    if (validRows.length === 0) {
      alert('Không có dòng hợp lệ nào để nhập');
      return;
    }

    setImporting(true);
    try {
      const payload = validRows.map(r => ({
        grade_id: r.gradeId!,
        subject_id: r.subjectId!,
        school_year: importYear,
        week_number: r.weekNumber!,
        period_number: r.periodNumber,
        lesson_name: r.lessonName,
        description: r.description || null,
      }));

      const { error } = await supabase.from('curriculum').insert(payload);
      if (error) throw error;

      setImportDone(true);
      loadCurriculum();
    } catch (err: any) {
      console.error('Import error:', err);
      const msg = err?.message || err?.details || err?.hint || JSON.stringify(err);
      alert(`Lỗi khi nhập dữ liệu:\n${msg}`);
    } finally {
      setImporting(false);
    }
  }

  function closeImport() {
    setShowImport(false);
    setImportRows([]);
    setImportDone(false);
  }

  // ─── Group by week ────────────────────────────────────────────────────────
  const byWeek: Record<number, Curriculum[]> = {};
  for (const item of items) {
    if (!byWeek[item.week_number]) byWeek[item.week_number] = [];
    byWeek[item.week_number].push(item);
  }
  const weeks = Object.keys(byWeek).map(Number).sort((a, b) => a - b);

  const validCount = importRows.filter(r => r.errors.length === 0).length;
  const errorCount = importRows.filter(r => r.errors.length > 0).length;

  if (loading) return null;

  return (
    <div className="p-4 lg:p-8 pb-24">
      <div className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-800 flex items-center gap-2">
          <BookText className="text-indigo-600" />
          Phân phối chương trình
        </h1>
        <p className="text-sm text-gray-600 mt-1">Quản lý danh sách bài học theo tuần cho từng khối lớp</p>
      </div>

      {/* Filters + Actions */}
      <div className="bg-white rounded-lg shadow p-4 mb-4 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Năm học</label>
          <select value={filterYear} onChange={e => setFilterYear(e.target.value)}
            className="px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:border-indigo-500 focus:outline-none">
            {schoolYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Khối lớp <span className="text-red-500">*</span></label>
          <select value={filterGradeId} onChange={e => setFilterGradeId(e.target.value)}
            className="px-3 py-2 border-2 border-indigo-300 rounded-lg text-sm focus:border-indigo-500 focus:outline-none bg-indigo-50">
            <option value="">-- Chọn khối --</option>
            {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Môn học <span className="text-red-500">*</span></label>
          <select value={filterSubjectId} onChange={e => setFilterSubjectId(e.target.value)}
            className="px-3 py-2 border-2 border-indigo-300 rounded-lg text-sm focus:border-indigo-500 focus:outline-none bg-indigo-50">
            <option value="">-- Chọn môn --</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="flex gap-2 ml-auto">
          {/* Nhập từ Excel */}
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-semibold text-sm"
          >
            <FileSpreadsheet size={18} />
            Nhập từ Excel
          </button>
          <button
            onClick={openAddForm}
            disabled={!filterGradeId || !filterSubjectId}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
          >
            <Plus size={18} />
            Thêm bài học
          </button>
        </div>
      </div>

      {/* Hướng dẫn định dạng Excel */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 mb-4 text-sm text-emerald-800">
        <strong>Định dạng file Excel:</strong> Hàng đầu là tiêu đề, từ hàng 2 trở đi là dữ liệu.
        Các cột theo thứ tự: <code className="bg-emerald-100 px-1 rounded">A: Khối</code> &nbsp;
        <code className="bg-emerald-100 px-1 rounded">B: Môn</code> &nbsp;
        <code className="bg-emerald-100 px-1 rounded">C: Tuần</code> &nbsp;
        <code className="bg-emerald-100 px-1 rounded">D: Tiết</code> (số hoặc "all") &nbsp;
        <code className="bg-emerald-100 px-1 rounded">E: Tên bài</code> &nbsp;
        <code className="bg-emerald-100 px-1 rounded">F: Mô tả</code> (tùy chọn)
      </div>

      {/* Form thêm/sửa đơn */}
      {showForm && (
        <div className="bg-white rounded-lg shadow border-2 border-indigo-200 p-4 lg:p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800 text-lg">{editingId ? 'Chỉnh sửa bài học' : 'Thêm bài học mới'}</h2>
            <button onClick={closeForm} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} className="text-gray-500" /></button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Khối lớp</label>
              <select value={formGradeId} onChange={e => setFormGradeId(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:border-indigo-500 focus:outline-none">
                {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Môn học</label>
              <select value={formSubjectId} onChange={e => setFormSubjectId(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:border-indigo-500 focus:outline-none">
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Tuần học</label>
              <input type="number" min={1} max={52} value={formWeek} onChange={e => setFormWeek(Number(e.target.value))}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:border-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Tiết (tùy chọn)</label>
              <select value={formPeriod} onChange={e => setFormPeriod(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:border-indigo-500 focus:outline-none">
                <option value="">Tất cả tiết</option>
                {[1, 2, 3, 4, 5, 6, 7].map(p => <option key={p} value={p}>Tiết {p}</option>)}
              </select>
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Tên bài học <span className="text-red-500">*</span></label>
            <input type="text" value={formLesson} onChange={e => setFormLesson(e.target.value)}
              placeholder="VD: Bài 5: Tạo chương trình có phông nền thay đổi"
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:border-indigo-500 focus:outline-none" />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Mô tả (tùy chọn)</label>
            <textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} rows={2}
              placeholder="Mô tả nội dung bài học..."
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:border-indigo-500 focus:outline-none resize-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving || !formLesson.trim()}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold text-sm disabled:bg-gray-300 disabled:cursor-not-allowed">
              <Save size={16} />
              {saving ? 'Đang lưu...' : editingId ? 'Cập nhật' : 'Lưu'}
            </button>
            <button onClick={closeForm} className="px-5 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold text-sm">Hủy</button>
          </div>
        </div>
      )}

      {/* Danh sách */}
      {!filterGradeId || !filterSubjectId ? (
        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-400">
          <BookText size={48} className="mx-auto mb-3 opacity-30" />
          <p>Chọn khối lớp và môn học để xem phân phối chương trình</p>
        </div>
      ) : loadingData ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-400">
          <BookText size={48} className="mx-auto mb-3 opacity-30" />
          <p>Chưa có phân phối chương trình nào</p>
          <button onClick={openAddForm} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700">
            Thêm bài học đầu tiên
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {weeks.map(week => (
            <div key={week} className="bg-white rounded-lg shadow overflow-hidden">
              <div onClick={() => toggleWeek(week)}
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 bg-indigo-100 text-indigo-800 text-sm font-bold rounded-full">Tuần {week}</span>
                  <span className="text-sm text-gray-500">{byWeek[week].length} bài</span>
                </div>
                {expandedWeeks.has(week) ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
              </div>
              {expandedWeeks.has(week) && (
                <div className="divide-y divide-gray-50">
                  {byWeek[week].map(item => (
                    <div key={item.id} className="flex items-start justify-between px-4 py-3 hover:bg-gray-50">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {item.period_number && (
                            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-semibold rounded">Tiết {item.period_number}</span>
                          )}
                          <span className="font-medium text-gray-800 text-sm">{item.lesson_name}</span>
                        </div>
                        {item.description && <p className="text-xs text-gray-500">{item.description}</p>}
                      </div>
                      <div className="flex gap-1 ml-3 shrink-0">
                        <button onClick={() => openEditForm(item)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors" title="Sửa">
                          <Edit2 size={15} />
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors" title="Xóa">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Modal Preview Import ─────────────────────────────────────────── */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <FileSpreadsheet className="text-emerald-600" size={22} />
                  Xem trước dữ liệu nhập
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {importRows.length} dòng &nbsp;·&nbsp;
                  <span className="text-emerald-600 font-semibold">{validCount} hợp lệ</span>
                  {errorCount > 0 && <><span className="mx-1">·</span><span className="text-red-500 font-semibold">{errorCount} lỗi</span></>}
                </p>
              </div>
              <button onClick={closeImport} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>

            {/* Năm học */}
            {!importDone && (
              <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-3">
                <label className="text-sm font-semibold text-gray-700">Nhập vào năm học:</label>
                <select value={importYear} onChange={e => setImportYear(e.target.value)}
                  className="px-3 py-1.5 border-2 border-indigo-300 rounded-lg text-sm focus:border-indigo-500 focus:outline-none bg-indigo-50">
                  {schoolYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            )}

            {/* Thành công */}
            {importDone ? (
              <div className="flex-1 flex flex-col items-center justify-center py-16 gap-4">
                <CheckCircle size={56} className="text-emerald-500" />
                <p className="text-lg font-semibold text-gray-800">Nhập dữ liệu thành công!</p>
                <p className="text-gray-500 text-sm">{validCount} bài học đã được thêm vào chương trình.</p>
                <button onClick={closeImport} className="mt-2 px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700">
                  Đóng
                </button>
              </div>
            ) : (
              <>
                {/* Table preview */}
                <div className="flex-1 overflow-auto px-4 py-3">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-100 text-gray-700">
                        <th className="px-3 py-2 text-left font-semibold border border-gray-200 w-10">#</th>
                        <th className="px-3 py-2 text-left font-semibold border border-gray-200">Khối</th>
                        <th className="px-3 py-2 text-left font-semibold border border-gray-200">Môn</th>
                        <th className="px-3 py-2 text-center font-semibold border border-gray-200 w-16">Tuần</th>
                        <th className="px-3 py-2 text-center font-semibold border border-gray-200 w-16">Tiết</th>
                        <th className="px-3 py-2 text-left font-semibold border border-gray-200">Tên bài học</th>
                        <th className="px-3 py-2 text-left font-semibold border border-gray-200">Mô tả</th>
                        <th className="px-3 py-2 text-center font-semibold border border-gray-200 w-24">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.map(row => {
                        const isValid = row.errors.length === 0;
                        return (
                          <tr key={row.rowIndex} className={isValid ? 'bg-white hover:bg-gray-50' : 'bg-red-50'}>
                            <td className="px-3 py-2 border border-gray-200 text-gray-400 text-xs">{row.rowIndex}</td>
                            <td className="px-3 py-2 border border-gray-200">
                              <span className={!row.gradeId ? 'text-red-600 font-semibold' : ''}>{row.gradeName || '—'}</span>
                            </td>
                            <td className="px-3 py-2 border border-gray-200">
                              <span className={!row.subjectId ? 'text-red-600 font-semibold' : ''}>{row.subjectName || '—'}</span>
                            </td>
                            <td className="px-3 py-2 border border-gray-200 text-center">
                              <span className={!row.weekNumber ? 'text-red-600 font-semibold' : ''}>{row.weekNumber ?? '—'}</span>
                            </td>
                            <td className="px-3 py-2 border border-gray-200 text-center text-gray-600">
                              {row.periodNumber ?? <span className="text-gray-400 text-xs">all</span>}
                            </td>
                            <td className="px-3 py-2 border border-gray-200">
                              <span className={!row.lessonName ? 'text-red-600 font-semibold' : ''}>{row.lessonName || '—'}</span>
                            </td>
                            <td className="px-3 py-2 border border-gray-200 text-gray-500 text-xs">{row.description || ''}</td>
                            <td className="px-3 py-2 border border-gray-200 text-center">
                              {isValid ? (
                                <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-semibold">
                                  <CheckCircle size={14} /> Hợp lệ
                                </span>
                              ) : (
                                <span title={row.errors.join('\n')}
                                  className="inline-flex items-center gap-1 text-red-500 text-xs font-semibold cursor-help">
                                  <AlertCircle size={14} /> Lỗi
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Footer actions */}
                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
                  <p className="text-sm text-gray-500">
                    {errorCount > 0 && `${errorCount} dòng lỗi sẽ bị bỏ qua. `}
                    Sẽ nhập <strong>{validCount}</strong> dòng hợp lệ.
                  </p>
                  <div className="flex gap-2">
                    <button onClick={closeImport} className="px-5 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold text-sm">
                      Hủy
                    </button>
                    <button
                      onClick={handleImportConfirm}
                      disabled={importing || validCount === 0}
                      className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold text-sm disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      {importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                      {importing ? 'Đang nhập...' : `Nhập ${validCount} bài học`}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
