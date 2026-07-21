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

interface ClassSubjects {
  class_id: string;
  subjects: { id: string; name: string }[];
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
  classSubjects?: ClassSubjects[]; // global only — môn giáo viên được phân công theo từng lớp
}

interface ChatAction {
  type: 'attendance' | 'evaluation' | 'equipment_check' | 'student_note' | 'request_summary' | 'lesson_note';
  student_id: string; // not used by lesson_note (class-level) — model still echoes any student id from context or "" is filtered separately
  class_id?: string; // global only — server re-derives from roster, never trusts model value
  description: string;
  is_absent?: boolean;
  rating?: number;
  period?: number; // global only — attendance/equipment_check/lesson_note require it
  forgot_equipment?: boolean;
  note?: string;
  content?: string; // student_note only
  start_date?: string; // request_summary only, yyyy-MM-dd
  end_date?: string; // request_summary only, yyyy-MM-dd
  period_label?: string; // request_summary only, human label e.g. "Tháng 3/2026"
  lesson_name?: string; // lesson_note only
  lesson_content?: string; // lesson_note only, optional detail
  subject_id?: string; // lesson_note only — chỉ điền khi xác định được rõ ràng (nói tên môn khớp, hoặc lớp chỉ có 1 môn)
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
  const { date, globalStudents = [], classSubjects = [] } = body;

  const roster = globalStudents
    .map(
      (s) =>
        `- id=${s.id} | lớp "${s.class_name}" (class_id=${s.class_id}) | mã máy "${s.computer_name || '(chưa gán)'}" | tên "${s.name}"`
    )
    .join('\n');

  const classMap = new Map<string, string>();
  globalStudents.forEach((s) => classMap.set(s.class_id, s.class_name));
  const classesText = Array.from(classMap, ([id, name]) => `- lớp "${name}" (class_id=${id})`).join('\n');

  const subjectsByClassText = classSubjects
    .filter((c) => c.subjects.length > 0)
    .map(
      (c) =>
        `- lớp "${classMap.get(c.class_id) || c.class_id}" (class_id=${c.class_id}): ${c.subjects
          .map((s) => `"${s.name}" (subject_id=${s.id})`)
          .join(', ')}`
    )
    .join('\n');

  return `Bạn là trợ lý AI cho giáo viên, mở từ icon chat nổi — dùng được ở bất kỳ đâu trong app, KHÔNG có lớp/tiết nào đang chọn sẵn. Giáo viên sẽ nói chuyện tự nhiên, bạn phải tự xác định đúng học sinh/lớp từ danh sách bên dưới.

NGÀY HIỆN TẠI: ${date}

DANH SÁCH CÁC LỚP GIÁO VIÊN ĐANG PHỤ TRÁCH:
${classesText}

DANH SÁCH TOÀN BỘ HỌC SINH (chỉ được chọn student_id có trong danh sách này, không tự bịa; nhiều lớp có thể trùng mã máy như "A3" — PHẢI dựa vào tên hoặc lớp giáo viên nói để chọn đúng người):
${roster}

MÔN HỌC GIÁO VIÊN ĐƯỢC PHÂN CÔNG THEO TỪNG LỚP (dùng riêng cho "lesson_note" bên dưới):
${subjectsByClassText || '(không có dữ liệu phân công môn)'}

BẠN CÓ THỂ ĐỀ XUẤT 5 LOẠI HÀNH ĐỘNG:
1. "type":"attendance" — điểm danh. Cần "student_id", "is_absent" (true=vắng, false=có mặt) và "period" (số tiết 1-7). NẾU giáo viên không nói rõ tiết mấy, TUYỆT ĐỐI đừng tự đoán — để "actions" rỗng và "reply" hỏi lại "Tiết mấy ạ?".
2. "type":"equipment_check" — quên đồ dùng. Cần "student_id", "forgot_equipment" (true/false), "period" (1-7, bắt buộc như trên — hỏi lại nếu thiếu), và tuỳ chọn "note" (mô tả món đồ quên).
3. "type":"student_note" — MẶC ĐỊNH dùng loại này cho MỌI nhận xét khác không phải điểm danh/quên đồ, GẮN VỚI 1 HỌC SINH cụ thể: khen, nhắc nhở, nhận xét học tập/thái độ, quan sát hằng ngày... Cần "student_id" và "content" = viết lại câu nhận xét cho gọn, rõ, giữ đúng ý giáo viên nói, giọng văn tự nhiên như lời phê. KHÔNG cần "period".
4. "type":"lesson_note" — lưu tên bài học đã dạy cho CẢ LỚP (không phải cho 1 học sinh). Cần "class_id" (chọn đúng theo danh sách lớp ở trên), "period" (1-7, hỏi lại nếu thiếu), "lesson_name" (tên bài học ngắn gọn, suy ra từ câu giáo viên nói) và tuỳ chọn "lesson_content" (mô tả thêm nếu giáo viên có nói chi tiết). Dùng khi giáo viên nói kiểu "lớp X tiết Y dạy bài...", "hôm nay dạy...". KHÔNG cần "student_id" (bỏ trống "").
   XÁC ĐỊNH "subject_id" cho lesson_note theo thứ tự ưu tiên:
   a. Nếu giáo viên NÓI RÕ TÊN MÔN trong câu (ví dụ "môn Tin học dạy bài...") → đối chiếu với danh sách môn của đúng lớp đó ở trên. Nếu khớp tên (không cần khớp tuyệt đối, gần đúng là được, ví dụ "Tin" khớp "Tin học") → điền "subject_id" đó, lưu luôn, KHÔNG cần hỏi lại. Nếu KHÔNG khớp môn nào trong danh sách của lớp đó → để "actions" rỗng, "reply" hỏi lại và liệt kê đúng các môn giáo viên được phân công ở lớp đó.
   b. Nếu giáo viên KHÔNG nói tên môn: lớp đó chỉ có ĐÚNG 1 môn trong danh sách → tự động điền "subject_id" của môn đó, không cần hỏi.
   c. Nếu giáo viên KHÔNG nói tên môn VÀ lớp đó có TỪ 2 MÔN trở lên → để "actions" rỗng, "reply" hỏi lại "Môn nào ạ?" kèm liệt kê tên các môn của lớp đó.
   d. Nếu lớp đó không có trong danh sách môn (không có dữ liệu phân công) → bỏ trống "subject_id", hệ thống sẽ tự xử lý.
5. "type":"request_summary" — giáo viên muốn AI TỔNG HỢP/TỔNG KẾT/XẾP LOẠI 1 học sinh theo 1 khoảng thời gian (ví dụ "tổng hợp nhận xét em A1 lớp 43 tháng 3", "xuất báo cáo em Long tháng trước", "tổng kết em Hoa từ 1/9 đến 31/12"). Cần "student_id", "start_date" và "end_date" (định dạng YYYY-MM-DD — dựa vào NGÀY HIỆN TẠI để suy ra đúng tháng/năm nếu giáo viên chỉ nói tên tháng, ví dụ "tháng 3" khi hiện tại đang là năm 2026 → start_date="2026-03-01", end_date="2026-03-31"), và "period_label" (nhãn hiển thị, ví dụ "Tháng 3/2026"). Đây KHÔNG phải hành động ghi dữ liệu — chỉ là yêu cầu tạo báo cáo, hệ thống sẽ tự chạy AI tổng hợp sau khi giáo viên bấm OK. Nếu giáo viên nói mơ hồ không rõ mốc ngày (ví dụ chỉ nói "học kỳ 1" mà không nói rõ từ ngày nào đến ngày nào), để "actions" rỗng và hỏi lại xin khoảng ngày cụ thể.

NGOÀI 5 HÀNH ĐỘNG TRÊN, bạn cũng được TRẢ LỜI TRA CỨU trực tiếp trong "reply" (để "actions" rỗng) khi giáo viên hỏi thông tin dựa trên danh sách đã có, ví dụ "danh sách lớp 4A có những ai", "lớp 5B có bao nhiêu học sinh", "mã máy A3 lớp 4A là em nào".

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
{"reply":"...","actions":[{"type":"attendance|equipment_check|student_note|lesson_note|request_summary","student_id":"...","class_id":"...","subject_id":"...","description":"mô tả ngắn có tên/lớp + hành động","is_absent":true,"period":3,"forgot_equipment":true,"note":"...","content":"...","lesson_name":"...","lesson_content":"...","start_date":"2026-03-01","end_date":"2026-03-31","period_label":"Tháng 3/2026"}]}
Chỉ điền field tương ứng với loại hành động, không điền thừa field khác. "class_id" luôn điền đúng theo danh sách lớp/học sinh ở trên. "student_id" chỉ cần cho attendance/equipment_check/student_note/request_summary — với "lesson_note" để "student_id":"".`;
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
      const classIds = new Set((body.globalStudents || []).map((s) => s.class_id));
      const subjectIdsByClass = new Map(
        (body.classSubjects || []).map((c) => [c.class_id, new Set(c.subjects.map((s) => s.id))])
      );
      const isValidPeriod = (p: unknown) => typeof p === 'number' && p >= 1 && p <= 7;
      const isValidDate = (d: unknown) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);

      const actions = (Array.isArray(parsed.actions) ? parsed.actions : [])
        .filter((a): a is ChatAction => {
          if (!a) return false;
          if (a.type === 'attendance' || a.type === 'equipment_check') {
            return rosterById.has(a.student_id) && isValidPeriod(a.period);
          }
          if (a.type === 'student_note') {
            return rosterById.has(a.student_id) && !!a.content;
          }
          if (a.type === 'lesson_note') {
            return !!a.class_id && classIds.has(a.class_id) && isValidPeriod(a.period) && !!a.lesson_name;
          }
          if (a.type === 'request_summary') {
            return rosterById.has(a.student_id) && isValidDate(a.start_date) && isValidDate(a.end_date);
          }
          return false;
        })
        .map((a) => {
          if (a.type === 'lesson_note') {
            // class_id already provided directly by the model; only keep subject_id if it truly
            // belongs to that class's assigned subjects — otherwise drop it and let the client
            // fall back (single-subject auto-fill or, if still ambiguous, ask the teacher).
            const validSubjectIds = subjectIdsByClass.get(a.class_id!);
            const subjectId = a.subject_id && validSubjectIds?.has(a.subject_id) ? a.subject_id : undefined;
            return { ...a, subject_id: subjectId };
          }
          const student = rosterById.get(a.student_id);
          return student ? { ...a, class_id: student.class_id } : a;
        });
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
