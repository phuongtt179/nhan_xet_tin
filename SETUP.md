# Hướng dẫn Cài đặt - Hệ thống Quản lý Lớp học (Next.js + Supabase)

Ứng dụng web hiện đại giúp quản lý lớp dạy thêm, điểm danh và thu học phí.

## Công nghệ sử dụng

- **Frontend & Backend**: Next.js 14 (App Router) + TypeScript
- **Database**: Supabase (PostgreSQL)
- **Styling**: TailwindCSS
- **Icons**: Lucide React
- **Deployment**: Vercel (free tier)

## Tính năng

✅ **Dashboard** - Tổng quan thống kê nhanh
✅ **Quản lý lớp học** - Thêm, sửa, xóa thông tin lớp học
✅ **Quản lý học sinh** - Quản lý danh sách học sinh từng lớp
✅ **Điểm danh** - Điểm danh nhanh theo buổi học (Có mặt, Vắng, Muộn, Có phép)
✅ **Quản lý học phí** - Theo dõi học phí đã đóng/chưa đóng theo tháng
✅ **Responsive** - Hoạt động tốt trên mọi thiết bị
✅ **Real-time** - Cập nhật dữ liệu theo thời gian thực

---

## Bước 1: Tạo Supabase Project

### 1.1. Đăng ký Supabase

1. Truy cập [https://supabase.com](https://supabase.com)
2. Click **"Start your project"** hoặc **"Sign in"**
3. Đăng nhập bằng GitHub (khuyến nghị) hoặc email
4. Tài khoản miễn phí cho phép:
   - 500MB database storage
   - 1GB file storage
   - 2GB bandwidth/tháng
   - 50,000 monthly active users

### 1.2. Tạo Project mới

1. Trong dashboard, click **"New project"**
2. Chọn organization (hoặc tạo mới nếu lần đầu)
3. Điền thông tin:
   - **Name**: `class-management` (hoặc tên tùy ý)
   - **Database Password**: Tạo mật khẩu mạnh (lưu lại để sau này)
   - **Region**: Chọn `Southeast Asia (Singapore)` (gần Việt Nam nhất)
   - **Pricing Plan**: Free
4. Click **"Create new project"**
5. Đợi 1-2 phút để Supabase khởi tạo project

### 1.3. Lấy thông tin kết nối

1. Sau khi project đã sẵn sàng, vào **Settings** (biểu tượng ⚙️ ở sidebar)
2. Chọn **API** trong menu Settings
3. Bạn sẽ thấy:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **API Keys** → **anon/public**: `eyJhbGc...` (key rất dài)
4. **Copy** và **lưu lại** 2 thông tin này

---

## Bước 2: Tạo Database Schema

### 2.1. Mở SQL Editor

1. Trong Supabase dashboard, click **SQL Editor** (biểu tượng 📝 ở sidebar)
2. Click **"New query"**

### 2.2. Chạy SQL Schema

1. Mở file `supabase-schema.sql` trong dự án này
2. **Copy toàn bộ nội dung** của file
3. **Paste** vào SQL Editor
4. Click **"Run"** (hoặc Ctrl+Enter)
5. Bạn sẽ thấy thông báo "Success. No rows returned"

### 2.3. Kiểm tra

1. Click **Table Editor** (biểu tượng 📊 ở sidebar)
2. Bạn sẽ thấy 4 bảng đã được tạo:
   - `classes` (Lớp học)
   - `students` (Học sinh)
   - `attendance` (Điểm danh)
   - `payments` (Học phí)

---

## Bước 3: Cài đặt Project trên máy

### 3.1. Yêu cầu hệ thống

- **Node.js** 18.x trở lên ([Download](https://nodejs.org/))
- **npm** hoặc **yarn** hoặc **pnpm**
- **Git** (tùy chọn)

Kiểm tra version:
```bash
node --version
npm --version
```

### 3.2. Cài đặt dependencies

Mở terminal trong thư mục dự án và chạy:

```bash
# Sử dụng npm
npm install

# Hoặc yarn
yarn install

# Hoặc pnpm
pnpm install
```

### 3.3. Cấu hình môi trường

1. **Copy** file `.env.local.example` thành `.env.local`:

```bash
# Windows (Command Prompt)
copy .env.local.example .env.local

# Windows (PowerShell)
Copy-Item .env.local.example .env.local

# macOS/Linux
cp .env.local.example .env.local
```

2. **Mở file** `.env.local` và điền thông tin:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

Thay `xxxxx` bằng **Project URL** và key bằng **anon/public key** từ Bước 1.3

---

## Bước 4: Chạy ứng dụng (Development)

### 4.1. Start development server

```bash
npm run dev
```

### 4.2. Mở trình duyệt

Truy cập: [http://localhost:3000](http://localhost:3000)

Ứng dụng sẽ tự động reload khi bạn sửa code.

### 4.3. Test chức năng

1. **Thêm lớp học** đầu tiên
2. **Thêm học sinh** vào lớp
3. **Điểm danh** cho học sinh
4. **Quản lý học phí** theo tháng

---

## Bước 5: Deploy lên Vercel (Production)

### 5.1. Chuẩn bị

1. Đẩy code lên GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/username/repo-name.git
   git push -u origin main
   ```

### 5.2. Deploy với Vercel

1. Truy cập [https://vercel.com](https://vercel.com)
2. Đăng nhập bằng GitHub
3. Click **"Add New"** → **"Project"**
4. Chọn repository GitHub của bạn
5. **Configure Project**:
   - **Framework Preset**: Next.js (tự động detect)
   - **Root Directory**: `./` (mặc định)
6. **Environment Variables**:
   - Click **"Add"**
   - Thêm 2 biến:
     ```
     NEXT_PUBLIC_SUPABASE_URL = https://xxxxx.supabase.co
     NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGc...
     ```
7. Click **"Deploy"**
8. Đợi 2-3 phút để Vercel build và deploy
9. Bạn sẽ nhận được URL: `https://your-project.vercel.app`

### 5.3. Cập nhật sau khi Deploy

Mỗi khi bạn push code mới lên GitHub, Vercel sẽ tự động deploy lại.

---

## Hướng dẫn sử dụng

### 1. Thêm lớp học

1. Click **"Lớp học"** ở sidebar
2. Click **"Thêm lớp học"**
3. Điền thông tin:
   - Tên lớp (VD: Toán 10A)
   - Môn học (VD: Toán)
   - Lịch học (VD: T2, T4, T6 - 18:00)
   - Học phí/tháng (VD: 500000)
4. Click **"Thêm lớp"**

### 2. Thêm học sinh

1. Click **"Học sinh"** ở sidebar
2. Click **"Thêm học sinh"**
3. Điền thông tin:
   - Họ tên
   - Lớp (chọn từ dropdown)
   - SĐT học sinh (tùy chọn)
   - SĐT phụ huynh (tùy chọn)
   - Ghi chú (tùy chọn)
4. Click **"Thêm học sinh"**

### 3. Điểm danh

1. Click **"Điểm danh"** ở sidebar
2. Chọn **lớp** từ dropdown
3. Chọn **ngày** (mặc định là hôm nay)
4. Click vào trạng thái cho từng học sinh:
   - ✅ **Có mặt** (màu xanh)
   - ❌ **Vắng** (màu đỏ)
   - ⏰ **Muộn** (màu vàng)
   - 📄 **Có phép** (màu xanh dương)
5. Thêm ghi chú nếu cần
6. Click **"Lưu điểm danh"**

### 4. Quản lý học phí

1. Click **"Học phí"** ở sidebar
2. Chọn **lớp** từ dropdown
3. Chọn **tháng** (VD: 2025-01)
4. Click **"Đánh dấu đã đóng"** khi học sinh đóng tiền
5. Hệ thống tự ghi nhận ngày đóng

---

## Cấu trúc thư mục

```
class-management-app/
├── app/                        # Next.js App Router
│   ├── page.tsx               # Dashboard (/)
│   ├── classes/page.tsx       # Quản lý lớp học
│   ├── students/page.tsx      # Quản lý học sinh
│   ├── attendance/page.tsx    # Điểm danh
│   ├── payments/page.tsx      # Học phí
│   ├── layout.tsx             # Layout chính
│   └── globals.css            # Global styles
├── components/
│   └── Sidebar.tsx            # Sidebar navigation
├── lib/
│   └── supabase.ts            # Supabase client & types
├── supabase-schema.sql        # Database schema
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.mjs
```

---

## Troubleshooting

### Lỗi kết nối Supabase

**Lỗi**: "Missing Supabase environment variables"

**Giải pháp**:
- Kiểm tra file `.env.local` có tồn tại không
- Kiểm tra URL và key có đúng không
- Restart development server (Ctrl+C, rồi `npm run dev` lại)

### Lỗi CORS khi deploy

**Lỗi**: "CORS policy blocked"

**Giải pháp**:
1. Vào Supabase dashboard
2. Settings → API → CORS
3. Thêm domain Vercel của bạn vào allowed origins

### Database schema không chạy

**Lỗi**: "relation does not exist"

**Giải pháp**:
1. Vào SQL Editor trong Supabase
2. Chạy lại toàn bộ file `supabase-schema.sql`
3. Kiểm tra Table Editor xem có 4 bảng chưa

### Build error khi deploy

**Lỗi**: "Module not found" hoặc "Type error"

**Giải pháp**:
1. Chạy `npm run build` local để test
2. Fix các TypeScript errors
3. Commit và push lại

---

## Nâng cấp & Tính năng mở rộng

### Bảo mật

- Thêm authentication với Supabase Auth
- Phân quyền user (admin, giáo viên, phụ huynh)
- Row Level Security (RLS) policies nâng cao

### Tính năng

- 📊 Báo cáo thống kê (biểu đồ)
- 📧 Gửi email/SMS thông báo
- 📄 Export PDF báo cáo
- 💳 Tích hợp thanh toán online
- 📱 Progressive Web App (PWA)
- 🔔 Real-time notifications

### Performance

- Caching với React Query
- Image optimization
- Code splitting
- Database indexing

---

## Liên hệ & Hỗ trợ

### Tài liệu tham khảo

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [TailwindCSS Documentation](https://tailwindcss.com/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

### Debug

1. Kiểm tra **Console** trong Browser DevTools (F12)
2. Kiểm tra **Network tab** để xem API calls
3. Kiểm tra **Supabase Logs** trong dashboard
4. Kiểm tra **Vercel Logs** nếu deploy

---

**Chúc bạn sử dụng hiệu quả!** 🎓

Made with ❤️ for teachers

---

## License

MIT License - Free to use for personal and commercial projects.
