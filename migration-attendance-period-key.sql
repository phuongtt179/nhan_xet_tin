-- Đổi ràng buộc UNIQUE của attendance/equipment_checks: trước đây chỉ (student_id, class_id, date)
-- khiến 1 học sinh chỉ có được 1 dòng/ngày cho cả lớp — nếu dạy nhiều tiết/môn khác nhau cùng lớp
-- cùng ngày (vd tiết 1 Tin, tiết 4 Công nghệ) thì dòng ghi sau sẽ ghi đè mất dòng ghi trước.
-- Đã chạy trực tiếp trên DB thật qua Supabase Management API — file này lưu lại để đối chiếu.

ALTER TABLE attendance DROP CONSTRAINT attendance_student_id_class_id_date_key;
ALTER TABLE attendance ADD CONSTRAINT attendance_student_id_class_id_date_period_key UNIQUE (student_id, class_id, date, period);

ALTER TABLE equipment_checks DROP CONSTRAINT equipment_checks_student_id_class_id_date_key;
ALTER TABLE equipment_checks ADD CONSTRAINT equipment_checks_student_id_class_id_date_period_key UNIQUE (student_id, class_id, date, period);
