# Hệ thống Quản lý Lớp học & Điểm danh

Ứng dụng web hiện đại được xây dựng với **Next.js 14 + TypeScript + Supabase**

## 🎯 Tính năng

✅ **Dashboard** - Tổng quan thống kê (lớp học, học sinh, điểm danh, học phí)
✅ **Quản lý Lớp học** - CRUD operations hoàn chỉnh
✅ **Quản lý Học sinh** - Phân lớp, lọc theo lớp, quản lý thông tin
✅ **Điểm danh** - 4 trạng thái (Có mặt, Vắng, Muộn, Có phép)
✅ **Quản lý Học phí** - Theo dõi theo tháng, đánh dấu đã/chưa đóng
✅ **Responsive Design** - Hoạt động tốt trên mọi thiết bị
✅ **TypeScript** - Type-safe, giảm lỗi
✅ **Modern UI** - TailwindCSS, Lucide icons

## 🚀 Công nghệ

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **Styling**: TailwindCSS
- **Icons**: Lucide React
- **Date Handling**: date-fns
- **Deployment**: Vercel

## 📁 Cấu trúc Project

```
├── app/
│   ├── page.tsx              # Dashboard
│   ├── classes/page.tsx      # Quản lý lớp học
│   ├── students/page.tsx     # Quản lý học sinh
│   ├── attendance/page.tsx   # Điểm danh
│   ├── payments/page.tsx     # Học phí
│   ├── layout.tsx            # Root layout
│   └── globals.css           # Global styles
├── components/
│   └── Sidebar.tsx           # Navigation sidebar
├── lib/
│   └── supabase.ts           # Supabase client & types
├── supabase-schema.sql       # Database schema
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.mjs
└── .env.local.example        # Environment variables template
```

## 📦 Database Schema

### Tables

1. **classes** - Lớp học
   - id, name, subject, schedule, tuition

2. **students** - Học sinh
   - id, name, phone, parent_phone, class_id, note

3. **attendance** - Điểm danh
   - id, student_id, class_id, date, status, note
   - Unique constraint: (student_id, class_id, date)

4. **payments** - Học phí
   - id, student_id, class_id, month, amount, paid_date, status
   - Unique constraint: (student_id, class_id, month)

## 🛠️ Cài đặt & Chạy

### Bước 1: Clone hoặc tải project

```bash
cd f:\UNG DUNG\DIEM_DANH
```

### Bước 2: Cài dependencies

```bash
npm install
```

### Bước 3: Tạo Supabase Project

1. Đăng ký tài khoản tại [https://supabase.com](https://supabase.com)
2. Tạo project mới (chọn region Singapore)
3. Lấy **Project URL** và **anon key** từ Settings → API

### Bước 4: Setup Database

1. Vào **SQL Editor** trong Supabase
2. Copy nội dung file `supabase-schema.sql`
3. Paste vào SQL Editor và chạy
4. Kiểm tra **Table Editor** - sẽ có 4 tables

### Bước 5: Cấu hình môi trường

1. Copy file `.env.local.example` thành `.env.local`
2. Điền thông tin Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

### Bước 6: Chạy development server

```bash
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000)

## 🌐 Deploy lên Vercel

1. Push code lên GitHub
2. Truy cập [https://vercel.com](https://vercel.com)
3. Import repository
4. Thêm environment variables (2 biến từ `.env.local`)
5. Deploy!

Xem hướng dẫn chi tiết trong [SETUP.md](SETUP.md)

## 📖 Hướng dẫn sử dụng

### 1. Thêm lớp học
- Vào trang "Lớp học"
- Click "Thêm lớp học"
- Nhập: Tên lớp, Môn học, Lịch học, Học phí/tháng

### 2. Thêm học sinh
- Vào trang "Học sinh"
- Click "Thêm học sinh"
- Chọn lớp và nhập thông tin học sinh

### 3. Điểm danh
- Vào trang "Điểm danh"
- Chọn lớp và ngày
- Click vào trạng thái: Có mặt / Vắng / Muộn / Có phép
- Click "Lưu điểm danh"

### 4. Quản lý học phí
- Vào trang "Học phí"
- Chọn lớp và tháng
- Click "Đánh dấu đã đóng" khi học sinh nộp tiền

## 🎨 Screenshots

### Dashboard
- Thống kê tổng quan
- Tỷ lệ điểm danh hôm nay
- Học phí tháng hiện tại
- Quick actions

### Quản lý Lớp học
- Card view với hover effects
- CRUD operations
- Responsive grid layout

### Quản lý Học sinh
- Table view với filter
- Thông tin chi tiết
- Badge hiển thị lớp

### Điểm danh
- List view từng học sinh
- 4 trạng thái với màu sắc khác nhau
- Ghi chú cho mỗi học sinh
- Thống kê real-time

### Học phí
- Table view với status badges
- Đánh dấu đã/chưa đóng
- Tổng hợp số liệu theo tháng

## 🔧 Scripts

```bash
# Development
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint
npm run lint
```

## 📝 Notes

### Row Level Security (RLS)

Database hiện tại cho phép mọi operations (policies allow all). Trong production, bạn nên:

1. Enable authentication với Supabase Auth
2. Tạo RLS policies dựa trên user roles
3. Giới hạn quyền truy cập

### Environment Variables

**QUAN TRỌNG**: Không commit file `.env.local` lên Git!

File `.gitignore` đã được cấu hình để bỏ qua:
- `.env*.local`
- `.env`

## 🚧 Tính năng nâng cao (TODO)

- [ ] Authentication & Authorization
- [ ] Báo cáo thống kê với biểu đồ
- [ ] Export PDF
- [ ] Email/SMS notifications
- [ ] Multiple teachers/admin support
- [ ] Student portal
- [ ] Mobile app (React Native)
- [ ] Offline support (PWA)
- [ ] Payment gateway integration

## 📚 Tài liệu tham khảo

- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [TailwindCSS Docs](https://tailwindcss.com/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - Free to use for personal and commercial projects.

---

**Made with ❤️ for teachers**

Nếu gặp vấn đề, xem hướng dẫn chi tiết trong [SETUP.md](SETUP.md)
