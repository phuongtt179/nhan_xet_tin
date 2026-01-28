'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Subject, Class, TeacherAssignment } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, ClipboardPen, Filter, Check } from 'lucide-react';

export default function AssignmentsPage() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [schoolYears, setSchoolYears] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  const [formData, setFormData] = useState({
    user_id: '',
    class_ids: [] as string[],
    subject_id: '',
    school_year: '',
    is_homeroom: false,
  });

  useEffect(() => {
    if (!isAdmin) {
      router.push('/');
      return;
    }
    loadData();
  }, [isAdmin, router]);

  useEffect(() => {
    if (selectedYear) {
      loadAssignments();
    }
  }, [selectedYear, selectedUserId]);

  async function loadData() {
    try {
      // Load users (include admin too)
      const { data: usersData } = await supabase
        .from('users')
        .select('*')
        .eq('is_active', true)
        .order('full_name');
      setUsers(usersData || []);

      // Load subjects
      const { data: subjectsData } = await supabase
        .from('subjects')
        .select('*')
        .eq('is_active', true)
        .order('name');
      setSubjects(subjectsData || []);

      // Load school years
      const { data: classesData } = await supabase
        .from('classes')
        .select('school_year')
        .order('school_year', { ascending: false });

      const years = Array.from(new Set(classesData?.map(c => c.school_year) || []));
      setSchoolYears(years);
      if (years.length > 0) {
        setSelectedYear(years[0]);
        setFormData(prev => ({ ...prev, school_year: years[0] }));
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadClassesForYear(year: string) {
    const { data } = await supabase
      .from('classes')
      .select(`*, grades(name)`)
      .eq('school_year', year)
      .order('name');
    setClasses(data || []);
  }

  useEffect(() => {
    if (selectedYear) {
      loadClassesForYear(selectedYear);
    }
  }, [selectedYear]);

  async function loadAssignments() {
    try {
      let query = supabase
        .from('teacher_assignments')
        .select(`
          *,
          users (*),
          classes (*, grades(name)),
          subjects (*)
        `)
        .eq('school_year', selectedYear)
        .order('created_at', { ascending: false });

      if (selectedUserId) {
        query = query.eq('user_id', selectedUserId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setAssignments(data || []);
    } catch (error) {
      console.error('Error loading assignments:', error);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (formData.class_ids.length === 0) {
      alert('Vui lòng chọn ít nhất 1 lớp');
      return;
    }

    setSubmitting(true);

    try {
      // Create assignments for all selected classes
      const insertData = formData.class_ids.map(class_id => ({
        user_id: formData.user_id,
        class_id,
        subject_id: formData.subject_id,
        school_year: formData.school_year,
        is_homeroom: formData.is_homeroom,
      }));

      const { error } = await supabase
        .from('teacher_assignments')
        .insert(insertData);

      if (error) throw error;

      setShowModal(false);
      resetForm();
      loadAssignments();
      alert(`Đã thêm ${formData.class_ids.length} phân công thành công!`);
    } catch (error: any) {
      if (error.code === '23505') {
        alert('Một số phân công đã tồn tại!');
      } else {
        alert(error.message || 'Có lỗi xảy ra');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(assignment: TeacherAssignment) {
    if (!confirm('Bạn có chắc muốn xóa phân công này?')) return;

    try {
      const { error } = await supabase
        .from('teacher_assignments')
        .delete()
        .eq('id', assignment.id);

      if (error) throw error;
      loadAssignments();
    } catch (error: any) {
      alert(error.message || 'Có lỗi xảy ra khi xóa');
    }
  }

  function resetForm() {
    setFormData({
      user_id: '',
      class_ids: [],
      subject_id: '',
      school_year: selectedYear,
      is_homeroom: false,
    });
  }

  function toggleClass(classId: string) {
    setFormData(prev => ({
      ...prev,
      class_ids: prev.class_ids.includes(classId)
        ? prev.class_ids.filter(id => id !== classId)
        : [...prev.class_ids, classId]
    }));
  }

  function selectAllClasses() {
    setFormData(prev => ({
      ...prev,
      class_ids: classes.map(c => c.id)
    }));
  }

  function deselectAllClasses() {
    setFormData(prev => ({
      ...prev,
      class_ids: []
    }));
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 pb-24 lg:pb-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-800 flex items-center gap-3">
            <ClipboardPen className="text-blue-600" />
            Phân công giảng dạy
          </h1>
          <p className="text-gray-600 mt-1">Gán giáo viên dạy lớp và môn học</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Plus size={20} />
          Thêm phân công
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={18} className="text-gray-500" />
          <span className="font-semibold text-gray-700">Bộ lọc</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Năm học</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
            >
              {schoolYears.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Giáo viên</label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
            >
              <option value="">Tất cả giáo viên</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>{user.full_name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Assignments Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b-2 border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Giáo viên</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Lớp</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Môn</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Chủ nhiệm</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Xóa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {assignments.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {(a as any).users?.full_name}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {(a as any).classes?.grades?.name} - {(a as any).classes?.name}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {(a as any).subjects?.name}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {a.is_homeroom && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                        GVCN
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleDelete(a)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {assignments.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Chưa có phân công nào
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800">Thêm phân công mới</h2>
              <p className="text-sm text-gray-500 mt-1">Có thể chọn nhiều lớp cùng lúc</p>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Giáo viên *
                </label>
                <select
                  value={formData.user_id}
                  onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  required
                >
                  <option value="">-- Chọn giáo viên --</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name} {user.role === 'admin' ? '(Admin)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Môn học *
                </label>
                <select
                  value={formData.subject_id}
                  onChange={(e) => setFormData({ ...formData, subject_id: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  required
                >
                  <option value="">-- Chọn môn --</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Năm học *
                </label>
                <select
                  value={formData.school_year}
                  onChange={(e) => {
                    setFormData({ ...formData, school_year: e.target.value, class_ids: [] });
                    loadClassesForYear(e.target.value);
                  }}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  required
                >
                  {schoolYears.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-gray-700">
                    Chọn lớp * ({formData.class_ids.length} đã chọn)
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selectAllClasses}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Chọn tất cả
                    </button>
                    <button
                      type="button"
                      onClick={deselectAllClasses}
                      className="text-xs text-gray-600 hover:underline"
                    >
                      Bỏ chọn
                    </button>
                  </div>
                </div>
                <div className="border-2 border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-2">
                    {classes.map((c) => {
                      const isSelected = formData.class_ids.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          className={`
                            flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors
                            ${isSelected ? 'bg-blue-50 border border-blue-300' : 'hover:bg-gray-50 border border-transparent'}
                          `}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleClass(c.id)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className={`text-sm ${isSelected ? 'font-medium text-blue-700' : 'text-gray-700'}`}>
                            {(c as any).grades?.name} - {c.name}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {classes.length === 0 && (
                    <p className="text-center text-gray-500 text-sm py-4">
                      Không có lớp nào trong năm học này
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_homeroom"
                  checked={formData.is_homeroom}
                  onChange={(e) => setFormData({ ...formData, is_homeroom: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_homeroom" className="text-sm font-medium text-gray-700">
                  Là giáo viên chủ nhiệm các lớp này
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
                >
                  {submitting ? 'Đang thêm...' : `Thêm ${formData.class_ids.length} phân công`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
