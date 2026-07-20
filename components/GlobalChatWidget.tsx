'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { MessageCircle, X, Save, Check } from 'lucide-react';
import { format, getWeek } from 'date-fns';

// Đồng bộ với app/teaching-diary/page.tsx — tuần học bắt đầu từ ISO week 38 (khoảng 15/9)
const SCHOOL_YEAR_START_WEEK = 38;
function getSchoolWeek(date: Date): number {
  const w = getWeek(date, { weekStartsOn: 1 });
  return w >= SCHOOL_YEAR_START_WEEK ? w - SCHOOL_YEAR_START_WEEK + 1 : 52 - SCHOOL_YEAR_START_WEEK + w + 1;
}

interface GlobalStudent {
  id: string;
  name: string;
  computer_name: string | null;
  class_id: string;
  class_name: string;
}

interface ChatAction {
  type: 'attendance' | 'equipment_check' | 'student_note' | 'lesson_note' | 'request_summary';
  student_id: string;
  class_id: string;
  description: string;
  is_absent?: boolean;
  period?: number;
  forgot_equipment?: boolean;
  note?: string;
  content?: string;
  lesson_name?: string;
  lesson_content?: string;
  start_date?: string;
  end_date?: string;
  period_label?: string;
}

interface SummaryResultData {
  student_id: string;
  class_id: string;
  student_name: string;
  competency_text: string;
  character_text: string | null;
  overall_rating: string;
  overall_reason: string;
  includeCharacter: boolean;
  period_label: string;
  error?: string;
}

interface ChatMessage {
  id: string;
  kind: 'user' | 'ai-text' | 'ai-action-proposal' | 'ai-summary-result' | 'system';
  text?: string;
  actions?: ChatAction[];
  summary?: SummaryResultData;
  resolved?: boolean;
}

const RATING_OPTIONS = ['Hoàn thành tốt', 'Hoàn thành', 'Chưa hoàn thành'];

function studentLabel(roster: GlobalStudent[], studentId: string): string {
  const s = roster.find((s) => s.id === studentId);
  return s ? `${s.name} (${s.class_name})` : `#${studentId}`;
}

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `gmsg-${Date.now()}-${idCounter}`;
}

export default function GlobalChatWidget() {
  const { user, isAdmin, assignments, loading: authLoading } = useAuth();
  const [open, setOpen] = useState(false);
  const [roster, setRoster] = useState<GlobalStudent[]>([]);
  const [rosterLoaded, setRosterLoaded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [summaryEdits, setSummaryEdits] = useState<
    Record<string, { competency: string; character: string; rating: string }>
  >({});
  const [summarySaved, setSummarySaved] = useState<Record<string, boolean>>({});

  if (authLoading || !user) return null;

  async function loadRoster() {
    let classList: { id: string; name: string }[] = [];

    if (isAdmin) {
      const { data } = await supabase.from('classes').select('id, name');
      classList = data || [];
    } else {
      const map = new Map<string, string>();
      assignments.forEach((a) => {
        if (a.classes) map.set(a.class_id, a.classes.name);
      });
      classList = Array.from(map, ([id, name]) => ({ id, name }));
    }

    if (classList.length === 0) {
      setRoster([]);
      setRosterLoaded(true);
      return;
    }

    const { data: studentsData } = await supabase
      .from('students')
      .select('id, name, computer_name, class_id')
      .in('class_id', classList.map((c) => c.id))
      .order('computer_name', { ascending: true, nullsFirst: false });

    const classNameById = new Map(classList.map((c) => [c.id, c.name]));
    const built: GlobalStudent[] = (studentsData || []).map((s) => ({
      id: s.id,
      name: s.name,
      computer_name: s.computer_name,
      class_id: s.class_id,
      class_name: classNameById.get(s.class_id) || '',
    }));
    setRoster(built);
    setRosterLoaded(true);
  }

  function handleOpen() {
    setOpen(true);
    if (!rosterLoaded) loadRoster();
  }

  function appendMessage(msg: ChatMessage) {
    setMessages((prev) => [...prev, msg]);
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    appendMessage({ id: nextId(), kind: 'user', text });
    setInput('');
    setSending(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          pageType: 'global',
          date: format(new Date(), 'yyyy-MM-dd'),
          globalStudents: roster,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        let errText = 'Có lỗi xảy ra, thử lại sau.';
        if (data.error === 'quota_rpd') errText = 'Đã hết lượt Gemini hôm nay, thử lại vào ngày mai.';
        else if (data.error === 'quota_rpm') errText = 'Đang gọi hơi nhanh, thử lại sau ít phút.';
        else if (data.error === 'no_api_key') errText = 'Chưa cấu hình GEMINI_API_KEY.';
        appendMessage({ id: nextId(), kind: 'ai-text', text: errText });
        return;
      }

      const actions: ChatAction[] = Array.isArray(data.actions) ? data.actions : [];
      if (actions.length > 0) {
        appendMessage({ id: nextId(), kind: 'ai-action-proposal', text: data.reply || '', actions, resolved: false });
      } else {
        appendMessage({ id: nextId(), kind: 'ai-text', text: data.reply || '(không có phản hồi)' });
      }
    } catch {
      appendMessage({ id: nextId(), kind: 'ai-text', text: 'Không kết nối được máy chủ.' });
    } finally {
      setSending(false);
    }
  }

  async function writeAttendance(studentId: string, classId: string, isAbsent: boolean, period: number) {
    const { data: existing } = await supabase
      .from('attendance')
      .select('id')
      .eq('student_id', studentId)
      .eq('class_id', classId)
      .eq('date', format(new Date(), 'yyyy-MM-dd'))
      .eq('period', period)
      .single();

    const status = isAbsent ? 'absent' : 'present';

    if (existing) {
      const { error } = await supabase
        .from('attendance')
        .update({ status, user_id: user?.id || null })
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('attendance').insert([
        {
          student_id: studentId,
          class_id: classId,
          subject_id: null,
          date: format(new Date(), 'yyyy-MM-dd'),
          period,
          status,
          note: null,
          user_id: user?.id || null,
        },
      ]);
      if (error) throw error;
    }
  }

  async function writeEquipmentCheck(
    studentId: string,
    classId: string,
    forgotEquipment: boolean,
    note: string,
    period: number
  ) {
    const { data: existing } = await supabase
      .from('equipment_checks')
      .select('id')
      .eq('student_id', studentId)
      .eq('class_id', classId)
      .eq('date', format(new Date(), 'yyyy-MM-dd'))
      .eq('period', period)
      .single();

    if (existing) {
      const { error } = await supabase
        .from('equipment_checks')
        .update({ forgot_equipment: forgotEquipment, note: note || null, user_id: user?.id || null })
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('equipment_checks').insert([
        {
          student_id: studentId,
          class_id: classId,
          subject_id: null,
          date: format(new Date(), 'yyyy-MM-dd'),
          period,
          forgot_equipment: forgotEquipment,
          note: note || null,
          user_id: user?.id || null,
        },
      ]);
      if (error) throw error;
    }
  }

  async function writeStudentNote(studentId: string, classId: string, content: string) {
    const { error } = await supabase.from('student_notes').insert([
      {
        student_id: studentId,
        class_id: classId,
        subject_id: null,
        user_id: user?.id || null,
        date: format(new Date(), 'yyyy-MM-dd'),
        content,
      },
    ]);
    if (error) throw error;
  }

  async function writeLessonNote(classId: string, period: number, lessonName: string, lessonContent: string) {
    const today = format(new Date(), 'yyyy-MM-dd');
    const { data: existing } = await supabase
      .from('teaching_diary')
      .select('id')
      .eq('class_id', classId)
      .eq('date', today)
      .eq('period', period)
      .single();

    if (existing) {
      const { error } = await supabase
        .from('teaching_diary')
        .update({ lesson_name: lessonName, content: lessonContent || null })
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('teaching_diary').insert([
        {
          user_id: user?.id || null,
          class_id: classId,
          subject_id: null,
          date: today,
          period,
          week_number: getSchoolWeek(new Date()),
          lesson_name: lessonName,
          content: lessonContent || null,
        },
      ]);
      if (error) throw error;
    }
  }

  async function generateSummary(action: ChatAction): Promise<SummaryResultData> {
    const res = await fetch('/api/ai-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'student',
        studentId: action.student_id,
        classId: action.class_id,
        userId: user?.id || null,
        isAdmin,
        startDate: action.start_date,
        endDate: action.end_date,
        periodLabel: action.period_label || '',
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.results || data.results.length === 0) {
      throw new Error(data.error || 'Không tạo được tổng hợp.');
    }
    const r = data.results[0];
    return {
      student_id: action.student_id,
      class_id: action.class_id,
      student_name: r.student_name,
      competency_text: r.competency_text,
      character_text: r.character_text,
      overall_rating: r.overall_rating,
      overall_reason: r.overall_reason,
      includeCharacter: !!data.includeCharacter,
      period_label: action.period_label || '',
      error: r.error,
    };
  }

  async function handleConfirm(messageId: string) {
    const message = messages.find((m) => m.id === messageId);
    if (!message || !message.actions) return;

    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, resolved: true } : m)));

    const results: string[] = [];

    for (const action of message.actions) {
      const label = studentLabel(roster, action.student_id);
      try {
        if (action.type === 'attendance') {
          const isAbsent = !!action.is_absent;
          await writeAttendance(action.student_id, action.class_id, isAbsent, action.period || 1);
          results.push(`${label}: đã ghi ${isAbsent ? 'Vắng' : 'Có mặt'} ✅`);
        } else if (action.type === 'equipment_check') {
          await writeEquipmentCheck(
            action.student_id,
            action.class_id,
            !!action.forgot_equipment,
            action.note || '',
            action.period || 1
          );
          results.push(`${label}: đã ghi ${action.forgot_equipment ? 'quên đồ' : 'mang đủ đồ'} ✅`);
        } else if (action.type === 'student_note') {
          await writeStudentNote(action.student_id, action.class_id, action.content || '');
          results.push(`${label}: đã lưu nhận xét ✅`);
        } else if (action.type === 'lesson_note') {
          const className = roster.find((s) => s.class_id === action.class_id)?.class_name || action.class_id;
          await writeLessonNote(action.class_id, action.period || 1, action.lesson_name || '', action.lesson_content || '');
          results.push(`Lớp ${className}: đã lưu tên bài học "${action.lesson_name}" ✅`);
        } else if (action.type === 'request_summary') {
          const summary = await generateSummary(action);
          if (summary.error) {
            results.push(`${label}: lỗi khi tạo tổng hợp (${summary.error}) ❌`);
          } else {
            const summaryMsgId = nextId();
            setSummaryEdits((prev) => ({
              ...prev,
              [summaryMsgId]: {
                competency: summary.competency_text,
                character: summary.character_text || '',
                rating: summary.overall_rating,
              },
            }));
            appendMessage({ id: summaryMsgId, kind: 'ai-summary-result', summary, resolved: false });
            results.push(`${label}: đã tạo tổng hợp (${summary.period_label}) — xem bên dưới để duyệt và lưu.`);
          }
        }
      } catch (err: any) {
        results.push(`${label}: lỗi khi lưu (${err?.message || 'không rõ'}) ❌`);
      }
    }

    appendMessage({ id: nextId(), kind: 'system', text: results.join('\n') });
  }

  function handleCancel(messageId: string) {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, resolved: true } : m)));
    appendMessage({ id: nextId(), kind: 'system', text: 'Đã hủy.' });
  }

  async function handleSaveSummary(messageId: string) {
    const message = messages.find((m) => m.id === messageId);
    const edit = summaryEdits[messageId];
    if (!message || !message.summary || !edit) return;

    let content = `[Năng lực] ${edit.competency}`;
    if (message.summary.includeCharacter && edit.character) content += `\n[Phẩm chất] ${edit.character}`;
    content += `\n[Xếp loại] ${edit.rating}`;

    const { error } = await supabase.from('student_notes').insert([
      {
        student_id: message.summary.student_id,
        class_id: message.summary.class_id,
        subject_id: null,
        user_id: user?.id || null,
        date: format(new Date(), 'yyyy-MM-dd'),
        content,
        category: 'summary_month',
      },
    ]);

    if (error) {
      appendMessage({ id: nextId(), kind: 'system', text: `Lỗi khi lưu tổng hợp: ${error.message}` });
      return;
    }
    setSummarySaved((prev) => ({ ...prev, [messageId]: true }));
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className={`fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-50 w-14 h-14 rounded-full bg-blue-600 text-white shadow-xl flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-transform ${open ? 'hidden' : ''}`}
        aria-label="Mở trợ lý AI"
      >
        <MessageCircle size={26} />
      </button>

      {open && (
        <div className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-50 w-[calc(100vw-2rem)] max-w-sm h-[70vh] max-h-[600px] bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white">
            <span className="font-semibold">Trợ lý AI</span>
            <button onClick={() => setOpen(false)} aria-label="Đóng">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {!rosterLoaded && <div className="text-sm text-gray-400">Đang tải danh sách học sinh...</div>}
            {rosterLoaded && roster.length === 0 && (
              <div className="text-sm text-gray-500">Chưa có lớp/học sinh nào được phân công.</div>
            )}
            {rosterLoaded && roster.length > 0 && messages.length === 0 && (
              <div className="text-sm text-gray-500 space-y-1">
                <p>Nói tự nhiên, ví dụ:</p>
                <p>&quot;A3 lớp 4A hôm nay phát biểu rất tốt&quot;</p>
                <p>&quot;Lớp 43 tiết 3: A1 vắng, B2 quên vở&quot;</p>
                <p>&quot;Lớp 43 tiết 3 dạy bài Vòng lặp&quot;</p>
                <p>&quot;Tổng hợp nhận xét em A1 lớp 43 tháng 3&quot;</p>
              </div>
            )}

            {messages.map((m) => {
              if (m.kind === 'user') {
                return (
                  <div key={m.id} className="flex justify-end">
                    <div className="bg-blue-600 text-white rounded-lg px-3 py-2 text-sm max-w-[85%]">{m.text}</div>
                  </div>
                );
              }
              if (m.kind === 'system') {
                return (
                  <div key={m.id} className="text-xs text-gray-500 whitespace-pre-line px-1">
                    {m.text}
                  </div>
                );
              }
              if (m.kind === 'ai-action-proposal') {
                return (
                  <div key={m.id} className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm space-y-2">
                    {m.text && <div>{m.text}</div>}
                    <ul className="list-disc list-inside space-y-1">
                      {m.actions?.map((a, i) => (
                        <li key={i}>{a.description}</li>
                      ))}
                    </ul>
                    {!m.resolved && (
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => handleConfirm(m.id)}
                          className="flex-1 bg-blue-600 text-white font-medium rounded-lg py-2.5 min-h-[44px] text-sm hover:bg-blue-700 active:scale-95 transition-transform"
                        >
                          OK
                        </button>
                        <button
                          onClick={() => handleCancel(m.id)}
                          className="flex-1 bg-gray-200 text-gray-700 font-medium rounded-lg py-2.5 min-h-[44px] text-sm hover:bg-gray-300"
                        >
                          Hủy
                        </button>
                      </div>
                    )}
                  </div>
                );
              }
              if (m.kind === 'ai-summary-result' && m.summary) {
                const edit = summaryEdits[m.id] || { competency: '', character: '', rating: m.summary.overall_rating };
                const saved = !!summarySaved[m.id];
                return (
                  <div key={m.id} className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="font-semibold">
                        {m.summary.student_name} — {m.summary.period_label}
                      </div>
                      <select
                        value={edit.rating}
                        onChange={(e) =>
                          setSummaryEdits((prev) => ({ ...prev, [m.id]: { ...edit, rating: e.target.value } }))
                        }
                        className="px-2 py-1 rounded border border-purple-300 text-xs font-medium bg-white"
                      >
                        {RATING_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Năng lực</label>
                      <textarea
                        value={edit.competency}
                        onChange={(e) =>
                          setSummaryEdits((prev) => ({ ...prev, [m.id]: { ...edit, competency: e.target.value } }))
                        }
                        rows={3}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm resize-none"
                      />
                    </div>

                    {m.summary.includeCharacter && (
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Phẩm chất (GVCN)</label>
                        <textarea
                          value={edit.character}
                          onChange={(e) =>
                            setSummaryEdits((prev) => ({ ...prev, [m.id]: { ...edit, character: e.target.value } }))
                          }
                          rows={3}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm resize-none"
                        />
                      </div>
                    )}

                    {m.summary.overall_reason && (
                      <p className="text-xs text-gray-500 italic">Gợi ý: {m.summary.overall_reason}</p>
                    )}

                    <button
                      onClick={() => handleSaveSummary(m.id)}
                      disabled={saved}
                      className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium min-h-[44px] hover:bg-purple-700 disabled:bg-green-600"
                    >
                      {saved ? <Check size={16} /> : <Save size={16} />}
                      {saved ? 'Đã lưu' : 'Lưu bản tổng hợp'}
                    </button>
                  </div>
                );
              }
              return (
                <div key={m.id} className="flex justify-start">
                  <div className="bg-gray-100 text-gray-800 rounded-lg px-3 py-2 text-sm max-w-[85%] whitespace-pre-line">{m.text}</div>
                </div>
              );
            })}

            {sending && <div className="text-sm text-gray-400">Đang xử lý...</div>}
          </div>

          <div className="flex gap-2 p-3 border-t border-gray-200">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend();
              }}
              placeholder="Nói chuyện với trợ lý AI..."
              className="flex-1 border border-gray-300 rounded-lg p-3 text-base min-h-[44px]"
            />
            <button
              onClick={handleSend}
              disabled={sending || !input.trim() || !rosterLoaded || roster.length === 0}
              className="bg-blue-600 text-white font-medium rounded-lg px-4 min-h-[44px] disabled:bg-gray-300 hover:bg-blue-700"
            >
              Gửi
            </button>
          </div>
        </div>
      )}
    </>
  );
}
