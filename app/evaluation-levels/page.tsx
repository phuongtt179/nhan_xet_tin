'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { EvaluationLevel } from '@/lib/types';
import { Star, Plus, Edit2, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

export default function EvaluationLevelsPage() {
  const [levels, setLevels] = useState<EvaluationLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingLevel, setEditingLevel] = useState<EvaluationLevel | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#22c55e',
    display_order: 0,
  });

  useEffect(() => {
    loadLevels();
  }, []);

  async function loadLevels() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('evaluation_levels')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;
      setLevels(data || []);
    } catch (error) {
      console.error('Error loading evaluation levels:', error);
      alert('Không thể tải danh sách mức đánh giá');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      if (editingLevel) {
        // Update
        const { error } = await supabase
          .from('evaluation_levels')
          .update({
            name: formData.name,
            description: formData.description,
            color: formData.color,
            display_order: formData.display_order,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingLevel.id);

        if (error) throw error;
        alert('Cập nhật mức đánh giá thành công!');
      } else {
        // Insert
        const { error } = await supabase
          .from('evaluation_levels')
          .insert([{
            name: formData.name,
            description: formData.description,
            color: formData.color,
            display_order: formData.display_order,
          }]);

        if (error) throw error;
        alert('Thêm mức đánh giá thành công!');
      }

      setShowForm(false);
      setEditingLevel(null);
      setFormData({ name: '', description: '', color: '#22c55e', display_order: 0 });
      loadLevels();
    } catch (error: any) {
      console.error('Error saving evaluation level:', error);
      alert(error.message || 'Có lỗi xảy ra');
    }
  }

  async function handleDelete(level: EvaluationLevel) {
    if (!confirm(`Bạn có chắc muốn xóa mức "${level.name}"?\n\nLưu ý: Mức này sẽ bị ẩn khỏi hệ thống!`)) {
      return;
    }

    try {
      // Soft delete - set is_active to false
      const { error } = await supabase
        .from('evaluation_levels')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', level.id);

      if (error) throw error;
      alert('Xóa mức đánh giá thành công!');
      loadLevels();
    } catch (error: any) {
      console.error('Error deleting evaluation level:', error);
      alert(error.message || 'Không thể xóa mức đánh giá');
    }
  }

  async function handleMove(level: EvaluationLevel, direction: 'up' | 'down') {
    const currentIndex = levels.findIndex(l => l.id === level.id);
    if (
      (direction === 'up' && currentIndex === 0) ||
      (direction === 'down' && currentIndex === levels.length - 1)
    ) {
      return;
    }

    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const swapLevel = levels[swapIndex];

    try {
      // Swap display_order
      await supabase
        .from('evaluation_levels')
        .update({ display_order: swapLevel.display_order })
        .eq('id', level.id);

      await supabase
        .from('evaluation_levels')
        .update({ display_order: level.display_order })
        .eq('id', swapLevel.id);

      loadLevels();
    } catch (error) {
      console.error('Error moving level:', error);
      alert('Không thể di chuyển mức đánh giá');
    }
  }

  function openEditForm(level: EvaluationLevel) {
    setEditingLevel(level);
    setFormData({
      name: level.name,
      description: level.description || '',
      color: level.color,
      display_order: level.display_order,
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingLevel(null);
    setFormData({ name: '', description: '', color: '#22c55e', display_order: 0 });
  }

  return (
    <div className="p-4 lg:p-8 pb-20 lg:pb-8">
      <div className="mb-6 lg:mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-800 flex items-center gap-2">
            <Star className="text-yellow-600" />
            Quản lý Mức đánh giá
          </h1>
          <p className="text-sm lg:text-base text-gray-600 mt-1">
            Cấu hình các mức đánh giá học sinh
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 lg:px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors text-sm lg:text-base"
        >
          <Plus size={20} />
          <span className="hidden lg:inline">Thêm mức</span>
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
                  <th className="px-6 py-4 text-left text-sm font-bold">Tên mức</th>
                  <th className="px-6 py-4 text-left text-sm font-bold">Mô tả</th>
                  <th className="px-6 py-4 text-left text-sm font-bold">Màu sắc</th>
                  <th className="px-6 py-4 text-center text-sm font-bold">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {levels.map((level, index) => (
                  <tr key={level.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-gray-600">{index + 1}</td>
                    <td className="px-6 py-4">
                      <span
                        className="inline-block px-3 py-1 rounded-full text-sm font-semibold text-white"
                        style={{ backgroundColor: level.color }}
                      >
                        {level.name}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{level.description || '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded border-2 border-gray-300"
                          style={{ backgroundColor: level.color }}
                        ></div>
                        <span className="text-sm text-gray-600">{level.color}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleMove(level, 'up')}
                          disabled={index === 0}
                          className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Di chuyển lên"
                        >
                          <ArrowUp size={18} />
                        </button>
                        <button
                          onClick={() => handleMove(level, 'down')}
                          disabled={index === levels.length - 1}
                          className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Di chuyển xuống"
                        >
                          <ArrowDown size={18} />
                        </button>
                        <button
                          onClick={() => openEditForm(level)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Sửa"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(level)}
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
            {levels.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                Chưa có mức đánh giá nào. Nhấn "Thêm mức" để tạo mới.
              </div>
            )}
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-3">
            {levels.map((level, index) => (
              <div key={level.id} className="bg-white rounded-lg shadow-md p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="text-xs text-gray-500 mb-1">#{index + 1}</div>
                    <span
                      className="inline-block px-3 py-1 rounded-full text-sm font-semibold text-white"
                      style={{ backgroundColor: level.color }}
                    >
                      {level.name}
                    </span>
                    {level.description && (
                      <p className="text-sm text-gray-600 mt-2">{level.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <div
                        className="w-5 h-5 rounded border-2 border-gray-300"
                        style={{ backgroundColor: level.color }}
                      ></div>
                      <span className="text-xs text-gray-500">{level.color}</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t">
                  <button
                    onClick={() => handleMove(level, 'up')}
                    disabled={index === 0}
                    className="flex items-center justify-center px-2 py-2 bg-gray-50 text-gray-600 rounded-lg text-sm disabled:opacity-30"
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    onClick={() => handleMove(level, 'down')}
                    disabled={index === levels.length - 1}
                    className="flex items-center justify-center px-2 py-2 bg-gray-50 text-gray-600 rounded-lg text-sm disabled:opacity-30"
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button
                    onClick={() => openEditForm(level)}
                    className="flex items-center justify-center px-2 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(level)}
                    className="flex items-center justify-center px-2 py-2 bg-red-50 text-red-600 rounded-lg text-sm"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
            {levels.length === 0 && (
              <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
                Chưa có mức đánh giá nào. Nhấn "Thêm mức" để tạo mới.
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
              {editingLevel ? 'Sửa mức đánh giá' : 'Thêm mức đánh giá'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tên mức <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ví dụ: Tốt, Khá, Trung bình"
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
                    placeholder="Mô tả chi tiết về mức đánh giá này"
                    rows={3}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Màu sắc <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="w-16 h-10 border-2 border-gray-300 rounded-lg cursor-pointer"
                      required
                    />
                    <input
                      type="text"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      placeholder="#22c55e"
                      pattern="^#[0-9A-Fa-f]{6}$"
                      className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                      required
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Mã màu hex (ví dụ: #22c55e)
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Thứ tự hiển thị
                  </label>
                  <input
                    type="number"
                    value={formData.display_order}
                    onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Số càng nhỏ càng ưu tiên (1, 2, 3...)
                  </p>
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
                  {editingLevel ? 'Cập nhật' : 'Thêm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
