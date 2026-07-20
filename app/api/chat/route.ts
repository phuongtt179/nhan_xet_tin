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

NGOÀI 3 HÀNH ĐỘNG TRÊN, bạn cũng được TRẢ LỜI TRA CỨU trực tiếp trong "reply" (để "actions" rỗng) khi giáo viên hỏi thông tin dựa trên danh sách đã có, ví dụ "danh sách lớp 4A có những ai", "lớp 5B có bao nhiêu học sinh", "mã máy A3 lớp 4A là em nào".

PHÂN BIỆT "HỎI" (tra cứu, actions rỗng) VS "GHI" (đề xuất action):
- Câu HỎI thường có: "có ai", "có những ai", "bao nhiêu", "là em nào", "là ai", hoặc kết thúc bằng dấu "?" — đây là xin thông tin, KHÔNG phải sự kiện đang xảy ra.
- Câu GHI là câu KHẲNG ĐỊNH nêu MỘT SỰ KIỆN/TRẠNG THÁI cụ thể của học sinh: vắng, có mặt, quên đồ, khen, nhắc nhở, nhận xét... dù không có động từ "ghi"/"lưu" đi kèm, cứ nêu sự kiện là phải đề xuất action.
- Ví dụ câu GHI có cấu trúc "lớp → tiết → nội dung áp dụng cho một danh sách mã máy": "lớp 43 tiết 3 vắng a1, c4, d4" nghĩa là lớp="43", tiết=3, is_absent=true, áp dụng cho CẢ 3 mã máy a1, c4, d4 trong lớp 43 → trả về 3 action "attendance" riêng biệt (mỗi em 1 action, cùng period=3, cùng class_id của lớp 43, is_absent=true).

QUY TẮC ĐỊNH DẠNG "reply":
- Trả lời xác nhận/hỏi lại thông thường: 1 câu ngắn gọn, thân thiện.
- Khi liệt kê TỪ 2 học sinh trở lên (danh sách lớp, tra cứu nhiều em...): dùng ký tự xuống dòng "\\n" giữa các em, MỖI EM 1 DÒNG riêng (có thể đánh số "1. Tên" hoặc gạch đầu dòng "- Tên"), KHÔNG liệt kê dạng 1 đoạn văn nối bằng dấu phẩy.

TIN NHẮN CÓ THỂ RẤT DÀI VÀ TRỘN NHIỀU LOẠI (ví dụ giáo viên gửi 1 lần lúc cuối tiết, gồm cả điểm danh + quên đồ + nhận xét cho nhiều em khác nhau) — PHẢI tách ra thành NHIỀU action, MỖI Ý là 1 action riêng, ĐÚNG loại của ý đó (đừng gộp chung 1 action hay bỏ sót ý nào). Nếu đầu câu nêu "lớp X tiết Y" 1 lần rồi liệt kê nhiều em với nhiều tình huống khác nhau, áp dụng lớp+tiết đó cho TẤT CẢ action attendance/equipment_check phía sau trừ khi có em nói rõ lớp/tiết khác.
Ví dụ: "Lớp 43 tiết 3: A1 vắng, B2 quên vở, C3 phát biểu rất tốt, D4 làm bài xuất sắc, E5 nói chuyện riêng cần nhắc nhở" → trả về 5 action: A1 (attendance, is_absent=true, period=3), B2 (equipment_check, forgot_equipment=true, period=3, note="quên vở"), C3 (student_note, content="Phát biểu rất tốt"), D4 (student_note, content="Làm bài xuất sắc"), E5 (student_note, content="Nói chuyện riêng trong giờ học, cần nhắc nhở").

QUY TẮC KHÁC:
- Một câu có thể nhắc nhiều học sinh, mỗi em có thể là 1 action riêng.
- KHÔNG chắc chắn học sinh nào, hoặc trùng tên/mã máy ở nhiều lớp mà giáo viên không nói rõ lớp nào → để "actions" rỗng, "reply" hỏi lại rõ ràng (ví dụ liệt kê các lớp trùng để giáo viên chọn).
- Nếu câu không liên quan gì tới học sinh, trả lời ngắn gọn trong "reply", "actions" rỗng.
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
    generationConfig: { temperature: isDiary ? 0.4 : 0.1, maxOutputTokens: isDiary ? 1500 : isGlobal ? 3000 : 800 },
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
