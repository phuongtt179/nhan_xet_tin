'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type PageType = 'attendance' | 'evaluation' | 'equipment_check' | 'teaching_diary';

interface StudentRef {
  id: string;
  name: string;
  computer_name: string | null;
}

interface ChatAction {
  type: 'attendance' | 'evaluation' | 'equipment_check';
  student_id: string;
  description: string;
  is_absent?: boolean;
  rating?: number;
  forgot_equipment?: boolean;
  note?: string;
}

interface DiaryDraft {
  lesson_name: string;
  content?: string;
  notes?: string;
}

interface ChatMessage {
  id: string;
  kind: 'user' | 'ai-text' | 'ai-action-proposal' | 'ai-diary-proposal' | 'system';
  text?: string;
  actions?: ChatAction[];
  draft?: DiaryDraft;
  resolved?: boolean;
}

interface ChatBoxProps {
  pageType: PageType;
  classId: string;
  className: string;
  subjectId?: string;
  subjectName?: string;
  date: string;
  period?: number; // not applicable to pageType 'evaluation'
  criterionId?: string; // required when pageType === 'evaluation'
  criterionName?: string;
  students?: StudentRef[]; // required for attendance/evaluation/equipment_check
  absentStudentIds?: Set<string>; // evaluation only, to block evaluating absent students
  onAttendanceConfirmed?: (studentId: string, isAbsent: boolean) => void;
  onEvaluationConfirmed?: (studentId: string, rating: number) => void;
  onEquipmentConfirmed?: (studentId: string, forgotEquipment: boolean, note: string) => void;
  onDraftConfirmed?: (draft: DiaryDraft) => void;
}

function studentLabel(students: StudentRef[], studentId: string): string {
  const s = students.find((s) => s.id === studentId);
  return s ? `${s.computer_name || '?'} (${s.name})` : `#${studentId}`;
}

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `msg-${Date.now()}-${idCounter}`;
}

export default function ChatBox({
  pageType,
  classId,
  className,
  subjectId,
  subjectName,
  date,
  period,
  criterionId,
  criterionName,
  students = [],
  absentStudentIds,
  onAttendanceConfirmed,
  onEvaluationConfirmed,
  onEquipmentConfirmed,
  onDraftConfirmed,
}: ChatBoxProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

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
          pageType,
          className,
          subjectName,
          date,
          period,
          criterionName,
          students: pageType === 'teaching_diary' ? undefined : students,
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

      if (pageType === 'teaching_diary') {
        if (data.draft) {
          appendMessage({
            id: nextId(),
            kind: 'ai-diary-proposal',
            text: data.reply || '',
            draft: data.draft,
            resolved: false,
          });
        } else {
          appendMessage({ id: nextId(), kind: 'ai-text', text: data.reply || '(không có phản hồi)' });
        }
        return;
      }

      const actions: ChatAction[] = Array.isArray(data.actions) ? data.actions : [];
      if (actions.length > 0) {
        appendMessage({
          id: nextId(),
          kind: 'ai-action-proposal',
          text: data.reply || '',
          actions,
          resolved: false,
        });
      } else {
        appendMessage({ id: nextId(), kind: 'ai-text', text: data.reply || '(không có phản hồi)' });
      }
    } catch {
      appendMessage({ id: nextId(), kind: 'ai-text', text: 'Không kết nối được máy chủ.' });
    } finally {
      setSending(false);
    }
  }

  async function writeAttendance(studentId: string, isAbsent: boolean) {
    let existingQuery = supabase
      .from('attendance')
      .select('id')
      .eq('student_id', studentId)
      .eq('class_id', classId)
      .eq('date', date)
      .eq('period', period);
    if (subjectId) existingQuery = existingQuery.eq('subject_id', subjectId);
    const { data: existing } = await existingQuery.single();

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
          subject_id: subjectId || null,
          date,
          period,
          status,
          note: null,
          user_id: user?.id || null,
        },
      ]);
      if (error) throw error;
    }
    onAttendanceConfirmed?.(studentId, isAbsent);
  }

  async function writeEvaluation(studentId: string, rating: number) {
    const { data: existingList, error: checkError } = await supabase
      .from('evaluations')
      .select('id')
      .eq('student_id', studentId)
      .eq('criterion_id', criterionId)
      .eq('class_id', classId)
      .eq('evaluated_date', date);
    if (checkError) throw checkError;

    const existing = existingList && existingList.length > 0 ? existingList[0] : null;

    if (existing) {
      const { error } = await supabase
        .from('evaluations')
        .update({ rating, updated_at: new Date().toISOString(), user_id: user?.id || null })
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('evaluations').insert([
        {
          student_id: studentId,
          criterion_id: criterionId,
          class_id: classId,
          evaluated_date: date,
          rating,
          user_id: user?.id || null,
        },
      ]);
      if (error) throw error;
    }
    onEvaluationConfirmed?.(studentId, rating);
  }

  async function writeEquipmentCheck(studentId: string, forgotEquipment: boolean, note: string) {
    let existingQuery = supabase
      .from('equipment_checks')
      .select('id')
      .eq('student_id', studentId)
      .eq('class_id', classId)
      .eq('date', date)
      .eq('period', period);
    if (subjectId) existingQuery = existingQuery.eq('subject_id', subjectId);
    const { data: existing } = await existingQuery.single();

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
          subject_id: subjectId || null,
          date,
          period,
          forgot_equipment: forgotEquipment,
          note: note || null,
          user_id: user?.id || null,
        },
      ]);
      if (error) throw error;
    }
    onEquipmentConfirmed?.(studentId, forgotEquipment, note);
  }

  async function handleConfirmActions(messageId: string) {
    const message = messages.find((m) => m.id === messageId);
    if (!message || !message.actions) return;

    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, resolved: true } : m)));

    const results: string[] = [];

    for (const action of message.actions) {
      const label = studentLabel(students, action.student_id);
      try {
        if (action.type === 'attendance') {
          const isAbsent = !!action.is_absent;
          await writeAttendance(action.student_id, isAbsent);
          results.push(`${label}: đã ghi ${isAbsent ? 'Vắng' : 'Có mặt'} ✅`);
        } else if (action.type === 'evaluation') {
          if (absentStudentIds?.has(action.student_id)) {
            results.push(`${label}: không thể đánh giá vì đang vắng ❌`);
            continue;
          }
          if (!criterionId || !action.rating) {
            results.push(`${label}: thiếu tiêu chí đang chọn, bỏ qua ❌`);
            continue;
          }
          await writeEvaluation(action.student_id, action.rating);
          results.push(`${label}: đã ghi mức đánh giá ✅`);
        } else if (action.type === 'equipment_check') {
          await writeEquipmentCheck(action.student_id, !!action.forgot_equipment, action.note || '');
          results.push(`${label}: đã ghi ${action.forgot_equipment ? 'quên đồ' : 'mang đủ đồ'} ✅`);
        }
      } catch (err: any) {
        results.push(`${label}: lỗi khi lưu (${err?.message || 'không rõ'}) ❌`);
      }
    }

    appendMessage({ id: nextId(), kind: 'system', text: results.join('\n') });
  }

  function handleConfirmDraft(messageId: string) {
    const message = messages.find((m) => m.id === messageId);
    if (!message || !message.draft) return;

    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, resolved: true } : m)));
    onDraftConfirmed?.(message.draft);
    appendMessage({ id: nextId(), kind: 'system', text: 'Đã điền vào form nháp — xem lại và bấm Lưu nhật ký khi ưng ý.' });
  }

  function handleCancel(messageId: string) {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, resolved: true } : m)));
    appendMessage({ id: nextId(), kind: 'system', text: 'Đã hủy.' });
  }

  const placeholder =
    pageType === 'teaching_diary'
      ? 'Mô tả tiết dạy hôm nay...'
      : `Gõ lệnh ngắn, ví dụ: "A3 tốt", "B1 vắng"...`;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow">
      <h3 className="text-base font-semibold mb-2 text-gray-800">Trợ lý AI</h3>

      <div className="space-y-2 max-h-80 overflow-y-auto mb-3">
        {messages.length === 0 && <div className="text-sm text-gray-500">{placeholder}</div>}

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
                      onClick={() => handleConfirmActions(m.id)}
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
          if (m.kind === 'ai-diary-proposal') {
            return (
              <div key={m.id} className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm space-y-2">
                {m.text && <div>{m.text}</div>}
                {m.draft && (
                  <div className="bg-white border border-purple-100 rounded p-2 space-y-1">
                    <div>
                      <span className="font-semibold">Tên bài:</span> {m.draft.lesson_name}
                    </div>
                    {m.draft.content && (
                      <div>
                        <span className="font-semibold">Nội dung:</span> {m.draft.content}
                      </div>
                    )}
                    {m.draft.notes && (
                      <div>
                        <span className="font-semibold">Ghi chú:</span> {m.draft.notes}
                      </div>
                    )}
                  </div>
                )}
                {!m.resolved && (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleConfirmDraft(m.id)}
                      className="flex-1 bg-purple-600 text-white font-medium rounded-lg py-2.5 min-h-[44px] text-sm hover:bg-purple-700 active:scale-95 transition-transform"
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
              <div className="bg-gray-100 text-gray-800 rounded-lg px-3 py-2 text-sm max-w-[85%] whitespace-pre-line">{m.text}</div>
            </div>
          );
        })}

        {sending && <div className="text-sm text-gray-400">Đang xử lý...</div>}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend();
          }}
          placeholder={placeholder}
          className="flex-1 border border-gray-300 rounded-lg p-3 text-base min-h-[44px]"
        />
        <button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          className="bg-blue-600 text-white font-medium rounded-lg px-4 min-h-[44px] disabled:bg-gray-300 hover:bg-blue-700"
        >
          Gửi
        </button>
      </div>
    </div>
  );
}
