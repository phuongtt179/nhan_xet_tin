'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Student, Class, COMPUTER_NAMES } from '@/lib/types';
import { Users, Plus, Edit2, Trash2, Upload } from 'lucide-react';

interface BulkStudent {
  name: string;
  computer_name: string;
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [allClasses, setAllClasses] = useState<Class[]>([]); // All classes without filter
  const [schoolYears, setSchoolYears] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('2025-2026');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [filterClassId, setFilterClassId] = useState<string>(''); // '' = all classes
  const [formData, setFormData] = useState({
    name: '',
    computer_name: '',
    phone: '',
    parent_phone: '',
    class_id: '',
  });
  const [bulkText, setBulkText] = useState('');
  const [bulkPreview, setBulkPreview] = useState<BulkStudent[]>([]);
  const [bulkClassId, setBulkClassId] = useState('');

  useEffect(() => {
    loadSchoolYears();
    loadStudents();
  }, []);

  useEffect(() => {
    loadClasses();
    setFilterClassId(''); // Reset class filter when year changes
  }, [selectedYear]);

  async function loadSchoolYears() {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('school_year')
        .order('school_year', { ascending: false });

      if (error) throw error;

      const uniqueYears = Array.from(new Set(data?.map(c => c.school_year) || []));
      setSchoolYears(uniqueYears);

      if (uniqueYears.length > 0 && !selectedYear) {
        setSelectedYear(uniqueYears[0]);
      }
    } catch (error) {
      console.error('Error loading school years:', error);
    }
  }

  async function loadClasses() {
    try {
      // Load all classes (for forms)
      const { data: allData, error: allError } = await supabase
        .from('classes')
        .select(`
          *,
          grades (
            id,
            name
          )
        `)
        .order('name');

      if (allError) throw allError;
      setAllClasses(allData || []);

      // Load classes filtered by year (for display)
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
        .order('name');

      if (error) throw error;
      setClasses(data || []);
    } catch (error) {
      console.error('Error loading classes:', error);
    }
  }

  async function loadStudents() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('students')
        .select(`
          *,
          classes (
            id,
            name,
            grades (
              id,
              name
            )
          )
        `)
        .order('computer_name', { ascending: true, nullsFirst: false });

      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error('Error loading students:', error);
      alert('Không thể tải danh sách học sinh');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const studentData = {
        name: formData.name,
        computer_name: formData.computer_name || null,
        phone: formData.phone || null,
        parent_phone: formData.parent_phone || null,
        class_id: formData.class_id || null,
      };

      if (editingStudent) {
        // Update
        const { error } = await supabase
          .from('students')
          .update({
            ...studentData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingStudent.id);

        if (error) throw error;
        alert('Cập nhật học sinh thành công!');
      } else {
        // Insert
        const { error } = await supabase
          .from('students')
          .insert([studentData]);

        if (error) throw error;
        alert('Thêm học sinh thành công!');
      }

      setShowForm(false);
      setEditingStudent(null);
      setFormData({ name: '', computer_name: '', phone: '', parent_phone: '', class_id: '' });
      loadStudents();
    } catch (error: any) {
      console.error('Error saving student:', error);
      alert(error.message || 'Có lỗi xảy ra');
    }
  }

  async function handleDelete(student: Student) {
    if (!confirm(`Bạn có chắc muốn xóa học sinh "${student.name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', student.id);

      if (error) throw error;
      alert('Xóa học sinh thành công!');
      loadStudents();
    } catch (error: any) {
      console.error('Error deleting student:', error);
      alert(error.message || 'Không thể xóa học sinh');
    }
  }

  function openEditForm(student: Student) {
    setEditingStudent(student);
    setFormData({
      name: student.name,
      computer_name: student.computer_name || '',
      phone: student.phone || '',
      parent_phone: student.parent_phone || '',
      class_id: student.class_id || '',
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingStudent(null);
    setFormData({ name: '', computer_name: '', phone: '', parent_phone: '', class_id: '' });
  }

  function parseBulkText(text: string): BulkStudent[] {
    const lines = text.trim().split('\n').filter(line => line.trim());
    const parsed: BulkStudent[] = [];

    for (const line of lines) {
      // Try to split by tab first, then by multiple spaces
      let parts = line.split('\t');
      if (parts.length < 2) {
        parts = line.split(/\s{2,}/); // Split by 2+ spaces
      }

      if (parts.length >= 2) {
        parsed.push({
          name: parts[0].trim(),
          computer_name: parts[1].trim(),
        });
      }
    }

    return parsed;
  }

  function handleBulkTextChange(text: string) {
    setBulkText(text);
    const preview = parseBulkText(text);
    setBulkPreview(preview);
  }

  async function handleBulkImport() {
    if (bulkPreview.length === 0) {
      alert('Không có dữ liệu để thêm');
      return;
    }

    if (!bulkClassId) {
      alert('Vui lòng chọn lớp');
      return;
    }

    try {
      const studentsToAdd = bulkPreview.map(s => ({
        name: s.name,
        computer_name: s.computer_name || null,
        class_id: bulkClassId,
        phone: null,
        parent_phone: null,
      }));

      const { error } = await supabase
        .from('students')
        .insert(studentsToAdd);

      if (error) throw error;

      alert(`Đã thêm ${bulkPreview.length} học sinh thành công!`);
      setShowBulkImport(false);
      setBulkText('');
      setBulkPreview([]);
      setBulkClassId('');
      loadStudents();
    } catch (error: any) {
      console.error('Error bulk importing:', error);
      alert(error.message || 'Có lỗi xảy ra khi thêm hàng loạt');
    }
  }

  function closeBulkImport() {
    setShowBulkImport(false);
    setBulkText('');
    setBulkPreview([]);
    setBulkClassId('');
  }

  // Get available computer names (excluding already used ones in the SAME CLASS)
  const getAvailableComputerNames = (classId: string) => {
    if (!classId) return COMPUTER_NAMES;

    const usedInClass = students
      .filter(s =>
        s.class_id === classId &&
        s.computer_name &&
        (!editingStudent || s.id !== editingStudent.id)
      )
      .map(s => s.computer_name);

    return COMPUTER_NAMES.filter(name => !usedInClass.includes(name));
  };

  const availableComputerNames = getAvailableComputerNames(formData.class_id);

  // Filter students by class
  const filteredStudents = filterClassId
    ? students.filter(s => s.class_id === filterClassId)
    : students;

  return (
    <div className="p-4 lg:p-8 pb-20 lg:pb-8">
      <div className="mb-6 lg:mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-800 flex items-center gap-2">
            <Users className="text-blue-600" />
            Quản lý Học sinh
          </h1>
          <p className="text-sm lg:text-base text-gray-600 mt-1">
            Danh sách học sinh và tên máy
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBulkImport(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-3 lg:px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors text-sm lg:text-base"
          >
            <Upload size={20} />
            <span className="hidden lg:inline">Import</span>
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 lg:px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors text-sm lg:text-base"
          >
            <Plus size={20} />
            <span className="hidden lg:inline">Thêm</span>
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-lg lg:rounded-xl shadow-md p-4 lg:p-6 mb-4 lg:mb-6">
        <div className="grid lg:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Năm học:
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
            >
              {schoolYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Users size={18} />
              Lọc theo lớp:
            </label>
            <select
              value={filterClassId}
              onChange={(e) => setFilterClassId(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
            >
              <option value="">Tất cả lớp</option>
              {classes.map((classItem) => (
                <option key={classItem.id} value={classItem.id}>
                  {classItem.grades?.name} - {classItem.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-4">
          Tổng: <span className="font-bold text-gray-800">{filteredStudents.length}</span> học sinh
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6 text-center">
          <Users className="mx-auto text-yellow-400 mb-3" size={48} />
          <p className="text-yellow-800 font-semibold mb-2">
            {filterClassId ? 'Lớp này chưa có học sinh' : 'Chưa có học sinh nào'}
          </p>
          <p className="text-sm text-yellow-700">
            Nhấn nút &quot;Thêm&quot; hoặc &quot;Import&quot; để thêm học sinh
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg lg:rounded-xl shadow-md overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b-2 border-gray-200">
              <tr>
                <th className="px-3 lg:px-6 py-2 lg:py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Họ và tên</th>
                <th className="px-3 lg:px-6 py-2 lg:py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Máy</th>
                <th className="px-3 lg:px-6 py-2 lg:py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Lớp</th>
                <th className="px-3 lg:px-6 py-2 lg:py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredStudents.map((student, index) => (
                <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 lg:px-6 py-3 lg:py-4">
                    <div className="font-semibold text-gray-800 text-sm lg:text-base">{student.name}</div>
                  </td>
                  <td className="px-3 lg:px-6 py-3 lg:py-4">
                    {student.computer_name ? (
                      <span className="text-sm lg:text-base font-semibold text-gray-700">{student.computer_name}</span>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </td>
                  <td className="px-3 lg:px-6 py-3 lg:py-4">
                    {student.classes ? (
                      <span className="inline-block px-2 lg:px-3 py-1 bg-blue-600 text-white rounded-full text-xs lg:text-sm font-semibold whitespace-nowrap">
                        {student.classes.name} ({(student.classes as any).grades?.name})
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </td>
                  <td className="px-3 lg:px-6 py-3 lg:py-4">
                    <div className="flex items-center justify-center gap-1 lg:gap-2">
                      <button
                        onClick={() => openEditForm(student)}
                        className="p-1.5 lg:p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Sửa"
                      >
                        <Edit2 size={16} className="lg:w-5 lg:h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(student)}
                        className="p-1.5 lg:p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Xóa"
                      >
                        <Trash2 size={16} className="lg:w-5 lg:h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 my-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">
              {editingStudent ? 'Sửa thông tin học sinh' : 'Thêm học sinh mới'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Họ và tên <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder="Nguyễn Văn A"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Lớp <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.class_id}
                  onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                >
                  <option value="">-- Chọn lớp --</option>
                  {classes.map((classItem) => (
                    <option key={classItem.id} value={classItem.id}>
                      {classItem.grades?.name} - {classItem.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tên máy
                </label>
                <select
                  value={formData.computer_name}
                  onChange={(e) => setFormData({ ...formData, computer_name: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                >
                  <option value="">-- Chọn tên máy --</option>
                  {editingStudent && editingStudent.computer_name && (
                    <option value={editingStudent.computer_name}>{editingStudent.computer_name} (hiện tại)</option>
                  )}
                  {availableComputerNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Còn {availableComputerNames.length} máy khả dụng
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Số điện thoại học sinh
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder="0123456789"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Số điện thoại phụ huynh
                </label>
                <input
                  type="tel"
                  value={formData.parent_phone}
                  onChange={(e) => setFormData({ ...formData, parent_phone: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder="0987654321"
                />
              </div>

              <div className="flex gap-3 pt-4">
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
                  {editingStudent ? 'Cập nhật' : 'Thêm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full p-6 my-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Thêm học sinh hàng loạt
            </h2>

            <div className="space-y-4">
              {/* Instructions */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">Hướng dẫn:</h3>
                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                  <li>Copy danh sách từ Excel (Cột A: Họ tên, Cột B: Tên máy)</li>
                  <li>Paste vào ô bên dưới</li>
                  <li>Kiểm tra preview</li>
                  <li>Chọn lớp và nhấn "Thêm tất cả"</li>
                </ol>
                <p className="text-xs text-blue-700 mt-2">
                  Định dạng mỗi dòng: <code className="bg-blue-100 px-1 rounded">Nguyễn Văn A    A1</code>
                </p>
              </div>

              {/* Select Class */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Lớp <span className="text-red-500">*</span>
                </label>
                <select
                  value={bulkClassId}
                  onChange={(e) => setBulkClassId(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                >
                  <option value="">-- Chọn lớp --</option>
                  {classes.map((classItem) => (
                    <option key={classItem.id} value={classItem.id}>
                      {classItem.name} - {classItem.grades?.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Textarea Input */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Dán danh sách vào đây:
                </label>
                <textarea
                  value={bulkText}
                  onChange={(e) => handleBulkTextChange(e.target.value)}
                  placeholder="Nguyễn Văn A    A1&#10;Trần Thị B    A2&#10;Lê Văn C    A3"
                  rows={8}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none font-mono text-sm"
                />
              </div>

              {/* Preview Table */}
              {bulkPreview.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-800 mb-2">
                    Xem trước ({bulkPreview.length} học sinh):
                  </h3>
                  <div className="border-2 border-gray-300 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-sm font-bold text-gray-700">STT</th>
                          <th className="px-4 py-2 text-left text-sm font-bold text-gray-700">Họ và tên</th>
                          <th className="px-4 py-2 text-left text-sm font-bold text-gray-700">Tên máy</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {bulkPreview.map((student, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-sm text-gray-600">{index + 1}</td>
                            <td className="px-4 py-2 text-sm font-semibold text-gray-800">{student.name}</td>
                            <td className="px-4 py-2 text-sm">
                              <span className="inline-block px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-semibold">
                                {student.computer_name}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={closeBulkImport}
                className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleBulkImport}
                disabled={bulkPreview.length === 0 || !bulkClassId}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Thêm tất cả ({bulkPreview.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
