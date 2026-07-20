import { NextResponse } from 'next/server';
import { getGeminiKeys, callGeminiRotate, isDailyLimit } from '@/lib/gemini';

export const runtime = 'nodejs';
export const maxDuration = 30;

type PageType = 'attendance' | 'evaluation' | 'equipment_check' | 'teaching_diary' | 'global';

interface StudentRef {
  id: string;
  name: string;
  computer_name: string | null;
}

interface GlobalStudentRef extends StudentRef {
  class_id: string;
  class_name: string;
}

interface ChatRequestBody {
  message: string;
  pageType: PageType;
  className: string;
  subjectName?: string;
  date: string;
  period?: number;
  criterionName?: string;
  students?: StudentRef[];
  globalStudents?: GlobalStudentRef[];
}

interface ChatAction {
  type: 'attendance' | 'evaluation' | 'equipment_check' | 'student_note';
  student_id: string;
  class_id?: string; // global only — server re-derives from roster, never trusts model value
  description: string;
  is_absent?: boolean;
  rating?: number;
  period?: number; // global only — attendance/equipment_check require it
  forgot_equipment?: boolean;
  note?: string;
  content?: string; // student_note only
}

interface DiaryDraft {
  lesson_name: string;
  content?: string;
  notes?: string;
}

const MODEL = 'gemini-3.1-flash-lite';

const RATING_LABELS: Record<number, string> = {
  1: 'Chưa đạt',
  2: 'Hoàn thành',
  3: 'Tốt',
  4: 'Rất tốt',
};

function buildActionSystemPrompt(body: ChatRequestBody): string {
  const { pageType, className, subjectName, date, period, criterionName, students = [] } = body;

  const roster = students
    .map((s) => `- id=${s.id} | mã máy "${s.computer_name || '(chưa gán)'}" | tên "${s.name}"`)
    .join('\n');

  let actionSpec = '';
  if (pageType === 'attendance') {
    actionSpec = `"type":"attendance", cần "is_absent" (true = vắng, false = có mặt).`;
  } else if (pageType === 'evaluation') {
    actionSpec = `"type":"evaluation", cần "rating" là một số nguyên trong 1-4: 1="Chưa đạt", 2="Hoàn thành", 3="Tốt", 4="Rất tốt". Tiêu chí đang chấm: ${criterionName || '(không rõ)'}.`;
  } else {
    actionSpec = `"type":"equipment_check", cần "forgot_equipment" (true = quên đồ dùng, false = mang đủ) và tuỳ chọn "note" (mô tả ngắn món đồ quên).`;
  }

  return `Bạn là trợ lý giúp giáo viên thao tác nhanh trong giờ dạy bằng lệnh gõ ngắn.

BỐI CẢNH HIỆN TẠI:
- Lớp: ${className}
${subjectName ? `- Môn: ${subjectName}\n` : ''}- Ngày: ${date}${period ? `, Tiết: ${period}` : ''}

DANH SÁCH HỌC SINH LỚP NÀY (chỉ được chọn student_id có trong danh sách này, không tự bịa):
${roster}

CHỈ ĐƯỢC ĐỀ XUẤT DUY NHẤT LOẠI HÀNH ĐỘNG SAU: ${actionSpec}

QUY TẮC:
- Giáo viên gõ lệnh ngắn, thường nhắc mã máy (ví dụ "A3", "B1") hoặc tên học sinh, kèm hành động. Một câu có thể nhắc nhiều học sinh.
- Nếu KHÔNG chắc chắn học sinh nào (mã máy không khớp ai, tên trùng nhiều người, hoặc không nhận diện được hành động), để "actions" rỗng và "reply" hỏi lại giáo viên cho rõ — TUYỆT ĐỐI không đoán bừa.
- Nếu câu không liên quan, trả lời ngắn gọn trong "reply" và để "actions" rỗng.
- "reply" luôn là 1 câu tiếng Việt ngắn gọn, thân thiện.
- CHỈ trả về JSON THUẦN, đúng schema sau, KHÔNG thêm chữ nào khác, KHÔNG dùng markdown code fence:
{"reply":"...","actions":[{"type":"...","student_id":"...","description":"mô tả ngắn có mã máy + tên học sinh + hành động","is_absent":true,"rating":3,"forgot_equipment":true,"note":"..."}]}
Chỉ điền field tương ứng với loại hành động đang cho phép, không điền thừa field khác.`;
}

function buildGlobalSystemPrompt(body: ChatRequestBody): string {
  const { date, globalStudents = [] } = body;

  const roster = globalStudents
    .map(
      (s) =>
        `- id=${s.id} | lớp "${s.class_name}" (class_id=${s.class_id}) | mã máy "${s.computer_name || '(chưa gán)'}" | tên "${s.name}"`
    )
    .join('\n');

  return `Bạn là trợ lý AI cho giáo viên, mở từ icon chat nổi — dùng được ở bất kỳ đâu trong app, KHÔNG có lớp/tiết nào đang chọn sẵn. Giáo viên sẽ nói chuyện tự nhiên, bạn phải tự xác định đúng học sinh (và lớp của em đó) từ danh sách bên dưới.

NGÀY HIỆN TẠI: ${date}

DANH SÁCH TOÀN BỘ HỌC SINH GIÁO VIÊN ĐANG PHỤ TRÁCH (chỉ được chọn student_id có trong danh sách này, không tự bịa; nhiều lớp có thể trùng mã máy như "A3" — PHẢI dựa vào tên hoặc lớp giáo viên nói để chọn đúng người):
${roster}

BẠN CÓ THỂ ĐỀ XUẤT 3 LOẠI HÀNH ĐỘNG:
1. "type":"attendance" — điểm danh. Cần "is_absent" (true=vắng, false=có mặt) và "period" (số tiết 1-7). NẾU giáo viên không nói rõ tiết mấy, TUYỆT ĐỐI đừng tự đoán — để "actions" rỗng và "reply" hỏi lại "Tiết mấy ạ?".
2. "type":"equipment_check" — quên đồ dùng. Cần "forgot_equipment" (true/false), "period" (1-7, bắt buộc như trên — hỏi lại nếu thiếu), và tuỳ chọn "note" (mô tả món đồ quên).
3. "type":"student_note" — MẶC ĐỊNH dùng loại này cho MỌI nhận xét khác không phải điểm danh/quên đồ: khen, nhắc nhở, nhận xét học tập/thái độ, quan sát hằng ngày... Cần "content" = viết lại câu nhận xét cho gọn, rõ, giữ đúng ý giáo viên nói, giọng văn tự nhiên như lời phê. KHÔNG cần "period".

QUY TẮC:
- Một câu có thể nhắc nhiều học sinh, mỗi em có thể là 1 action riêng.
- KHÔNG chắc chắn học sinh nào, hoặc trùng tên/mã máy ở nhiều lớp mà giáo viên không nói rõ lớp nào → để "actions" rỗng, "reply" hỏi lại rõ ràng (ví dụ liệt kê các lớp trùng để giáo viên chọn).
- Nếu câu không liên quan gì tới học sinh, trả lời ngắn gọn trong "reply", "actions" rỗng.
- "reply" luôn là 1 câu tiếng Việt ngắn gọn, thân thiện.
- CHỈ trả về JSON THUẦN, đúng schema sau, KHÔNG thêm chữ nào khác, KHÔNG dùng markdown code fence:
{"reply":"...","actions":[{"type":"attendance|equipment_check|student_note","student_id":"...","class_id":"...","description":"mô tả ngắn có tên + lớp + hành động","is_absent":true,"period":3,"forgot_equipment":true,"note":"...","content":"..."}]}
Chỉ điền field tương ứng với loại hành động, không điền thừa field khác. "class_id" luôn điền đúng theo danh sách ở trên, khớp với student_id đã chọn.`;
}

function buildDiarySystemPrompt(body: ChatRequestBody): string {
  const { className, subjectName, date, period } = body;
  return `Bạn là trợ lý giúp giáo viên soạn nhanh nội dung nhật ký tiết dạy từ mô tả nói tự nhiên.

BỐI CẢNH: Lớp ${className}${subjectName ? `, môn ${subjectName}` : ''}, ngày ${date}, tiết ${period}.

Giáo viên sẽ mô tả tự do những gì đã dạy/diễn ra trong tiết học. Nhiệm vụ của bạn: soạn thành 3 phần cho nhật ký:
- "lesson_name": tên bài học ngắn gọn (bắt buộc, suy ra từ nội dung giáo viên mô tả).
- "content": nội dung chi tiết đã dạy, viết lại mạch lạc, đầy đủ ý giáo viên nói, giọng văn báo cáo chuyên nghiệp.
- "notes": ghi chú thêm nếu có (ví dụ: học sinh gặp khó khăn ở đâu, sự cố, việc cần theo dõi tiếp) — để "" nếu không có gì đặc biệt.

Nếu nội dung giáo viên gõ quá ít để soạn (ví dụ chỉ chào hỏi, không mô tả tiết dạy), để "draft" là null và "reply" hỏi lại giáo viên mô tả thêm.

CHỈ trả về JSON THUẦN, đúng schema sau, KHÔNG thêm chữ nào khác, KHÔNG dùng markdown code fence:
{"reply":"...","draft":{"lesson_name":"...","content":"...","notes":"..."}}
hoặc {"reply":"...","draft":null}`;
}

export async function POST(request: Request) {
  let body: ChatRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const { message, pageType } = body;

  if (!message || !String(message).trim()) {
    return NextResponse.json({ error: 'no_message' }, { status: 400 });
  }

  const isDiary = pageType === 'teaching_diary';
  const isGlobal = pageType === 'global';
  if (isGlobal && (!Array.isArray(body.globalStudents) || body.globalStudents.length === 0)) {
    return NextResponse.json({ error: 'no_students' }, { status: 400 });
  }
  if (!isDiary && !isGlobal && (!Array.isArray(body.students) || body.students.length === 0)) {
    return NextResponse.json({ error: 'no_students' }, { status: 400 });
  }

  const keys = getGeminiKeys();
  if (!keys.length) {
    return NextResponse.json({ error: 'no_api_key' }, { status: 500 });
  }

  const systemPrompt = isDiary
    ? buildDiarySystemPrompt(body)
    : isGlobal
      ? buildGlobalSystemPrompt(body)
      : buildActionSystemPrompt(body);

  const payload = JSON.stringify({
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: String(message) }] }],
    generationConfig: { temperature: isDiary ? 0.4 : 0.1, maxOutputTokens: isDiary ? 1500 : 800 },
  });

  let geminiRes: Response;
  try {
    geminiRes = await callGeminiRotate({ model: MODEL, keys, payload });
  } catch {
    return NextResponse.json({ error: 'network' }, { status: 500 });
  }

  if (geminiRes.status === 429) {
    const errBody = await geminiRes.json().catch(() => ({}));
    return NextResponse.json(
      { error: isDailyLimit(errBody) ? 'quota_rpd' : 'quota_rpm' },
      { status: 429 }
    );
  }
  if (!geminiRes.ok) {
    const errBody = await geminiRes.json().catch(() => ({}));
    return NextResponse.json({ error: 'gemini_error', details: errBody }, { status: 500 });
  }

  const data = await geminiRes.json();
  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const cleaned = text.replace(/```json\s*|\s*```/g, '').trim();

  try {
    if (isDiary) {
      const parsed = JSON.parse(cleaned) as { reply?: string; draft?: DiaryDraft | null };
      const draft = parsed.draft && parsed.draft.lesson_name ? parsed.draft : null;
      return NextResponse.json({ reply: parsed.reply || '', draft });
    }

    const parsed = JSON.parse(cleaned) as { reply?: string; actions?: ChatAction[] };
    const reply = parsed.reply || '';

    if (isGlobal) {
      const rosterById = new Map((body.globalStudents || []).map((s) => [s.id, s]));
      const validTypes = new Set(['attendance', 'equipment_check', 'student_note']);
      const actions = (Array.isArray(parsed.actions) ? parsed.actions : [])
        .filter((a) => a && rosterById.has(a.student_id) && validTypes.has(a.type))
        .filter((a) => a.type === 'student_note' || (typeof a.period === 'number' && a.period >= 1 && a.period <= 7))
        .map((a) => ({ ...a, class_id: rosterById.get(a.student_id)!.class_id }));
      return NextResponse.json({ reply, actions });
    }

    const validStudentIds = new Set((body.students || []).map((s) => s.id));
    const actions = (Array.isArray(parsed.actions) ? parsed.actions : []).filter(
      (a) => a && validStudentIds.has(a.student_id) && a.type === pageType
    );
    return NextResponse.json({ reply, actions });
  } catch {
    return NextResponse.json({ error: 'parse_error', raw: text }, { status: 500 });
  }
}
