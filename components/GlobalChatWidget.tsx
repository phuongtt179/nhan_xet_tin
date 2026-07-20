'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { MessageCircle, X } from 'lucide-react';
import { format } from 'date-fns';

interface GlobalStudent {
  id: string;
  name: string;
  computer_name: string | null;
  class_id: string;
  class_name: string;
}

interface ChatAction {
  type: 'attendance' | 'equipment_check' | 'student_note';
  student_id: string;
  class_id: string;
  description: string;
  is_absent?: boolean;
  period?: number;
  forgot_equipment?: boolean;
  note?: string;
  content?: string;
}

interface ChatMessage {
  id: string;
  kind: 'user' | 'ai-text' | 'ai-action-proposal' | 'system';
  text?: string;
  actions?: ChatAction[];
  resolved?: boolean;
}

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
              <div className="text-sm text-gray-500">
                Nói tự nhiên, ví dụ: &quot;Em A3 lớp 4A hôm nay phát biểu rất tốt&quot;, &quot;B1 lớp 5B vắng tiết 2&quot;...
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
              return (
                <div key={m.id} className="flex justify-start">
                  <div className="bg-gray-100 text-gray-800 rounded-lg px-3 py-2 text-sm max-w-[85%]">{m.text}</div>
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
