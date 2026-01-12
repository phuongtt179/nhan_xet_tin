'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Grade } from '@/lib/types';
import { Layers, Plus, Edit2, Trash2 } from 'lucide-react';

export default function GradesPage() {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingGrade, setEditingGrade] = useState<Grade | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  useEffect(() => {
    loadGrades();
  }, []);

  async function loadGrades() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('grades')
        .select('*')
        .order('name');

      if (error) throw error;
      setGrades(data || []);
    } catch (error) {
      console.error('Error loading grades:', error);
      alert('Không thể tải danh sách khối lớp');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      if (editingGrade) {
        // Update
        const { error } = await supabase
          .from('grades')
          .update({
            name: formData.name,
            description: formData.description,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingGrade.id);

        if (error) throw error;
        alert('Cập nhật khối thành công!');
      } else {
        // Insert
        const { error } = await supabase
          .from('grades')
          .insert([{
            name: formData.name,
            description: formData.description,
          }]);

        if (error) throw error;
        alert('Thêm khối thành công!');
      }

      setShowForm(false);
      setEditingGrade(null);
      setFormData({ name: '', description: '' });
      loadGrades();
    } catch (error: any) {
      console.error('Error saving grade:', error);
      alert(error.message || 'Có lỗi xảy ra');
    }
  }

  async function handleDelete(grade: Grade) {
    if (!confirm(`Bạn có chắc muốn xóa khối "${grade.name}"?\n\nLưu ý: Tất cả lớp học, chủ đề và dữ liệu liên quan sẽ bị xóa!`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('grades')
        .delete()
        .eq('id', grade.id);

      if (error) throw error;
      alert('Xóa khối thành công!');
      loadGrades();
    } catch (error: any) {
      console.error('Error deleting grade:', error);
      alert(error.message || 'Không thể xóa khối');
    }
  }

  function openEditForm(grade: Grade) {
    setEditingGrade(grade);
    setFormData({
      name: grade.name,
      description: grade.description || '',
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingGrade(null);
    setFormData({ name: '', description: '' });
  }

  return (
    <div className="p-4 lg:p-8 pb-20 lg:pb-8">
      <div className="mb-6 lg:mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-800 flex items-center gap-2">
            <Layers className="text-blue-600" />
            Quản lý Khối lớp
          </h1>
          <p className="text-sm lg:text-base text-gray-600 mt-1">
            Khối 3, Khối 4, Khối 5...
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 lg:px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors text-sm lg:text-base"
        >
          <Plus size={20} />
          <span className="hidden lg:inline">Thêm khối</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block bg-white rounded-xl shadow-md overflow-hidden">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-bold">STT</th>
                  <th className="px-6 py-4 text-left text-sm font-bold">Tên khối</th>
                  <th className="px-6 py-4 text-left text-sm font-bold">Mô tả</th>
                  <th className="px-6 py-4 text-center text-sm font-bold">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {grades.map((grade, index) => (
                  <tr key={grade.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-gray-600">{index + 1}</td>
                    <td className="px-6 py-4 font-semibold text-gray-800">{grade.name}</td>
                    <td className="px-6 py-4 text-gray-600">{grade.description || '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEditForm(grade)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Sửa"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(grade)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Xóa"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {grades.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                Chưa có khối lớp nào. Nhấn "Thêm khối" để tạo mới.
              </div>
            )}
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-3">
            {grades.map((grade, index) => (
              <div key={grade.id} className="bg-white rounded-lg shadow-md p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="text-xs text-gray-500 mb-1">#{index + 1}</div>
                    <h3 className="font-bold text-gray-800 text-base">{grade.name}</h3>
                    {grade.description && (
                      <p className="text-sm text-gray-600 mt-1">{grade.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 mt-3 pt-3 border-t">
                  <button
                    onClick={() => openEditForm(grade)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg font-semibold text-sm"
                  >
                    <Edit2 size={16} />
                    Sửa
                  </button>
                  <button
                    onClick={() => handleDelete(grade)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-lg font-semibold text-sm"
                  >
                    <Trash2 size={16} />
                    Xóa
                  </button>
                </div>
              </div>
            ))}
            {grades.length === 0 && (
              <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
                Chưa có khối lớp nào. Nhấn "Thêm khối" để tạo mới.
              </div>
            )}
          </div>
        </>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              {editingGrade ? 'Sửa khối lớp' : 'Thêm khối lớp'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tên khối <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ví dụ: Khối 3"
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Mô tả
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Ví dụ: Học sinh lớp 3"
                    rows={3}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={closeForm}
                  className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  {editingGrade ? 'Cập nhật' : 'Thêm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
