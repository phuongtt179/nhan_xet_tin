import { format } from 'date-fns';

// ─── Tổng hợp cuối kì ────────────────────────────────────────────────────────
export function printSemesterSummary({
  className,
  gradeName,
  subjectName,
  weekFrom,
  weekTo,
  rows,
}: {
  className: string;
  gradeName: string;
  subjectName: string;
  weekFrom: number;
  weekTo: number;
  rows: {
    name: string;
    computer_name: string | null;
    weeks: Record<number, string>;
    total: string;
  }[];
}) {
  const weekRange = Array.from({ length: weekTo - weekFrom + 1 }, (_, i) => weekFrom + i);
  const exportDate = format(new Date(), 'dd/MM/yyyy HH:mm');

  const SHORT: Record<string, string> = {
    'Hoàn thành tốt': 'T',
    'Hoàn thành': 'H',
    'Chưa hoàn thành': 'C',
  };

  const CELL_STYLE: Record<string, string> = {
    'Hoàn thành tốt': 'color:#15803d;font-weight:bold;',
    'Hoàn thành': 'color:#1d4ed8;font-weight:bold;',
    'Chưa hoàn thành': 'color:#b91c1c;font-weight:bold;',
  };

  // Dùng font size nhỏ hơn khi nhiều tuần
  const totalCols = weekRange.length + 3; // STT + Tên + tuần... + Tổng
  const isLandscape = totalCols > 12;
  const fontSize = totalCols > 20 ? '7pt' : totalCols > 14 ? '8pt' : '9pt';

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Tổng hợp cuối kì - ${className}</title>
  <style>
    @page { size: A4 ${isLandscape ? 'landscape' : 'portrait'}; margin: 12mm; }
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Times New Roman',Times,serif; font-size:${fontSize}; line-height:1.3; }
    .header { text-align:center; margin-bottom:14px; }
    .header h1 { font-size:15pt; font-weight:bold; margin-bottom:5px; }
    .header .sub { font-size:11pt; margin-bottom:3px; }
    .header .meta { font-size:9pt; color:#555; font-style:italic; }
    table { width:100%; border-collapse:collapse; margin-top:6px; }
    th,td { border:1px solid #444; padding:4px 3px; text-align:center; }
    th { background-color:#4c1d95; color:#fff; font-weight:bold; font-size:${fontSize}; }
    th.name-col { text-align:left; }
    td.name-cell { text-align:left; font-weight:600; white-space:nowrap; }
    td.total-cell { background:#f3e8ff; font-weight:bold; }
    tr:nth-child(even) td { background:#fafafa; }
    tr:nth-child(even) td.total-cell { background:#ede9fe; }
    .legend { margin-top:10px; font-size:8pt; color:#555; display:flex; gap:16px; flex-wrap:wrap; }
    .no-print { text-align:center; margin-top:14px; }
    @media print { .no-print { display:none; } body { print-color-adjust:exact; -webkit-print-color-adjust:exact; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>BẢNG TỔNG HỢP CUỐI KÌ</h1>
    <div class="sub">${gradeName} - Lớp ${className} &nbsp;|&nbsp; Môn: ${subjectName}</div>
    <div class="meta">Tuần ${weekFrom} – ${weekTo} &nbsp;·&nbsp; Ngày xuất: ${exportDate}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:28px">STT</th>
        <th class="name-col" style="min-width:110px">Họ và tên</th>
        ${weekRange.map(w => `<th>T${w}</th>`).join('')}
        <th style="min-width:70px;background:#3b0764">Tổng</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map((r, i) => `
        <tr>
          <td>${i + 1}</td>
          <td class="name-cell">${r.name}${r.computer_name ? ` <span style="color:#999;font-size:7pt">(${r.computer_name})</span>` : ''}</td>
          ${weekRange.map(w => {
            const v = r.weeks[w] || '';
            return `<td>${v ? `<span style="${CELL_STYLE[v] || ''}">${SHORT[v] || v}</span>` : '<span style="color:#ccc">–</span>'}</td>`;
          }).join('')}
          <td class="total-cell">${r.total ? `<span style="${CELL_STYLE[r.total] || ''}">${r.total}</span>` : '<span style="color:#ccc">–</span>'}</td>
        </tr>`).join('')}
    </tbody>
  </table>

  <div class="legend">
    <span><b style="color:#15803d">T</b> = Hoàn thành tốt</span>
    <span><b style="color:#1d4ed8">H</b> = Hoàn thành</span>
    <span><b style="color:#b91c1c">C</b> = Chưa hoàn thành</span>
    <span style="color:#aaa">– = Chưa có dữ liệu</span>
    <span style="margin-left:auto;font-style:italic">* Rating 4 (Rất tốt) được tính vào Hoàn thành tốt</span>
  </div>

  <div class="no-print">
    <button onclick="window.print()" style="margin-top:16px;padding:10px 24px;font-size:13pt;background:#4c1d95;color:#fff;border:none;border-radius:6px;cursor:pointer">
      In / Lưu PDF (Ctrl+P)
    </button>
  </div>
  <script>window.onload=function(){setTimeout(()=>window.print(),500);};</script>
</body>
</html>`;

  openPrintWindow(html);
}

function openPrintWindow(html: string) {
  // Use Blob URL - more reliable than document.write()
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, '_blank', 'width=1000,height=700');

  if (!printWindow) {
    alert('Vui lòng cho phép popup để in PDF');
    URL.revokeObjectURL(url);
    return;
  }

  // Clean up blob URL after window loads
  printWindow.onload = () => {
    URL.revokeObjectURL(url);
  };
}

export function printTopicSummary(
  className: string,
  topicName: string,
  gradeName: string,
  startDate: string,
  endDate: string,
  criteria: { id: string; name: string }[],
  students: {
    studentName: string;
    computerName: string | null;
    criteriaRatings: { [key: string]: number };
    totalAverage: number;
  }[]
) {
  let dateRange = 'Tất cả';
  try {
    if (startDate && endDate) {
      dateRange = `${format(new Date(startDate), 'dd/MM/yyyy')} - ${format(new Date(endDate), 'dd/MM/yyyy')}`;
    } else if (endDate) {
      dateRange = `Đến ${format(new Date(endDate), 'dd/MM/yyyy')}`;
    } else if (startDate) {
      dateRange = `Từ ${format(new Date(startDate), 'dd/MM/yyyy')}`;
    }
  } catch (e) {
    console.error('Error formatting date:', e);
    dateRange = 'Tất cả';
  }

  const getRatingLabel = (rating: number): string => {
    if (rating === 0) return '-';
    const rounded = Math.round(rating);
    switch (rounded) {
      case 1: return 'Chưa đạt';
      case 2: return 'Hoàn thành';
      case 3: return 'Tốt';
      case 4: return 'Rất tốt';
      default: return 'Hoàn thành';
    }
  };

  // Calculate result based on criteria ratings
  const calculateResult = (criteriaRatings: { [key: string]: number }): string => {
    const ratings = Object.values(criteriaRatings).filter(r => r > 0);
    if (ratings.length === 0) return '-';

    const totalCriteria = ratings.length;
    const goodOrBetter = ratings.filter(r => r >= 3).length; // Tốt (3) or Rất tốt (4)
    const notCompleted = ratings.filter(r => r === 1).length; // Chưa đạt (1)

    // If 3/4 or more are "Tốt" or better AND no "Chưa đạt" → "Hoàn thành tốt"
    if (goodOrBetter >= (totalCriteria * 3 / 4) && notCompleted === 0) {
      return 'Hoàn thành tốt';
    }
    // If 1/2 or more are "Chưa đạt" → "Chưa hoàn thành"
    if (notCompleted >= (totalCriteria / 2)) {
      return 'Chưa hoàn thành';
    }
    // Otherwise → "Hoàn thành"
    return 'Hoàn thành';
  };

  let exportDate = '';
  try {
    exportDate = format(new Date(), 'dd/MM/yyyy HH:mm');
  } catch (e) {
    exportDate = new Date().toLocaleString('vi-VN');
  }

  const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tổng hợp theo Chủ đề - ${topicName}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 15mm;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      line-height: 1.4;
    }

    .header {
      text-align: center;
      margin-bottom: 20px;
    }

    .header h1 {
      font-size: 18pt;
      font-weight: bold;
      margin-bottom: 8px;
    }

    .header .subtitle {
      font-size: 12pt;
      margin-bottom: 4px;
    }

    .header .date-range {
      font-size: 10pt;
      color: #666;
      margin-bottom: 4px;
    }

    .header .export-date {
      font-size: 9pt;
      font-style: italic;
      color: #999;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }

    th, td {
      border: 1px solid #333;
      padding: 6px 8px;
      text-align: center;
    }

    th {
      background-color: #3b82f6;
      color: white;
      font-weight: bold;
      font-size: 10pt;
    }

    td {
      font-size: 9pt;
    }

    .student-name {
      text-align: left;
      font-weight: 600;
      white-space: nowrap;
    }

    .computer-name {
      text-align: center;
      font-weight: 500;
    }

    .average-col {
      background-color: #eff6ff;
      font-weight: bold;
    }

    .footer {
      position: fixed;
      bottom: 10mm;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 8pt;
      color: #666;
    }

    @media print {
      body {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }

      .no-print {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>TỔNG HỢP THEO CHỦ ĐỀ</h1>
    <div class="subtitle">${gradeName} - ${className} - Chủ đề: ${topicName}</div>
    <div class="date-range">Khoảng thời gian: ${dateRange}</div>
    <div class="export-date">Ngày xuất: ${exportDate}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 120px;">Họ tên</th>
        <th style="width: 50px;">Máy</th>
        ${criteria.map(c => `<th>${c.name}</th>`).join('')}
        <th style="width: 100px;">Kết quả</th>
      </tr>
    </thead>
    <tbody>
      ${students.map(student => `
        <tr>
          <td class="student-name">${student.studentName}</td>
          <td class="computer-name">${student.computerName || '-'}</td>
          ${criteria.map(criterion => `
            <td>${getRatingLabel(student.criteriaRatings[criterion.id] || 0)}</td>
          `).join('')}
          <td class="average-col">${calculateResult(student.criteriaRatings)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="footer no-print">
    <button onclick="window.print()" style="
      margin: 20px auto;
      padding: 10px 20px;
      font-size: 14pt;
      background-color: #3b82f6;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
    ">In PDF (Ctrl+P)</button>
  </div>

  <script>
    // Auto print when page loads
    window.onload = function() {
      setTimeout(() => window.print(), 500);
    };
  </script>
</body>
</html>
  `;

  openPrintWindow(html);
}

export function printSingleStudent(
  className: string,
  gradeName: string,
  startDate: string,
  endDate: string,
  student: {
    studentName: string;
    computerName: string | null;
    topics: {
      topicName: string;
      averageRating: number;
      criteriaCount: number;
      completedCount: number;
    }[];
    overallAverage: number;
  }
) {
  let dateRange = 'Tất cả';
  try {
    if (startDate && endDate) {
      dateRange = `${format(new Date(startDate), 'dd/MM/yyyy')} - ${format(new Date(endDate), 'dd/MM/yyyy')}`;
    } else if (endDate) {
      dateRange = `Đến ${format(new Date(endDate), 'dd/MM/yyyy')}`;
    } else if (startDate) {
      dateRange = `Từ ${format(new Date(startDate), 'dd/MM/yyyy')}`;
    }
  } catch (e) {
    console.error('Error formatting date:', e);
    dateRange = 'Tất cả';
  }

  const getRatingLabel = (rating: number): string => {
    if (rating === 0) return 'Chưa có';
    const rounded = Math.round(rating);
    switch (rounded) {
      case 1: return 'Chưa đạt';
      case 2: return 'Hoàn thành';
      case 3: return 'Tốt';
      case 4: return 'Rất tốt';
      default: return 'Hoàn thành';
    }
  };

  // Calculate overall result based on topic ratings
  const calculateOverallResult = (topics: { averageRating: number }[]): string => {
    const ratings = topics.map(t => t.averageRating).filter(r => r > 0);
    if (ratings.length === 0) return '-';

    const totalTopics = ratings.length;
    const goodOrBetter = ratings.filter(r => r >= 3).length;
    const notCompleted = ratings.filter(r => Math.round(r) === 1).length;

    if (goodOrBetter >= (totalTopics * 3 / 4) && notCompleted === 0) {
      return 'Hoàn thành tốt';
    }
    if (notCompleted >= (totalTopics / 2)) {
      return 'Chưa hoàn thành';
    }
    return 'Hoàn thành';
  };

  let exportDate = '';
  try {
    exportDate = format(new Date(), 'dd/MM/yyyy HH:mm');
  } catch (e) {
    exportDate = new Date().toLocaleString('vi-VN');
  }

  const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tổng hợp Học sinh - ${student.studentName}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 20mm;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 12pt;
      line-height: 1.5;
    }

    .header {
      text-align: center;
      margin-bottom: 25px;
    }

    .header h1 {
      font-size: 20pt;
      font-weight: bold;
      margin-bottom: 8px;
    }

    .header .subtitle {
      font-size: 13pt;
      margin-bottom: 4px;
    }

    .header .date-range {
      font-size: 11pt;
      color: #666;
      margin-bottom: 4px;
    }

    .header .export-date {
      font-size: 10pt;
      font-style: italic;
      color: #999;
    }

    .student-info {
      background-color: #eff6ff;
      border: 2px solid #3b82f6;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 20px;
    }

    .student-info h2 {
      font-size: 16pt;
      margin-bottom: 8px;
    }

    .student-info .detail {
      font-size: 11pt;
      margin-bottom: 4px;
    }

    .student-info .average {
      font-size: 14pt;
      font-weight: bold;
      color: #3b82f6;
      margin-top: 8px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }

    th, td {
      border: 1px solid #333;
      padding: 10px;
      text-align: left;
    }

    th {
      background-color: #3b82f6;
      color: white;
      font-weight: bold;
      font-size: 11pt;
      text-align: center;
    }

    td {
      font-size: 10pt;
    }

    .center {
      text-align: center;
    }

    @media print {
      body {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }

      .no-print {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>TỔNG HỢP HỌC SINH</h1>
    <div class="subtitle">${gradeName} - ${className}</div>
    <div class="date-range">Khoảng thời gian: ${dateRange}</div>
    <div class="export-date">Ngày xuất: ${exportDate}</div>
  </div>

  <div class="student-info">
    <h2>Học sinh: ${student.studentName}</h2>
    ${student.computerName ? `<div class="detail">Máy: ${student.computerName}</div>` : ''}
    <div class="average">Kết quả: ${calculateOverallResult(student.topics)}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 40%;">Chủ đề</th>
        <th style="width: 30%;">Tiến độ</th>
        <th style="width: 30%;">Đánh giá</th>
      </tr>
    </thead>
    <tbody>
      ${student.topics.map(topic => `
        <tr>
          <td>${topic.topicName}</td>
          <td class="center">${topic.completedCount}/${topic.criteriaCount} tiêu chí</td>
          <td class="center">${getRatingLabel(topic.averageRating)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="footer no-print">
    <button onclick="window.print()" style="
      margin: 20px auto;
      display: block;
      padding: 10px 20px;
      font-size: 14pt;
      background-color: #3b82f6;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
    ">In PDF (Ctrl+P)</button>
  </div>

  <script>
    window.onload = function() {
      setTimeout(() => window.print(), 500);
    };
  </script>
</body>
</html>
  `;

  openPrintWindow(html);
}

export function printAllStudents(
  className: string,
  gradeName: string,
  startDate: string,
  endDate: string,
  topics: { id: string; name: string }[],
  students: {
    name: string;
    computerName: string | null;
    topics: { topicName: string; averageRating: number }[];
    overallAverage: number;
  }[]
) {
  let dateRange = 'Tất cả';
  try {
    if (startDate && endDate) {
      dateRange = `${format(new Date(startDate), 'dd/MM/yyyy')} - ${format(new Date(endDate), 'dd/MM/yyyy')}`;
    } else if (endDate) {
      dateRange = `Đến ${format(new Date(endDate), 'dd/MM/yyyy')}`;
    } else if (startDate) {
      dateRange = `Từ ${format(new Date(startDate), 'dd/MM/yyyy')}`;
    }
  } catch (e) {
    console.error('Error formatting date:', e);
    dateRange = 'Tất cả';
  }

  const getRatingLabel = (rating: number): string => {
    if (rating === 0) return '-';
    const rounded = Math.round(rating);
    switch (rounded) {
      case 1: return 'Chưa đạt';
      case 2: return 'Hoàn thành';
      case 3: return 'Tốt';
      case 4: return 'Rất tốt';
      default: return 'Hoàn thành';
    }
  };

  // Calculate overall result based on topic ratings
  const calculateOverallResult = (studentTopics: { averageRating: number }[]): string => {
    const ratings = studentTopics.map(t => t.averageRating).filter(r => r > 0);
    if (ratings.length === 0) return '-';

    const totalTopics = ratings.length;
    const goodOrBetter = ratings.filter(r => r >= 3).length;
    const notCompleted = ratings.filter(r => Math.round(r) === 1).length;

    if (goodOrBetter >= (totalTopics * 3 / 4) && notCompleted === 0) {
      return 'Hoàn thành tốt';
    }
    if (notCompleted >= (totalTopics / 2)) {
      return 'Chưa hoàn thành';
    }
    return 'Hoàn thành';
  };

  let exportDate = '';
  try {
    exportDate = format(new Date(), 'dd/MM/yyyy HH:mm');
  } catch (e) {
    exportDate = new Date().toLocaleString('vi-VN');
  }

  const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tổng hợp cả lớp - ${className}</title>
  <style>
    @page {
      size: A4 ${topics.length > 3 ? 'landscape' : 'portrait'};
      margin: 15mm;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      line-height: 1.4;
    }

    .header {
      text-align: center;
      margin-bottom: 20px;
    }

    .header h1 {
      font-size: 18pt;
      font-weight: bold;
      margin-bottom: 8px;
    }

    .header .subtitle {
      font-size: 12pt;
      margin-bottom: 4px;
    }

    .header .date-range {
      font-size: 10pt;
      color: #666;
      margin-bottom: 4px;
    }

    .header .export-date {
      font-size: 9pt;
      font-style: italic;
      color: #999;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }

    th, td {
      border: 1px solid #333;
      padding: 6px 8px;
      text-align: center;
    }

    th {
      background-color: #3b82f6;
      color: white;
      font-weight: bold;
      font-size: 10pt;
    }

    td {
      font-size: 9pt;
    }

    .student-name {
      text-align: left;
      font-weight: 600;
      white-space: nowrap;
    }

    .computer-name {
      text-align: center;
      font-weight: 500;
    }

    .average-col {
      background-color: #eff6ff;
      font-weight: bold;
    }

    @media print {
      body {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }

      .no-print {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>TỔNG HỢP CẢ LỚP</h1>
    <div class="subtitle">${gradeName} - ${className}</div>
    <div class="date-range">Khoảng thời gian: ${dateRange}</div>
    <div class="export-date">Ngày xuất: ${exportDate}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 120px;">Họ tên</th>
        <th style="width: 50px;">Máy</th>
        ${topics.map(t => `<th>${t.name}</th>`).join('')}
        <th style="width: 100px;">Kết quả</th>
      </tr>
    </thead>
    <tbody>
      ${students.map(student => `
        <tr>
          <td class="student-name">${student.name}</td>
          <td class="computer-name">${student.computerName || '-'}</td>
          ${student.topics.map(topic => `
            <td>${getRatingLabel(topic.averageRating)}</td>
          `).join('')}
          <td class="average-col">${calculateOverallResult(student.topics)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="footer no-print">
    <button onclick="window.print()" style="
      margin: 20px auto;
      padding: 10px 20px;
      font-size: 14pt;
      background-color: #3b82f6;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
    ">In PDF (Ctrl+P)</button>
  </div>

  <script>
    window.onload = function() {
      setTimeout(() => window.print(), 500);
    };
  </script>
</body>
</html>
  `;

  openPrintWindow(html);
}
