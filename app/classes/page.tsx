'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Class, Grade } from '@/lib/types';
import { BookOpen, Plus, Edit2, Trash2 } from 'lucide-react';

export default function ClassesPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [allClasses, setAllClasses] = useState<Class[]>([]); // All classes for filtering
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [schoolYears, setSchoolYears] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('2025-2026');
  const [selectedGradeId, setSelectedGradeId] = useState<string>(''); // '' = all grades
  const [formData, setFormData] = useState({
    name: '',
    grade_id: '',
    school_year: '2025-2026',
    schedule: '',
  });

  useEffect(() => {
    loadGrades();
    loadSchoolYears();
  }, []);

  useEffect(() => {
    loadClasses();
  }, [selectedYear]);

  // Filter classes by grade when selectedGradeId changes
  useEffect(() => {
    if (selectedGradeId) {
      setClasses(allClasses.filter(c => c.grade_id === selectedGradeId));
    } else {
      setClasses(allClasses);
    }
  }, [selectedGradeId, allClasses]);

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
    }
  }

  async function loadSchoolYears() {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('school_year')
        .order('school_year', { ascending: false });

      if (error) throw error;

      // Get unique years
      const uniqueYears = Array.from(new Set(data?.map(c => c.school_year) || []));
      setSchoolYears(uniqueYears);

      // Set first year as default if available
      if (uniqueYears.length > 0 && !selectedYear) {
        setSelectedYear(uniqueYears[0]);
      }
    } catch (error) {
      console.error('Error loading school years:', error);
    }
  }

  async function loadClasses() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('classes')
        .select(`
          *,
          grades (
            id,
            name
          )
        `)
        .eq('school_year', selectedYear)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setAllClasses(data || []);

      // Apply grade filter if selected
      if (selectedGradeId) {
        setClasses((data || []).filter(c => c.grade_id === selectedGradeId));
      } else {
        setClasses(data || []);
      }
    } catch (error) {
      console.error('Error loading classes:', error);
      alert('Không thể tải danh sách lớp học');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.grade_id) {
      alert('Vui lòng chọn khối lớp');
      return;
    }

    try {
      if (editingClass) {
        // Update
        const { error } = await supabase
          .from('classes')
          .update({
            name: formData.name,
            grade_id: formData.grade_id,
            school_year: formData.school_year,
            schedule: formData.schedule,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingClass.id);

        if (error) throw error;
        alert('Cập nhật lớp học thành công!');
      } else {
        // Insert
        const { error } = await supabase
          .from('classes')
          .insert([{
            name: formData.name,
            grade_id: formData.grade_id,
            school_year: formData.school_year,
            schedule: formData.schedule,
          }]);

        if (error) throw error;
        alert('Thêm lớp học thành công!');
      }

      setShowForm(false);
      setEditingClass(null);
      setFormData({ name: '', grade_id: '', school_year: selectedYear, schedule: '' });
      loadClasses();
      loadSchoolYears(); // Reload years in case a new year was added
    } catch (error: any) {
      console.error('Error saving class:', error);
      alert(error.message || 'Có lỗi xảy ra');
    }
  }

  async function handleDelete(classItem: Class) {
    if (!confirm(`Bạn có chắc muốn xóa lớp "${classItem.name}"?\n\nLưu ý: Tất cả học sinh và dữ liệu liên quan sẽ bị ảnh hưởng!`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('classes')
        .delete()
        .eq('id', classItem.id);

      if (error) throw error;
      alert('Xóa lớp học thành công!');
      loadClasses();
    } catch (error: any) {
      console.error('Error deleting class:', error);
      alert(error.message || 'Không thể xóa lớp học');
    }
  }

  function openEditForm(classItem: Class) {
    setEditingClass(classItem);
    setFormData({
      name: classItem.name,
      grade_id: classItem.grade_id,
      school_year: classItem.school_year,
      schedule: classItem.schedule || '',
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingClass(null);
    setFormData({ name: '', grade_id: '', school_year: selectedYear, schedule: '' });
  }

  return (
    <div className="p-4 lg:p-8 pb-20 lg:pb-8">
      <div className="mb-6 lg:mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-800 flex items-center gap-2">
              <BookOpen className="text-blue-600" />
              Quản lý Lớp học
            </h1>
            <p className="text-sm lg:text-base text-gray-600 mt-1">
              Danh sách các lớp học
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 lg:px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors text-sm lg:text-base"
          >
            <Plus size={20} />
            <span className="hidden lg:inline">Thêm lớp</span>
          </button>
        </div>
        {/* Filters */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-gray-700">Năm học:</label>
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(e.target.value);
                setSelectedGradeId(''); // Reset grade filter
              }}
              className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none bg-white text-sm font-semibold"
            >
              {schoolYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-gray-700">Khối:</label>
            <select
              value={selectedGradeId}
              onChange={(e) => setSelectedGradeId(e.target.value)}
              className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none bg-white text-sm font-semibold"
            >
              <option value="">Tất cả khối</option>
              {grades.map((grade) => (
                <option key={grade.id} value={grade.id}>
                  {grade.name}
                </option>
              ))}
            </select>
          </div>
          <div className="text-sm text-gray-600">
            Tổng: <span className="font-bold text-gray-800">{classes.length}</span> lớp
          </div>
        </div>
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
                  <th className="px-6 py-4 text-left text-sm font-bold">Tên lớp</th>
                  <th className="px-6 py-4 text-left text-sm font-bold">Khối</th>
                  <th className="px-6 py-4 text-left text-sm font-bold">Năm học</th>
                  <th className="px-6 py-4 text-left text-sm font-bold">Lịch học</th>
                  <th className="px-6 py-4 text-center text-sm font-bold">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {classes.map((classItem, index) => (
                  <tr key={classItem.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-gray-600">{index + 1}</td>
                    <td className="px-6 py-4 font-semibold text-gray-800">{classItem.name}</td>
                    <td className="px-6 py-4">
                      <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                        {classItem.grades?.name || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{classItem.school_year}</td>
                    <td className="px-6 py-4 text-gray-600">{classItem.schedule || '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEditForm(classItem)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Sửa"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(classItem)}
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
            {classes.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                Chưa có lớp học nào. Nhấn "Thêm lớp" để tạo mới.
              </div>
            )}
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-3">
            {classes.map((classItem, index) => (
              <div key={classItem.id} className="bg-white rounded-lg shadow-md p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="text-xs text-gray-500 mb-1">#{index + 1}</div>
                    <h3 className="font-bold text-gray-800 text-base">{classItem.name}</h3>
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Khối:</span>
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                          {classItem.grades?.name}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600">
                        Năm học: <span className="font-semibold">{classItem.school_year}</span>
                      </div>
                      {classItem.schedule && (
                        <div className="text-sm text-gray-600">📅 {classItem.schedule}</div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-3 pt-3 border-t">
                  <button
                    onClick={() => openEditForm(classItem)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg font-semibold text-sm"
                  >
                    <Edit2 size={16} />
                    Sửa
                  </button>
                  <button
                    onClick={() => handleDelete(classItem)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-lg font-semibold text-sm"
                  >
                    <Trash2 size={16} />
                    Xóa
                  </button>
                </div>
              </div>
            ))}
            {classes.length === 0 && (
              <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
                Chưa có lớp học nào. Nhấn "Thêm lớp" để tạo mới.
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
              {editingClass ? 'Sửa lớp học' : 'Thêm lớp học'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tên lớp <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ví dụ: Lớp 3A"
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Khối <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.grade_id}
                    onChange={(e) => setFormData({ ...formData, grade_id: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    required
                  >
                    <option value="">-- Chọn khối --</option>
                    {grades.map((grade) => (
                      <option key={grade.id} value={grade.id}>
                        {grade.name}
                      </option>
                    ))}
                  </select>
                  {grades.length === 0 && (
                    <p className="text-xs text-red-500 mt-1">
                      Chưa có khối lớp. Vui lòng tạo khối trước.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Năm học <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.school_year}
                    onChange={(e) => setFormData({ ...formData, school_year: e.target.value })}
                    placeholder="Ví dụ: 2025-2026"
                    pattern="\d{4}-\d{4}"
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Định dạng: YYYY-YYYY (ví dụ: 2025-2026)
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Lịch học
                  </label>
                  <input
                    type="text"
                    value={formData.schedule}
                    onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                    placeholder="Ví dụ: Thứ 2, 4, 6 - 14:00"
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
                  {editingClass ? 'Cập nhật' : 'Thêm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
