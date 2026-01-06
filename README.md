# Hệ thống Quản lý Lớp học & Điểm danh

Ứng dụng web miễn phí giúp quản lý lớp dạy thêm, điểm danh và thu học phí.

## Tính năng

✅ **Quản lý lớp học** - Thêm, sửa, xóa thông tin lớp học
✅ **Quản lý học sinh** - Quản lý danh sách học sinh từng lớp
✅ **Điểm danh** - Điểm danh nhanh theo buổi học (Có mặt, Vắng, Muộn, Có phép)
✅ **Quản lý học phí** - Theo dõi học phí đã đóng/chưa đóng theo tháng
✅ **Dashboard** - Tổng quan thống kê nhanh
✅ **Lưu trữ miễn phí** - Dữ liệu lưu trên Google Sheets của bạn

## Hướng dẫn cài đặt

### Bước 1: Tạo Google Sheet mới

1. Truy cập [Google Sheets](https://sheets.google.com)
2. Tạo một bảng tính mới (New Spreadsheet)
3. Đặt tên cho bảng tính (VD: "Quản lý lớp học")

### Bước 2: Mở Apps Script Editor

1. Trong Google Sheet, click vào **Extensions** (Tiện ích mở rộng)
2. Chọn **Apps Script**
3. Bạn sẽ thấy một file `Code.gs` mặc định

### Bước 3: Copy code vào Apps Script

#### 3.1. File Code.gs (Server-side)

1. Xóa toàn bộ code mặc định trong file `Code.gs`
2. Mở file `Code.gs` trong thư mục này
3. Copy toàn bộ nội dung và paste vào Apps Script

#### 3.2. File Index.html (Giao diện chính)

1. Trong Apps Script, click dấu **+** bên cạnh "Files"
2. Chọn **HTML**
3. Đặt tên: `Index`
4. Copy toàn bộ nội dung từ file `Index.html` và paste vào

#### 3.3. File Stylesheet.html (CSS)

1. Click dấu **+** bên cạnh "Files"
2. Chọn **HTML**
3. Đặt tên: `Stylesheet`
4. Copy toàn bộ nội dung từ file `Stylesheet.html` và paste vào

#### 3.4. File JavaScript.html (Client-side JS)

1. Click dấu **+** bên cạnh "Files"
2. Chọn **HTML**
3. Đặt tên: `JavaScript`
4. Copy toàn bộ nội dung từ file `JavaScript.html` và paste vào

### Bước 4: Khởi tạo Google Sheets

1. Trong Apps Script Editor, chọn function `initializeSheets` từ dropdown
2. Click nút **Run** (▶️)
3. Lần đầu tiên sẽ yêu cầu cấp quyền:
   - Click **Review permissions**
   - Chọn tài khoản Google của bạn
   - Click **Advanced** → **Go to [Tên project] (unsafe)**
   - Click **Allow**
4. Kiểm tra Google Sheet, bạn sẽ thấy 4 sheet mới được tạo:
   - **Classes** (Lớp học)
   - **Students** (Học sinh)
   - **Attendance** (Điểm danh)
   - **Payments** (Học phí)

### Bước 5: Deploy Web App

1. Trong Apps Script, click nút **Deploy** (góc trên bên phải)
2. Chọn **New deployment**
3. Click biểu tượng ⚙️ bên cạnh "Select type"
4. Chọn **Web app**
5. Cấu hình:
   - **Description**: "Quản lý lớp học v1.0"
   - **Execute as**: Me (email của bạn)
   - **Who has access**: Anyone (Bất kỳ ai) hoặc Anyone with Google account
6. Click **Deploy**
7. **Copy URL** của Web App (URL có dạng: `https://script.google.com/...`)
8. Click **Done**

### Bước 6: Truy cập ứng dụng

1. Paste URL vừa copy vào trình duyệt
2. Đăng nhập tài khoản Google (nếu chưa đăng nhập)
3. Ứng dụng sẽ mở ra! 🎉

## Hướng dẫn sử dụng

### 1. Thêm lớp học

1. Click vào **"Lớp học"** ở sidebar
2. Click nút **"Thêm lớp học"**
3. Điền thông tin:
   - Tên lớp (VD: Toán 10A)
   - Môn học (VD: Toán)
   - Lịch học (VD: T2, T4, T6 - 18:00)
   - Học phí/tháng (VD: 500000)
4. Click **"Thêm lớp"**

### 2. Thêm học sinh

1. Click vào **"Học sinh"** ở sidebar
2. Click nút **"Thêm học sinh"**
3. Điền thông tin:
   - Họ tên
   - Lớp học (chọn từ dropdown)
   - SĐT học sinh (tùy chọn)
   - SĐT phụ huynh (tùy chọn)
   - Ghi chú (tùy chọn)
4. Click **"Thêm học sinh"**

### 3. Điểm danh

1. Click vào **"Điểm danh"** ở sidebar
2. Chọn **lớp** từ dropdown
3. Chọn **ngày** (mặc định là hôm nay)
4. Danh sách học sinh sẽ hiển thị
5. Click vào trạng thái cho từng học sinh:
   - ✅ **Có mặt** (màu xanh)
   - ❌ **Vắng** (màu đỏ)
   - ⏰ **Muộn** (màu vàng)
   - 📄 **Có phép** (màu xanh dương)
6. Thêm ghi chú nếu cần
7. Click **"Lưu điểm danh"**

### 4. Quản lý học phí

1. Click vào **"Học phí"** ở sidebar
2. Chọn **lớp** từ dropdown
3. Chọn **tháng** (VD: 2025-01)
4. Danh sách học sinh và trạng thái học phí hiển thị
5. Click **"Đánh dấu đã đóng"** khi học sinh đóng tiền
6. Hệ thống tự ghi nhận ngày đóng

### 5. Xem Google Sheet

- Click nút **"Mở Google Sheet"** ở sidebar dưới cùng
- Bạn có thể xem và chỉnh sửa dữ liệu trực tiếp trong Sheet

## Cập nhật code

Khi bạn sửa code và muốn cập nhật:

1. **Lưu** code trong Apps Script (Ctrl + S)
2. Click **Deploy** → **Manage deployments**
3. Click biểu tượng ✏️ (Edit) bên cạnh deployment hiện tại
4. Thay đổi **Version** thành **New version**
5. Click **Deploy**
6. **Refresh** trang web app để thấy thay đổi

## Lưu ý quan trọng

⚠️ **Bảo mật**:
- Nếu chọn "Anyone" có thể truy cập, bất kỳ ai có link đều vào được
- Để bảo mật hơn, chọn "Anyone with Google account" hoặc thêm xác thực

⚠️ **Giới hạn Apps Script**:
- Mỗi request tối đa 6 phút
- Mỗi ngày có quota giới hạn (với tài khoản miễn phí)
- Xem chi tiết: [Apps Script Quotas](https://developers.google.com/apps-script/guides/services/quotas)

⚠️ **Backup dữ liệu**:
- Dữ liệu lưu trên Google Sheets của bạn
- Nên thường xuyên **File → Make a copy** để backup

## Tính năng nâng cao (có thể tự thêm)

- 📊 Báo cáo thống kê (biểu đồ điểm danh, doanh thu)
- 📧 Gửi email/SMS thông báo cho phụ huynh
- 📱 Responsive tốt hơn cho mobile
- 📄 Export PDF báo cáo
- 🔐 Phân quyền user (admin, giáo viên)
- 💳 Tích hợp thanh toán online

## Troubleshooting

### Lỗi "Script function not found"
- Kiểm tra tên function trong Code.gs có đúng không
- Thử save lại và redeploy

### Web App không load
- Kiểm tra quyền truy cập khi deploy
- Thử deploy lại với "New deployment"
- Xóa cache trình duyệt

### Dữ liệu không lưu
- Kiểm tra Google Sheet đã có các sheet Classes, Students, Attendance, Payments chưa
- Chạy lại function `initializeSheets`

### Lỗi "Authorization required"
- Vào Apps Script → Run → Chọn function bất kỳ → Run
- Cấp lại quyền cho ứng dụng

## Liên hệ & Hỗ trợ

Nếu gặp vấn đề, bạn có thể:
1. Kiểm tra **Execution log** trong Apps Script (View → Logs)
2. Google search lỗi cụ thể
3. Xem tài liệu Apps Script: [developers.google.com/apps-script](https://developers.google.com/apps-script)

---

**Chúc bạn sử dụng hiệu quả!** 🎓

Made with ❤️ for teachers
