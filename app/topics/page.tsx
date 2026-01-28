'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Topic, Grade, Subject } from '@/lib/types';
import { FileText, Plus, Edit2, Trash2, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function TopicsPage() {
  const { user, isAdmin, getAssignedSubjects } = useAuth();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedGradeId, setSelectedGradeId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    grade_id: '',
    subject_id: '',
  });

  useEffect(() => {
    loadSubjects();
    loadGrades();
  }, [user]);

  useEffect(() => {
    if (selectedSubjectId && selectedGradeId) {
      loadTopics();
    } else {
      setTopics([]);
      setLoading(false);
    }
  }, [selectedSubjectId, selectedGradeId]);

  async function loadSubjects() {
    try {
      if (!user) return;

      if (isAdmin) {
        // Admin: load all subjects
        const { data, error } = await supabase
          .from('subjects')
          .select('*')
          .eq('is_active', true)
          .order('name');

        if (error) throw error;
        setSubjects(data || []);
      } else {
        // Teacher: load only assigned subjects
        const assignedSubjects = getAssignedSubjects();
        setSubjects(assignedSubjects);
        // Auto-select if only one subject
        if (assignedSubjects.length === 1) {
          setSelectedSubjectId(assignedSubjects[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading subjects:', error);
    }
  }

  async function loadGrades() {
    try {
      const { data, error } = await supabase
        .from('grades')
        .select('*')
        .order('name');

      if (error) throw error;
      setGrades(data || []);
    } catch (error) {
      console.error('Error loading grades:', error);
      alert('Không thể tải danh sách khối!');
    }
  }

  async function loadTopics() {
    try {
      setLoading(true);
      let query = supabase
        .from('topics')
        .select(`
          *,
          grades (
            id,
            name
          ),
          subjects (
            id,
            name
          )
        `)
        .eq('grade_id', selectedGradeId)
        .eq('subject_id', selectedSubjectId)
        .order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      setTopics(data || []);
    } catch (error) {
      console.error('Error loading topics:', error);
      alert('Không thể tải danh sách chủ đề!');
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
    setEditingTopic(null);
    setFormData({
      name: '',
      description: '',
      grade_id: selectedGradeId,
      subject_id: selectedSubjectId,
    });
    setShowModal(true);
  }

  function openEditModal(topic: Topic) {
    setEditingTopic(topic);
    setFormData({
      name: topic.name,
      description: topic.description || '',
      grade_id: topic.grade_id,
      subject_id: topic.subject_id || selectedSubjectId,
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingTopic(null);
    setFormData({
      name: '',
      description: '',
      grade_id: selectedGradeId,
      subject_id: selectedSubjectId,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      if (editingTopic) {
        // Update existing topic
        const { error } = await supabase
          .from('topics')
          .update({
            name: formData.name,
            description: formData.description || null,
            grade_id: formData.grade_id,
            subject_id: formData.subject_id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingTopic.id);

        if (error) throw error;
        alert('Cập nhật chủ đề thành công!');
      } else {
        // Create new topic
        const { error } = await supabase
          .from('topics')
          .insert([{
            name: formData.name,
            description: formData.description || null,
            grade_id: formData.grade_id,
            subject_id: formData.subject_id,
          }]);

        if (error) throw error;
        alert('Thêm chủ đề mới thành công!');
      }

      closeModal();
      loadTopics();
    } catch (error) {
      console.error('Error saving topic:', error);
      alert('Có lỗi xảy ra khi lưu chủ đề!');
    }
  }

  async function handleDelete(topic: Topic) {
    if (!confirm(`Bạn có chắc muốn xóa chủ đề "${topic.name}"? Tất cả tiêu chí và đánh giá liên quan sẽ bị xóa.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('topics')
        .delete()
        .eq('id', topic.id);

      if (error) throw error;
      alert('Xóa chủ đề thành công!');
      loadTopics();
    } catch (error) {
      console.error('Error deleting topic:', error);
      alert('Không thể xóa chủ đề!');
    }
  }

  const selectedGrade = grades.find(g => g.id === selectedGradeId);

  return (
    <div className="p-4 lg:p-8 pb-20 lg:pb-8">
      {/* Header */}
      <div className="mb-6 lg:mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-800 flex items-center gap-2">
          <FileText className="text-blue-600" size={32} />
          Quản lý Chủ đề
        </h1>
        <p className="text-sm lg:text-base text-gray-600 mt-1">
          Quản lý các chủ đề đánh giá theo từng khối
        </p>
      </div>

      {/* Subject & Grade Selector */}
      <div className="bg-white rounded-lg lg:rounded-xl shadow-md p-4 lg:p-6 mb-6 space-y-4">
        {/* Subject Selector */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Chọn Môn học <span className="text-red-500">*</span>
          </label>
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
          >
            <option value="">-- Chọn môn học --</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
          {!isAdmin && subjects.length === 0 && (
            <p className="text-sm text-orange-600 mt-1">
              Bạn chưa được phân công môn học nào.
            </p>
          )}
        </div>

        {/* Grade Selector */}
        {selectedSubjectId && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Chọn Khối <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedGradeId}
              onChange={(e) => setSelectedGradeId(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
            >
              <option value="">-- Chọn khối để xem chủ đề --</option>
              {grades.map((grade) => (
                <option key={grade.id} value={grade.id}>
                  {grade.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Add Button */}
      {selectedSubjectId && selectedGradeId && (
        <div className="mb-6">
          <button
            onClick={openAddModal}
            className="w-full lg:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={20} />
            Thêm chủ đề
          </button>
        </div>
      )}

      {/* Topics List */}
      {!selectedSubjectId ? (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 text-center">
          <FileText className="mx-auto text-blue-400 mb-3" size={48} />
          <p className="text-blue-800 font-semibold">Vui lòng chọn môn học để bắt đầu</p>
        </div>
      ) : !selectedGradeId ? (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 text-center">
          <FileText className="mx-auto text-blue-400 mb-3" size={48} />
          <p className="text-blue-800 font-semibold">Vui lòng chọn khối để xem danh sách chủ đề</p>
        </div>
      ) : loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : topics.length === 0 ? (
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6 text-center">
          <FileText className="mx-auto text-yellow-400 mb-3" size={48} />
          <p className="text-yellow-800 font-semibold mb-2">
            Chưa có chủ đề nào cho {selectedGrade?.name}
          </p>
          <p className="text-sm text-yellow-700">
            Nhấn nút &quot;Thêm chủ đề&quot; để tạo chủ đề mới
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block bg-white rounded-xl shadow-md overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Tên chủ đề
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Mô tả
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Môn học
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Khối
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {topics.map((topic) => (
                  <tr key={topic.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-gray-900">{topic.name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600">
                        {topic.description || <span className="text-gray-400 italic">Không có mô tả</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                        {(topic as any).subjects?.name}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-semibold">
                        {(topic as any).grades?.name}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => openEditModal(topic)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Sửa"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(topic)}
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
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-4">
            {topics.map((topic) => (
              <div key={topic.id} className="bg-white rounded-lg shadow-md p-4 border-2 border-gray-100">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-base mb-1">{topic.name}</h3>
                    <div className="flex flex-wrap gap-1">
                      <span className="inline-block px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                        {(topic as any).subjects?.name}
                      </span>
                      <span className="inline-block px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-semibold">
                        {(topic as any).grades?.name}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditModal(topic)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(topic)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                {topic.description && (
                  <p className="text-sm text-gray-600">{topic.description}</p>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">
                {editingTopic ? 'Sửa chủ đề' : 'Thêm chủ đề mới'}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Subject - Read only display */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Môn học <span className="text-red-500">*</span>
                </label>
                <div className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-700">
                  {subjects.find(s => s.id === formData.subject_id)?.name || 'Chưa chọn môn học'}
                </div>
                <p className="text-xs text-gray-500 mt-1">Môn học được xác định từ lựa chọn ở trên</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Khối <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.grade_id}
                  onChange={(e) => setFormData({ ...formData, grade_id: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                >
                  <option value="">-- Chọn khối --</option>
                  {grades.map((grade) => (
                    <option key={grade.id} value={grade.id}>
                      {grade.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tên chủ đề <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder="Ví dụ: Làm quen với máy tính"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Mô tả
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder="Mô tả về chủ đề này..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  {editingTopic ? 'Cập nhật' : 'Thêm'}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-6 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
