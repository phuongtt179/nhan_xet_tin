'use client';

import { useEffect, useState } from 'react';
import { supabase, Class } from '@/lib/supabase';
import { Plus, Edit2, Trash2, X } from 'lucide-react';

export default function ClassesPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    schedule: '',
    tuition: '',
  });

  useEffect(() => {
    loadClasses();
  }, []);

  async function loadClasses() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClasses(data || []);
    } catch (error) {
      console.error('Error loading classes:', error);
      alert('Lỗi khi tải danh sách lớp học');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      if (editingClass) {
        // Update
        const { error } = await supabase
          .from('classes')
          .update({
            name: formData.name,
            subject: formData.subject,
            schedule: formData.schedule,
            tuition: parseFloat(formData.tuition),
          })
          .eq('id', editingClass.id);

        if (error) throw error;
        alert('Cập nhật lớp học thành công!');
      } else {
        // Create
        const { error } = await supabase
          .from('classes')
          .insert([{
            name: formData.name,
            subject: formData.subject,
            schedule: formData.schedule,
            tuition: parseFloat(formData.tuition),
          }]);

        if (error) throw error;
        alert('Thêm lớp học thành công!');
      }

      closeModal();
      loadClasses();
    } catch (error) {
      console.error('Error saving class:', error);
      alert('Lỗi khi lưu lớp học');
    }
  }

  async function handleDelete(classId: string, className: string) {
    if (!confirm(`Bạn có chắc muốn xóa lớp "${className}"?\nLưu ý: Tất cả học sinh, điểm danh và học phí liên quan sẽ bị xóa.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('classes')
        .delete()
        .eq('id', classId);

      if (error) throw error;
      alert('Xóa lớp học thành công!');
      loadClasses();
    } catch (error) {
      console.error('Error deleting class:', error);
      alert('Lỗi khi xóa lớp học');
    }
  }

  function openAddModal() {
    setEditingClass(null);
    setFormData({ name: '', subject: '', schedule: '', tuition: '' });
    setShowModal(true);
  }

  function openEditModal(classItem: Class) {
    setEditingClass(classItem);
    setFormData({
      name: classItem.name,
      subject: classItem.subject,
      schedule: classItem.schedule,
      tuition: classItem.tuition.toString(),
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingClass(null);
    setFormData({ name: '', subject: '', schedule: '', tuition: '' });
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Quản lý Lớp học</h1>
          <p className="text-gray-600 mt-1">Danh sách các lớp dạy thêm</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold shadow-lg hover:shadow-xl"
        >
          <Plus size={20} />
          Thêm lớp học
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : classes.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 text-lg">Chưa có lớp học nào</p>
          <p className="text-gray-400 mt-2">Nhấn "Thêm lớp học" để bắt đầu</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map((classItem) => (
            <div
              key={classItem.id}
              className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all p-6 border-2 border-transparent hover:border-blue-400"
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-gray-800">{classItem.name}</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEditModal(classItem)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Sửa"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(classItem.id, classItem.name)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Xóa"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              <div className="space-y-2 text-gray-600">
                <p><span className="font-semibold">Môn học:</span> {classItem.subject}</p>
                <p><span className="font-semibold">Lịch học:</span> {classItem.schedule}</p>
                <p className="text-lg font-bold text-blue-600 mt-3">
                  {classItem.tuition.toLocaleString('vi-VN')} đ/tháng
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-800">
                {editingClass ? 'Sửa lớp học' : 'Thêm lớp học mới'}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tên lớp <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder="VD: Toán 10A"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Môn học <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder="VD: Toán"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Lịch học <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.schedule}
                  onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder="VD: T2, T4, T6 - 18:00"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Học phí/tháng (VNĐ) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="1000"
                  value={formData.tuition}
                  onChange={(e) => setFormData({ ...formData, tuition: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder="VD: 500000"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                >
                  {editingClass ? 'Cập nhật' : 'Thêm lớp'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
