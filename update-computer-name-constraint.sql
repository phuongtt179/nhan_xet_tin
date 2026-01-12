-- Xóa constraint UNIQUE cũ (toàn hệ thống)
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_computer_name_key;

-- Tạo constraint UNIQUE mới (unique trong từng lớp)
ALTER TABLE students 
ADD CONSTRAINT students_class_computer_unique 
UNIQUE (class_id, computer_name);

-- Comment để giải thích
COMMENT ON CONSTRAINT students_class_computer_unique ON students IS 
'Tên máy phải unique trong từng lớp, nhưng có thể trùng giữa các lớp khác nhau';
