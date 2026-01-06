// ==================== MAIN FUNCTIONS ====================

/**
 * Hàm chính để load Web App
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Quản lý lớp học')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Khởi tạo Google Sheet nếu chưa có
 */
function initializeSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Tạo sheet Lớp học
  if (!ss.getSheetByName('Classes')) {
    const classSheet = ss.insertSheet('Classes');
    classSheet.getRange('A1:E1').setValues([['ID', 'Tên lớp', 'Môn học', 'Lịch học', 'Học phí/tháng']]);
    classSheet.getRange('A1:E1').setFontWeight('bold').setBackground('#4285f4').setFontColor('#ffffff');
  }

  // Tạo sheet Học sinh
  if (!ss.getSheetByName('Students')) {
    const studentSheet = ss.insertSheet('Students');
    studentSheet.getRange('A1:F1').setValues([['ID', 'Họ tên', 'SĐT học sinh', 'SĐT phụ huynh', 'Lớp ID', 'Ghi chú']]);
    studentSheet.getRange('A1:F1').setFontWeight('bold').setBackground('#34a853').setFontColor('#ffffff');
  }

  // Tạo sheet Điểm danh
  if (!ss.getSheetByName('Attendance')) {
    const attendanceSheet = ss.insertSheet('Attendance');
    attendanceSheet.getRange('A1:F1').setValues([['ID', 'Học sinh ID', 'Lớp ID', 'Ngày', 'Trạng thái', 'Ghi chú']]);
    attendanceSheet.getRange('A1:F1').setFontWeight('bold').setBackground('#fbbc04').setFontColor('#ffffff');
  }

  // Tạo sheet Học phí
  if (!ss.getSheetByName('Payments')) {
    const paymentSheet = ss.insertSheet('Payments');
    paymentSheet.getRange('A1:G1').setValues([['ID', 'Học sinh ID', 'Lớp ID', 'Tháng', 'Số tiền', 'Ngày đóng', 'Trạng thái']]);
    paymentSheet.getRange('A1:G1').setFontWeight('bold').setBackground('#ea4335').setFontColor('#ffffff');
  }

  return 'Khởi tạo thành công!';
}

// ==================== CLASSES (LỚP HỌC) ====================

/**
 * Lấy tất cả lớp học
 */
function getClasses() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Classes');
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  return data.slice(1).map(row => ({
    id: row[0],
    name: row[1],
    subject: row[2],
    schedule: row[3],
    tuition: row[4]
  })).filter(c => c.id); // Loại bỏ dòng trống
}

/**
 * Thêm lớp học mới
 */
function addClass(classData) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Classes');
  const id = Utilities.getUuid();

  sheet.appendRow([
    id,
    classData.name,
    classData.subject,
    classData.schedule,
    classData.tuition
  ]);

  return { success: true, id: id };
}

/**
 * Cập nhật lớp học
 */
function updateClass(classData) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Classes');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === classData.id) {
      sheet.getRange(i + 1, 2, 1, 4).setValues([[
        classData.name,
        classData.subject,
        classData.schedule,
        classData.tuition
      ]]);
      return { success: true };
    }
  }

  return { success: false, error: 'Không tìm thấy lớp' };
}

/**
 * Xóa lớp học
 */
function deleteClass(classId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Classes');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === classId) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }

  return { success: false, error: 'Không tìm thấy lớp' };
}

// ==================== STUDENTS (HỌC SINH) ====================

/**
 * Lấy tất cả học sinh
 */
function getStudents(classId = null) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Students');
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  let students = data.slice(1).map(row => ({
    id: row[0],
    name: row[1],
    phone: row[2],
    parentPhone: row[3],
    classId: row[4],
    note: row[5]
  })).filter(s => s.id);

  if (classId) {
    students = students.filter(s => s.classId === classId);
  }

  return students;
}

/**
 * Thêm học sinh mới
 */
function addStudent(studentData) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Students');
  const id = Utilities.getUuid();

  sheet.appendRow([
    id,
    studentData.name,
    studentData.phone,
    studentData.parentPhone,
    studentData.classId,
    studentData.note || ''
  ]);

  return { success: true, id: id };
}

/**
 * Cập nhật học sinh
 */
function updateStudent(studentData) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Students');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === studentData.id) {
      sheet.getRange(i + 1, 2, 1, 5).setValues([[
        studentData.name,
        studentData.phone,
        studentData.parentPhone,
        studentData.classId,
        studentData.note || ''
      ]]);
      return { success: true };
    }
  }

  return { success: false, error: 'Không tìm thấy học sinh' };
}

/**
 * Xóa học sinh
 */
function deleteStudent(studentId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Students');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === studentId) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }

  return { success: false, error: 'Không tìm thấy học sinh' };
}

// ==================== ATTENDANCE (ĐIỂM DANH) ====================

/**
 * Lấy điểm danh theo lớp và ngày
 */
function getAttendance(classId, date) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Attendance');
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  return data.slice(1).map(row => ({
    id: row[0],
    studentId: row[1],
    classId: row[2],
    date: row[3],
    status: row[4],
    note: row[5]
  })).filter(a => a.classId === classId && a.date === date);
}

/**
 * Lưu điểm danh (cập nhật hoặc thêm mới)
 */
function saveAttendance(attendanceData) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Attendance');
  const data = sheet.getDataRange().getValues();

  // Kiểm tra xem đã có điểm danh này chưa
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === attendanceData.studentId &&
        data[i][2] === attendanceData.classId &&
        data[i][3] === attendanceData.date) {
      // Cập nhật
      sheet.getRange(i + 1, 5, 1, 2).setValues([[
        attendanceData.status,
        attendanceData.note || ''
      ]]);
      return { success: true };
    }
  }

  // Thêm mới
  const id = Utilities.getUuid();
  sheet.appendRow([
    id,
    attendanceData.studentId,
    attendanceData.classId,
    attendanceData.date,
    attendanceData.status,
    attendanceData.note || ''
  ]);

  return { success: true, id: id };
}

/**
 * Lấy lịch sử điểm danh của học sinh
 */
function getStudentAttendanceHistory(studentId, classId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Attendance');
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  return data.slice(1).map(row => ({
    id: row[0],
    studentId: row[1],
    classId: row[2],
    date: row[3],
    status: row[4],
    note: row[5]
  })).filter(a => a.studentId === studentId && a.classId === classId)
    .sort((a, b) => new Date(b.date) - new Date(a.date)); // Sắp xếp mới nhất trước
}

// ==================== PAYMENTS (HỌC PHÍ) ====================

/**
 * Lấy thông tin học phí
 */
function getPayments(classId = null, month = null) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Payments');
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  let payments = data.slice(1).map(row => ({
    id: row[0],
    studentId: row[1],
    classId: row[2],
    month: row[3],
    amount: row[4],
    paidDate: row[5],
    status: row[6]
  })).filter(p => p.id);

  if (classId) {
    payments = payments.filter(p => p.classId === classId);
  }

  if (month) {
    payments = payments.filter(p => p.month === month);
  }

  return payments;
}

/**
 * Lưu thông tin học phí
 */
function savePayment(paymentData) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Payments');
  const data = sheet.getDataRange().getValues();

  // Kiểm tra xem đã có record này chưa
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === paymentData.studentId &&
        data[i][2] === paymentData.classId &&
        data[i][3] === paymentData.month) {
      // Cập nhật
      sheet.getRange(i + 1, 5, 1, 3).setValues([[
        paymentData.amount,
        paymentData.paidDate || '',
        paymentData.status
      ]]);
      return { success: true };
    }
  }

  // Thêm mới
  const id = Utilities.getUuid();
  sheet.appendRow([
    id,
    paymentData.studentId,
    paymentData.classId,
    paymentData.month,
    paymentData.amount,
    paymentData.paidDate || '',
    paymentData.status
  ]);

  return { success: true, id: id };
}

/**
 * Lấy lịch sử học phí của học sinh
 */
function getStudentPaymentHistory(studentId, classId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Payments');
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  return data.slice(1).map(row => ({
    id: row[0],
    studentId: row[1],
    classId: row[2],
    month: row[3],
    amount: row[4],
    paidDate: row[5],
    status: row[6]
  })).filter(p => p.studentId === studentId && p.classId === classId)
    .sort((a, b) => b.month.localeCompare(a.month)); // Sắp xếp mới nhất trước
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Lấy URL của Google Sheet
 */
function getSpreadsheetUrl() {
  return SpreadsheetApp.getActiveSpreadsheet().getUrl();
}

/**
 * Test function để kiểm tra
 */
function test() {
  Logger.log('App is working!');
  Logger.log(getClasses());
}
