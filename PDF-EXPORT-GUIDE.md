# Hướng dẫn Xuất PDF

## Tổng quan
Hệ thống hỗ trợ xuất báo cáo PDF cho 2 loại tổng hợp:
1. **Tổng hợp theo Chủ đề** - Xem đánh giá của tất cả học sinh theo từng tiêu chí của một chủ đề
2. **Tổng hợp theo Học sinh** - Xem đánh giá của một hoặc nhiều học sinh theo các chủ đề

---

## 1. Xuất PDF - Tổng hợp theo Chủ đề

### Đường dẫn
`/topic-summary`

### Các bước thực hiện

1. **Chọn Lớp**
   - Chọn lớp học từ dropdown "Lớp"
   - Hệ thống sẽ tự động load các chủ đề tương ứng với khối của lớp đó

2. **Chọn Chủ đề**
   - Chọn chủ đề muốn xem tổng hợp từ dropdown "Chủ đề"
   - Hệ thống sẽ tự động load các tiêu chí của chủ đề

3. **Chọn Khoảng thời gian** (Tùy chọn)
   - **Từ ngày**: Để trống để xem tất cả đánh giá từ trước đến nay
   - **Đến ngày**: Mặc định là ngày hôm nay

4. **Xem Tổng hợp**
   - Bảng tổng hợp sẽ hiển thị:
     - Các hàng: Danh sách học sinh (có tên máy nếu có)
     - Các cột: Từng tiêu chí của chủ đề
     - Cột cuối: Điểm trung bình của tất cả tiêu chí

5. **Xuất PDF**
   - Nhấn nút **"Xuất PDF"** màu xanh lá ở góc trên bên phải
   - File PDF sẽ được tải xuống tự động

### Nội dung PDF
- **Header**: Tiêu đề, tên lớp, chủ đề, khoảng thời gian, ngày xuất
- **Bảng dữ liệu**:
  - Tên học sinh và máy
  - Điểm trung bình cho từng tiêu chí (hiển thị dạng sao ★)
  - Điểm trung bình tổng (cột cuối, highlight màu xanh)
- **Footer**: Số trang

### Tên file
`Tong-hop-chu-de_<Tên-chủ-đề>_<yyyyMMdd-HHmm>.pdf`

**Ví dụ**: `Tong-hop-chu-de_Tin-hoc-co-ban_20260112-1430.pdf`

---

## 2. Xuất PDF - Tổng hợp theo Học sinh

### Đường dẫn
`/student-summary`

### Có 2 loại xuất PDF:

### A. Xuất PDF cho 1 Học sinh

#### Các bước thực hiện

1. **Chọn Lớp**
   - Chọn lớp học từ dropdown "Lớp"

2. **Chọn Học sinh**
   - Chọn học sinh từ dropdown "Học sinh"
   - Hiển thị kèm tên máy nếu có

3. **Chọn Chủ đề**
   - Chọn các chủ đề muốn xem (có thể chọn nhiều)
   - Sử dụng nút "Chọn tất cả" hoặc "Bỏ chọn tất cả"
   - Mặc định: tất cả chủ đề được chọn

4. **Chọn Khoảng thời gian** (Tùy chọn)
   - Tương tự như Tổng hợp theo Chủ đề

5. **Xem Tổng hợp**
   - Card hiển thị thông tin học sinh và điểm trung bình
   - Bảng hiển thị từng chủ đề với:
     - Tiến độ: Số tiêu chí đã đánh giá / Tổng tiêu chí
     - Điểm trung bình

6. **Xuất PDF**
   - Nhấn nút **"Xuất PDF"** màu xanh dương bên cạnh điểm trung bình
   - File PDF sẽ được tải xuống

#### Nội dung PDF
- **Header**: Tên học sinh, tên lớp, khoảng thời gian
- **Thông tin học sinh**: Tên, máy (nếu có), điểm trung bình
- **Bảng dữ liệu**:
  - Tên chủ đề
  - Tiến độ (x/y tiêu chí)
  - Điểm trung bình
- **Footer**: Số trang

#### Tên file
`Hoc-sinh_<Tên-học-sinh>_<yyyyMMdd-HHmm>.pdf`

**Ví dụ**: `Hoc-sinh_Nguyen-Van-A_20260112-1430.pdf`

---

### B. Xuất PDF cho Cả Lớp

#### Các bước thực hiện

1. **Chọn Lớp**
   - Chọn lớp học từ dropdown "Lớp"

2. **Chọn Chủ đề**
   - Chọn các chủ đề muốn xem (có thể chọn nhiều)
   - Sử dụng nút "Chọn tất cả" hoặc "Bỏ chọn tất cả"

3. **Chọn Khoảng thời gian** (Tùy chọn)

4. **Xuất PDF**
   - Nhấn nút **"Xuất PDF cả lớp"** màu xanh lá ở góc trên bên phải
   - Hệ thống sẽ:
     - Tải dữ liệu của TẤT CẢ học sinh trong lớp
     - Tính toán điểm trung bình cho từng học sinh theo các chủ đề đã chọn
     - Tạo file PDF
   - File PDF sẽ được tải xuống

#### Nội dung PDF
- **Header**: Tên lớp, khoảng thời gian, ngày xuất
- **Bảng dữ liệu**:
  - Các hàng: Tất cả học sinh trong lớp (có tên máy nếu có)
  - Các cột: Từng chủ đề đã chọn
  - Cột cuối: Điểm trung bình tổng (highlight màu xanh)

#### Tên file
`Tong-hop-lop_<Tên-lớp>_<yyyyMMdd-HHmm>.pdf`

**Ví dụ**: `Tong-hop-lop_3-1_20260112-1430.pdf`

---

## Ký hiệu trong PDF

### Hệ thống Sao (Rating)
- **★★★ (3.0)**: Tốt
- **★★½ (2.5)**: Khá tốt
- **★★☆ (2.0)**: Khá
- **★½☆ (1.5)**: Trung bình
- **★☆☆ (1.0)**: Đạt
- **-**: Chưa có đánh giá

### Màu sắc
- **Xanh dương**: Header bảng
- **Xanh nhạt**: Cột trung bình (highlight)

---

## Lưu ý

1. **Hiệu suất**
   - Xuất PDF cho cả lớp có thể mất vài giây nếu lớp có nhiều học sinh
   - Hệ thống sẽ hiển thị spinner loading trong quá trình xử lý

2. **Dữ liệu**
   - PDF chỉ hiển thị dữ liệu trong khoảng thời gian đã chọn
   - Nếu không chọn "Từ ngày", hệ thống sẽ lấy TẤT CẢ dữ liệu từ trước đến nay

3. **Font chữ**
   - PDF sử dụng font Helvetica (không có dấu tiếng Việt)
   - Chữ tiếng Việt sẽ hiển thị không dấu trong PDF

4. **Định dạng**
   - **Tổng hợp theo Chủ đề**: PDF ngang (landscape) để chứa nhiều cột tiêu chí
   - **Tổng hợp theo Học sinh**: PDF dọc (portrait)

---

## Khắc phục sự cố

### Lỗi: "Khong co du lieu de xuat PDF"
- **Nguyên nhân**: Chưa chọn đủ thông tin hoặc không có dữ liệu
- **Giải pháp**:
  - Kiểm tra đã chọn lớp, chủ đề (hoặc học sinh)
  - Kiểm tra đã có dữ liệu đánh giá trong khoảng thời gian đã chọn

### Lỗi: "Vui long chon lop va chu de"
- **Nguyên nhân**: Chưa chọn lớp hoặc chủ đề
- **Giải pháp**: Chọn đầy đủ thông tin cần thiết

### Lỗi: "Khong co hoc sinh nao trong lop"
- **Nguyên nhân**: Lớp chưa có học sinh nào
- **Giải pháp**: Thêm học sinh vào lớp trước khi xuất PDF

### File PDF không tải xuống
- **Giải pháp**:
  - Kiểm tra trình duyệt có chặn popup không
  - Kiểm tra quyền tải xuống file
  - Thử lại hoặc refresh trang

---

## Công nghệ sử dụng

- **jsPDF**: Thư viện tạo PDF
- **jspdf-autotable**: Plugin tạo bảng trong PDF
- **Supabase**: Truy xuất dữ liệu
- **date-fns**: Format ngày tháng

---

Được tạo bởi: Hệ thống Quản lý Lớp học - Điểm danh và Nhận xét
