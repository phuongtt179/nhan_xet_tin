import { NextResponse } from 'next/server';
import { getGeminiKeys, callGeminiRotate, isDailyLimit } from '@/lib/gemini';

export const runtime = 'nodejs';
export const maxDuration = 30;

type PageType = 'attendance' | 'evaluation' | 'equipment_check' | 'teaching_diary';

interface StudentRef {
  id: string;
  name: string;
  computer_name: string | null;
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
  if (!isDiary && (!Array.isArray(body.students) || body.students.length === 0)) {
    return NextResponse.json({ error: 'no_students' }, { status: 400 });
  }

  const keys = getGeminiKeys();
  if (!keys.length) {
    return NextResponse.json({ error: 'no_api_key' }, { status: 500 });
  }

  const systemPrompt = isDiary ? buildDiarySystemPrompt(body) : buildActionSystemPrompt(body);

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
    const validStudentIds = new Set((body.students || []).map((s) => s.id));
    const actions = (Array.isArray(parsed.actions) ? parsed.actions : []).filter(
      (a) => a && validStudentIds.has(a.student_id) && a.type === pageType
    );
    return NextResponse.json({ reply, actions });
  } catch {
    return NextResponse.json({ error: 'parse_error', raw: text }, { status: 500 });
  }
}
