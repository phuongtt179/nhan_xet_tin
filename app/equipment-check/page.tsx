'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Class } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { Save, ChevronDown, ChevronUp, Backpack } from 'lucide-react';
import { format } from 'date-fns';

interface EquipmentRecord {
  studentId: string;
  studentName: string;
  computerName: string | null;
  forgotEquipment: boolean; // true = quên đồ dùng
  note: string;
}

// Định nghĩa vị trí máy tính trong lớp học
const ROWS = ['A', 'B', 'C', 'D', 'E'];
const COLS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function EquipmentCheckPage() {
  const { user, isAdmin } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [schoolYears, setSchoolYears] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('2025-2026');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [equipmentRecords, setEquipmentRecords] = useState<EquipmentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isControlsCollapsed, setIsControlsCollapsed] = useState(false);
  const [assignedClassIds, setAssignedClassIds] = useState<string[]>([]);

  useEffect(() => {
    loadSchoolYears();
  }, []);

  useEffect(() => {
    loadClasses();
    setSelectedClassId('');
  }, [selectedYear, assignedClassIds]);

  // Load assigned classes for current teacher
  useEffect(() => {
    if (user && !isAdmin) {
      loadAssignedClasses();
    }
  }, [user, isAdmin, selectedYear]);

  async function loadAssignedClasses() {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('teacher_assignments')
        .select('class_id')
        .eq('user_id', user.id)
        .eq('school_year', selectedYear);

      if (error) throw error;
      const classIds = [...new Set(data?.map(a => a.class_id) || [])];
      setAssignedClassIds(classIds);
    } catch (error) {
      console.error('Error loading assigned classes:', error);
    }
  }

  useEffect(() => {
    if (selectedClassId && selectedDate) {
      loadEquipmentCheck();
    }
  }, [selectedClassId, selectedDate]);

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
      let query = supabase
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

      // Filter by assigned classes if not admin
      if (!isAdmin && assignedClassIds.length > 0) {
        query = query.in('id', assignedClassIds);
      } else if (!isAdmin && assignedClassIds.length === 0) {
        setClasses([]);
        return;
      }

      const { data, error } = await query;

      if (error) throw error;
      setClasses(data || []);
      if (data && data.length > 0 && !selectedClassId) {
        setSelectedClassId(data[0].id);
      }
    } catch (error) {
      console.error('Error loading classes:', error);
    }
  }

  async function loadEquipmentCheck() {
    try {
      setLoading(true);

      // Get students in this class
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id, name, computer_name')
        .eq('class_id', selectedClassId)
        .order('computer_name', { ascending: true, nullsFirst: false });

      if (studentsError) throw studentsError;

      // Get existing equipment check records for this date
      const { data: existingRecords, error: recordsError } = await supabase
        .from('equipment_checks')
        .select('*')
        .eq('class_id', selectedClassId)
        .eq('date', selectedDate);

      if (recordsError && recordsError.code !== 'PGRST116') {
        console.error('Error loading equipment checks:', recordsError);
      }

      // Create records array
      const records: EquipmentRecord[] = (studentsData || []).map((student) => {
        const existing = existingRecords?.find(r => r.student_id === student.id);
        return {
          studentId: student.id,
          studentName: student.name,
          computerName: student.computer_name,
          forgotEquipment: existing?.forgot_equipment || false,
          note: existing?.note || '',
        };
      });

      setEquipmentRecords(records);
    } catch (error) {
      console.error('Error loading equipment check:', error);
      alert('Lỗi khi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!selectedClassId || !selectedDate) {
      alert('Vui lòng chọn lớp và ngày');
      return;
    }

    try {
      setSaving(true);

      for (const record of equipmentRecords) {
        // Check if record exists
        const { data: existing } = await supabase
          .from('equipment_checks')
          .select('id')
          .eq('student_id', record.studentId)
          .eq('class_id', selectedClassId)
          .eq('date', selectedDate)
          .single();

        if (existing) {
          // Update
          await supabase
            .from('equipment_checks')
            .update({
              forgot_equipment: record.forgotEquipment,
              note: record.note,
              user_id: user?.id || null,
            })
            .eq('id', existing.id);
        } else {
          // Insert
          await supabase
            .from('equipment_checks')
            .insert([{
              student_id: record.studentId,
              class_id: selectedClassId,
              date: selectedDate,
              forgot_equipment: record.forgotEquipment,
              note: record.note,
              user_id: user?.id || null,
            }]);
        }
      }

      alert('Lưu kiểm tra đồ dùng thành công!');
    } catch (error) {
      console.error('Error saving equipment check:', error);
      alert('Lỗi khi lưu kiểm tra đồ dùng');
    } finally {
      setSaving(false);
    }
  }

  function toggleForgot(studentId: string) {
    setEquipmentRecords(records =>
      records.map(r =>
        r.studentId === studentId
          ? { ...r, forgotEquipment: !r.forgotEquipment }
          : r
      )
    );
  }

  const stats = {
    total: equipmentRecords.length,
    hasEquipment: equipmentRecords.filter(r => !r.forgotEquipment).length,
    forgot: equipmentRecords.filter(r => r.forgotEquipment).length,
  };

  // Tạo bản đồ vị trí máy -> học sinh
  function getSeatMap(): Map<string, EquipmentRecord | null> {
    const seatMap = new Map<string, EquipmentRecord | null>();

    ROWS.forEach(row => {
      COLS.forEach(col => {
        seatMap.set(`${row}${col}`, null);
      });
    });

    equipmentRecords.forEach(record => {
      if (record.computerName) {
        seatMap.set(record.computerName, record);
      }
    });

    return seatMap;
  }

  return (
    <div className="p-4 lg:p-8 pb-24 lg:pb-24">
      <div className="mb-4 lg:mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-800">Kiểm tra đồ dùng học tập</h1>
        <p className="text-sm lg:text-base text-gray-600 mt-1">Kiểm tra đồ dùng học tập theo buổi học</p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow mb-4 lg:mb-6">
        <div
          onClick={() => setIsControlsCollapsed(!isControlsCollapsed)}
          className="flex items-center justify-between p-4 lg:p-6 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-200"
        >
          <div className="flex items-center gap-2">
            <h2 className="text-base lg:text-lg font-bold text-gray-800">Thông tin kiểm tra</h2>
            {isControlsCollapsed && (
              <span className="text-sm text-gray-600">
                {classes.find(c => c.id === selectedClassId)?.name || 'Chưa chọn'} - {format(new Date(selectedDate), 'dd/MM/yyyy')}
              </span>
            )}
          </div>
          {isControlsCollapsed ? <ChevronDown size={24} /> : <ChevronUp size={24} />}
        </div>

        {!isControlsCollapsed && (
          <div className="p-4 lg:p-6 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Năm học <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full px-3 lg:px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm lg:text-base"
                >
                  {schoolYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Lớp <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full px-3 lg:px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm lg:text-base"
                >
                  {classes.length === 0 ? (
                    <option value="">Chưa có lớp học</option>
                  ) : (
                    classes.map((classItem) => (
                      <option key={classItem.id} value={classItem.id}>
                        {(classItem as any).grades?.name} - {classItem.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="min-w-0">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Ngày <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full max-w-full min-w-0 px-3 lg:px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm lg:text-base"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stats Table */}
      {equipmentRecords.length > 0 && (
        <div className="bg-white rounded-lg shadow mb-4 lg:mb-6 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b-2 border-gray-200">
              <tr>
                <th className="px-3 lg:px-6 py-2 lg:py-3 text-center text-xs lg:text-sm font-bold text-gray-700">Tổng số</th>
                <th className="px-3 lg:px-6 py-2 lg:py-3 text-center text-xs lg:text-sm font-bold text-gray-700">Đầy đủ</th>
                <th className="px-3 lg:px-6 py-2 lg:py-3 text-center text-xs lg:text-sm font-bold text-gray-700">Quên đồ</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="px-3 lg:px-6 py-3 lg:py-4 text-center">
                  <span className="text-xl lg:text-2xl font-bold text-gray-800">{stats.total}</span>
                </td>
                <td className="px-3 lg:px-6 py-3 lg:py-4 text-center">
                  <span className="text-xl lg:text-2xl font-bold text-green-600">{stats.hasEquipment}</span>
                </td>
                <td className="px-3 lg:px-6 py-3 lg:py-4 text-center">
                  <span className="text-xl lg:text-2xl font-bold text-orange-600">{stats.forgot}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Equipment Check Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : !selectedClassId ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 text-sm lg:text-lg">Vui lòng chọn lớp để kiểm tra</p>
        </div>
      ) : equipmentRecords.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 text-sm lg:text-lg">Lớp này chưa có học sinh</p>
          <p className="text-gray-400 text-xs lg:text-base mt-2">Thêm học sinh trước khi kiểm tra</p>
        </div>
      ) : (
        <>
          {/* Desktop Grid */}
          <div className="hidden lg:block bg-white rounded-lg shadow p-4">
            <div className="mb-4 text-center">
              <span className="text-sm text-gray-500">Bảng giáo viên</span>
            </div>

            {ROWS.map(row => {
              const seatMap = getSeatMap();
              return (
                <div key={row} className="grid grid-cols-8 gap-2 mb-2">
                  {COLS.map(col => {
                    const computerName = `${row}${col}`;
                    const record = seatMap.get(computerName);
                    const isEmpty = !record;

                    return (
                      <div
                        key={computerName}
                        onClick={() => record && toggleForgot(record.studentId)}
                        className={`
                          relative p-2 rounded-lg border-2 min-h-[70px] flex flex-col items-center justify-center
                          transition-all duration-150
                          ${isEmpty
                            ? 'border-dashed border-gray-300 bg-gray-50 opacity-40'
                            : record.forgotEquipment
                              ? 'border-gray-300 bg-orange-500 cursor-pointer hover:scale-105 hover:shadow-md active:scale-95'
                              : 'border-gray-300 bg-green-500 cursor-pointer hover:scale-105 hover:shadow-md active:scale-95'
                          }
                        `}
                      >
                        <span className={`text-xs font-medium ${isEmpty ? 'text-gray-400' : 'text-white'}`}>
                          {computerName}
                        </span>
                        {record && (
                          <>
                            <span className="text-lg font-bold text-white">
                              {record.forgotEquipment ? 'Q' : 'Đ'}
                            </span>
                            <span className="text-[10px] truncate max-w-full text-white opacity-90">
                              {record.studentName}
                            </span>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Mobile Grid */}
          <div className="lg:hidden bg-white rounded-lg shadow p-3">
            <div className="mb-3 text-center">
              <span className="text-xs text-gray-500">Bảng giáo viên</span>
            </div>

            {COLS.map(col => {
              const seatMap = getSeatMap();
              return (
                <div key={col} className="grid grid-cols-5 gap-1 mb-1">
                  {ROWS.map(row => {
                    const computerName = `${row}${col}`;
                    const record = seatMap.get(computerName);
                    const isEmpty = !record;

                    return (
                      <div
                        key={computerName}
                        onClick={() => record && toggleForgot(record.studentId)}
                        className={`
                          relative p-1 rounded-md border min-h-[50px] flex flex-col items-center justify-center
                          transition-all duration-150
                          ${isEmpty
                            ? 'border-dashed border-gray-300 bg-gray-50 opacity-40'
                            : record.forgotEquipment
                              ? 'border-gray-300 bg-orange-500 cursor-pointer active:scale-95'
                              : 'border-gray-300 bg-green-500 cursor-pointer active:scale-95'
                          }
                        `}
                      >
                        <span className={`text-[10px] font-medium ${isEmpty ? 'text-gray-400' : 'text-white'}`}>
                          {computerName}
                        </span>
                        {record && (
                          <span className="text-base font-bold text-white">
                            {record.forgotEquipment ? 'Q' : 'Đ'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 lg:mt-6 bg-blue-50 border-2 border-blue-200 rounded-lg p-3 lg:p-4">
            <h3 className="font-semibold text-gray-800 mb-2 text-xs lg:text-base">Chú thích:</h3>
            <div className="flex flex-wrap gap-2 lg:gap-4 text-xs lg:text-sm">
              <div className="flex items-center gap-1">
                <span className="w-6 h-6 lg:w-8 lg:h-8 rounded flex items-center justify-center bg-green-500 text-white font-bold text-xs lg:text-sm">Đ</span>
                <span className="text-gray-700">Đầy đủ</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-6 h-6 lg:w-8 lg:h-8 rounded flex items-center justify-center bg-orange-500 text-white font-bold text-xs lg:text-sm">Q</span>
                <span className="text-gray-700">Quên đồ dùng</span>
              </div>
            </div>
            <p className="mt-2 text-xs lg:text-sm text-gray-600">
              Nhấp vào ô để chuyển đổi: Đầy đủ ↔ Quên đồ
            </p>
          </div>
        </>
      )}

      {/* Fixed Save Button */}
      {selectedClassId && equipmentRecords.length > 0 && (
        <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 lg:left-64 bg-white border-t-2 border-gray-200 shadow-lg p-4 z-20">
          <div className="max-w-7xl mx-auto flex justify-center lg:justify-start">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full lg:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed shadow-md"
            >
              <Save size={20} />
              {saving ? 'Đang lưu...' : 'Lưu kiểm tra'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
