import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGeminiKeys, callGeminiRotate, isDailyLimit } from '@/lib/gemini';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MODEL = 'gemini-3.1-flash-lite';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface RequestBody {
  mode: 'student' | 'class';
  studentId?: string;
  classId: string;
  userId: string | null;
  isAdmin: boolean;
  startDate: string;
  endDate: string;
  periodLabel: string;
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

function buildPrompt(params: {
  studentName: string;
  className: string;
  periodLabel: string;
  notes: { date: string; content: string }[];
  absentCount: number;
  forgotCount: number;
  includeCharacter: boolean;
}): string {
  const { studentName, className, periodLabel, notes, absentCount, forgotCount, includeCharacter } = params;

  const notesText =
    notes.length > 0
      ? notes.map((n) => `- ${n.date}: ${n.content}`).join('\n')
      : '(không có nhận xét nào được ghi trong giai đoạn này)';

  return `Bạn là trợ lý giúp giáo viên tiểu học tổng hợp nhận xét học sinh theo khung đánh giá Thông tư 27 (Năng lực và Phẩm chất).

HỌC SINH: ${studentName} — Lớp ${className}
GIAI ĐOẠN: ${periodLabel}

CÁC LỜI NHẬN XÉT GIÁO VIÊN ĐÃ GHI TRONG GIAI ĐOẠN NÀY:
${notesText}

SỐ LIỆU TRONG GIAI ĐOẠN:
- Số buổi vắng: ${absentCount}
- Số lần quên đồ dùng học tập: ${forgotCount}

NHIỆM VỤ:
1. "competency_text": viết đoạn nhận xét về NĂNG LỰC (tự chủ-tự học, giao tiếp-hợp tác, giải quyết vấn đề-sáng tạo, và năng lực đặc thù môn học nếu nhận xét có nhắc tới) — dựa trên các lời nhận xét ở trên. Giọng văn báo cáo, khách quan, cụ thể. Nếu không có nhận xét nào, viết ngắn gọn dựa trên số liệu điểm danh/quên đồ và ghi rõ "chưa có đủ thông tin quan sát chi tiết".
${includeCharacter ? `2. "character_text": viết đoạn nhận xét về PHẨM CHẤT (chăm chỉ, trung thực, trách nhiệm, nhân ái, yêu nước) — dựa trên nhận xét và số liệu vắng/quên đồ (vắng nhiều/quên đồ nhiều có thể phản ánh tính chăm chỉ/trách nhiệm).` : '2. KHÔNG cần đánh giá Phẩm chất (giáo viên này không phải chủ nhiệm lớp) — để "character_text" là null.'}
3. "overall_rating": đề xuất xếp loại tổng thể, CHỈ được là một trong 3 giá trị: "Hoàn thành tốt", "Hoàn thành", "Chưa hoàn thành". Tham khảo quy tắc: nhận xét đa số tích cực + đi học đều + không/ít quên đồ → "Hoàn thành tốt"; có nhiều nhận xét cần nhắc nhở hoặc vắng nhiều → "Chưa hoàn thành"; còn lại → "Hoàn thành".
4. "overall_reason": 1 câu ngắn giải thích vì sao đề xuất xếp loại đó.

CHỈ trả về JSON THUẦN, đúng schema sau, KHÔNG thêm chữ nào khác, KHÔNG dùng markdown code fence:
{"competency_text":"...","character_text":${includeCharacter ? '"..."' : 'null'},"overall_rating":"Hoàn thành tốt|Hoàn thành|Chưa hoàn thành","overall_reason":"..."}`;
}

async function summarizeStudent(
  student: { id: string; name: string; computer_name: string | null },
  classId: string,
  className: string,
  startDate: string,
  endDate: string,
  periodLabel: string,
  includeCharacter: boolean,
  keys: string[]
): Promise<SummaryResult> {
  const [notesRes, attendanceRes, equipmentRes] = await Promise.all([
    supabase
      .from('student_notes')
      .select('date, content')
      .eq('student_id', student.id)
      .is('category', null)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true }),
    supabase
      .from('attendance')
      .select('id')
      .eq('student_id', student.id)
      .eq('status', 'absent')
      .gte('date', startDate)
      .lte('date', endDate),
    supabase
      .from('equipment_checks')
      .select('id')
      .eq('student_id', student.id)
      .eq('forgot_equipment', true)
      .gte('date', startDate)
      .lte('date', endDate),
  ]);

  const notes = notesRes.data || [];
  const absentCount = (attendanceRes.data || []).length;
  const forgotCount = (equipmentRes.data || []).length;

  const base = {
    student_id: student.id,
    student_name: student.name,
    computer_name: student.computer_name,
    note_count: notes.length,
    absent_count: absentCount,
    forgot_count: forgotCount,
  };

  const prompt = buildPrompt({
    studentName: student.name,
    className,
    periodLabel,
    notes,
    absentCount,
    forgotCount,
    includeCharacter,
  });

  const payload = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 1200 },
  });

  try {
    const geminiRes = await callGeminiRotate({ model: MODEL, keys, payload });
    if (!geminiRes.ok) {
      let errorCode = 'gemini_error';
      if (geminiRes.status === 429) {
        const errBody = await geminiRes.json().catch(() => ({}));
        errorCode = isDailyLimit(errBody) ? 'quota_rpd' : 'quota_rpm';
      }
      return { ...base, competency_text: '', character_text: null, overall_rating: 'Hoàn thành', overall_reason: '', error: errorCode };
    }
    const data = await geminiRes.json();
    const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleaned = text.replace(/```json\s*|\s*```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    const validRatings = ['Hoàn thành tốt', 'Hoàn thành', 'Chưa hoàn thành'];
    return {
      ...base,
      competency_text: parsed.competency_text || '',
      character_text: includeCharacter ? parsed.character_text || null : null,
      overall_rating: validRatings.includes(parsed.overall_rating) ? parsed.overall_rating : 'Hoàn thành',
      overall_reason: parsed.overall_reason || '',
    };
  } catch {
    return { ...base, competency_text: '', character_text: null, overall_rating: 'Hoàn thành', overall_reason: '', error: 'parse_error' };
  }
}

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const { mode, studentId, classId, userId, isAdmin, startDate, endDate, periodLabel } = body;

  if (!classId || !startDate || !endDate) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 });
  }
  if (mode === 'student' && !studentId) {
    return NextResponse.json({ error: 'missing_student' }, { status: 400 });
  }

  const keys = getGeminiKeys();
  if (!keys.length) {
    return NextResponse.json({ error: 'no_api_key' }, { status: 500 });
  }

  const { data: classData } = await supabase.from('classes').select('id, name').eq('id', classId).single();
  if (!classData) {
    return NextResponse.json({ error: 'class_not_found' }, { status: 404 });
  }

  let includeCharacter = isAdmin;
  if (!includeCharacter && userId) {
    const { data: homeroomAssignments } = await supabase
      .from('teacher_assignments')
      .select('is_homeroom')
      .eq('class_id', classId)
      .eq('user_id', userId)
      .eq('is_homeroom', true);
    includeCharacter = !!(homeroomAssignments && homeroomAssignments.length > 0);
  }

  let students: { id: string; name: string; computer_name: string | null }[] = [];
  if (mode === 'student') {
    const { data } = await supabase
      .from('students')
      .select('id, name, computer_name')
      .eq('id', studentId!)
      .single();
    if (!data) return NextResponse.json({ error: 'student_not_found' }, { status: 404 });
    students = [data];
  } else {
    const { data } = await supabase
      .from('students')
      .select('id, name, computer_name')
      .eq('class_id', classId)
      .order('computer_name', { ascending: true, nullsFirst: false });
    students = data || [];
  }

  if (students.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const results: SummaryResult[] = [];
  for (const student of students) {
    const result = await summarizeStudent(
      student,
      classId,
      classData.name,
      startDate,
      endDate,
      periodLabel,
      includeCharacter,
      keys
    );
    results.push(result);
  }

  return NextResponse.json({ results, includeCharacter });
}
