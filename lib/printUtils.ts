import { format } from 'date-fns';

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
    }
  } catch (e) {
    console.error('Error formatting date:', e);
    dateRange = 'Tất cả';
  }

  const renderStars = (rating: number): string => {
    if (rating === 0) return '-';
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    let stars = '★'.repeat(fullStars);
    if (hasHalfStar) stars += '½';
    stars += '☆'.repeat(3 - Math.ceil(rating));
    return `${stars} (${rating.toFixed(1)})`;
  };

  const printWindow = window.open('about:blank', '_blank', 'width=1000,height=700');
  if (!printWindow) {
    alert('Vui lòng cho phép popup để in PDF');
    return;
  }

  // Wait for window to be ready
  printWindow.document.open();

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
    <div class="export-date">Ngày xuất: ${format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 120px;">Họ tên</th>
        <th style="width: 50px;">Máy</th>
        ${criteria.map(c => `<th>${c.name}</th>`).join('')}
        <th style="width: 80px;">Trung bình</th>
      </tr>
    </thead>
    <tbody>
      ${students.map(student => `
        <tr>
          <td class="student-name">${student.studentName}</td>
          <td class="computer-name">${student.computerName || '-'}</td>
          ${criteria.map(criterion => `
            <td>${renderStars(student.criteriaRatings[criterion.id] || 0)}</td>
          `).join('')}
          <td class="average-col">${renderStars(student.totalAverage)}</td>
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

  printWindow.document.write(html);
  printWindow.document.close();
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
    }
  } catch (e) {
    console.error('Error formatting date:', e);
    dateRange = 'Tất cả';
  }

  const renderStars = (rating: number): string => {
    if (rating === 0) return 'Chưa có';
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    let stars = '★'.repeat(fullStars);
    if (hasHalfStar) stars += '½';
    stars += '☆'.repeat(3 - Math.ceil(rating));
    return `${stars} (${rating.toFixed(1)})`;
  };

  const printWindow = window.open('about:blank', '_blank', 'width=1000,height=700');
  if (!printWindow) {
    alert('Vui lòng cho phép popup để in PDF');
    return;
  }

  // Wait for window to be ready
  printWindow.document.open();

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
    <div class="export-date">Ngày xuất: ${format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
  </div>

  <div class="student-info">
    <h2>Học sinh: ${student.studentName}</h2>
    ${student.computerName ? `<div class="detail">Máy: ${student.computerName}</div>` : ''}
    <div class="average">Điểm trung bình: ${student.overallAverage.toFixed(1)}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 40%;">Chủ đề</th>
        <th style="width: 30%;">Tiến độ</th>
        <th style="width: 30%;">Điểm TB</th>
      </tr>
    </thead>
    <tbody>
      ${student.topics.map(topic => `
        <tr>
          <td>${topic.topicName}</td>
          <td class="center">${topic.completedCount}/${topic.criteriaCount} tiêu chí</td>
          <td class="center">${renderStars(topic.averageRating)}</td>
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

  printWindow.document.write(html);
  printWindow.document.close();
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
    }
  } catch (e) {
    console.error('Error formatting date:', e);
    dateRange = 'Tất cả';
  }

  const renderStars = (rating: number): string => {
    if (rating === 0) return '-';
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    let stars = '★'.repeat(fullStars);
    if (hasHalfStar) stars += '½';
    stars += '☆'.repeat(3 - Math.ceil(rating));
    return `${stars} (${rating.toFixed(1)})`;
  };

  const printWindow = window.open('about:blank', '_blank', 'width=1000,height=700');
  if (!printWindow) {
    alert('Vui lòng cho phép popup để in PDF');
    return;
  }

  // Wait for window to be ready
  printWindow.document.open();

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
    <div class="export-date">Ngày xuất: ${format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 120px;">Họ tên</th>
        <th style="width: 50px;">Máy</th>
        ${topics.map(t => `<th>${t.name}</th>`).join('')}
        <th style="width: 80px;">TB</th>
      </tr>
    </thead>
    <tbody>
      ${students.map(student => `
        <tr>
          <td class="student-name">${student.name}</td>
          <td class="computer-name">${student.computerName || '-'}</td>
          ${student.topics.map(topic => `
            <td>${renderStars(topic.averageRating)}</td>
          `).join('')}
          <td class="average-col">${renderStars(student.overallAverage)}</td>
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

  printWindow.document.write(html);
  printWindow.document.close();
}
