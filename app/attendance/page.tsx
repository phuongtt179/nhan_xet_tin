'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Class } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { Save, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';

interface AttendanceRecord {
  studentId: string;
  studentName: string;
  computerName: string | null;
  isAbsent: boolean; // true = vắng, false = có mặt
  note: string;
}

// Định nghĩa vị trí máy tính trong lớp học
const ROWS = ['A', 'B', 'C', 'D', 'E'];
const COLS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function AttendancePage() {
  const { user, isAdmin } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [schoolYears, setSchoolYears] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('2025-2026');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isControlsCollapsed, setIsControlsCollapsed] = useState(false);
  const [assignedClassIds, setAssignedClassIds] = useState<string[]>([]);

  useEffect(() => {
    loadSchoolYears();
  }, []);

  useEffect(() => {
    loadClasses();
    setSelectedClassId(''); // Reset class when year changes
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
      loadAttendance();
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
        // Teacher with no assignments - show empty
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

  async function loadAttendance() {
    try {
      setLoading(true);

      // Get students in this class
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id, name, computer_name')
        .eq('class_id', selectedClassId)
        .order('computer_name', { ascending: true, nullsFirst: false });

      if (studentsError) throw studentsError;

      // Get existing attendance records for this date
      const { data: existingAttendance, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .eq('class_id', selectedClassId)
        .eq('date', selectedDate);

      if (attendanceError) throw attendanceError;

      // Create attendance records array
      const records: AttendanceRecord[] = (studentsData || []).map((student) => {
        const existing = existingAttendance?.find(a => a.student_id === student.id);
        return {
          studentId: student.id,
          studentName: student.name,
          computerName: student.computer_name,
          isAbsent: existing?.status === 'absent', // true nếu vắng, false nếu có mặt
          note: existing?.note || '',
        };
      });

      setAttendanceRecords(records);
    } catch (error) {
      console.error('Error loading attendance:', error);
      alert('Lỗi khi tải điểm danh');
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

      for (const record of attendanceRecords) {
        // Check if record exists
        const { data: existing } = await supabase
          .from('attendance')
          .select('id')
          .eq('student_id', record.studentId)
          .eq('class_id', selectedClassId)
          .eq('date', selectedDate)
          .single();

        const status = record.isAbsent ? 'absent' : 'present';

        if (existing) {
          // Update
          await supabase
            .from('attendance')
            .update({
              status: status,
              note: record.note,
              user_id: user?.id || null,
            })
            .eq('id', existing.id);
        } else {
          // Insert
          await supabase
            .from('attendance')
            .insert([{
              student_id: record.studentId,
              class_id: selectedClassId,
              date: selectedDate,
              status: status,
              note: record.note,
              user_id: user?.id || null,
            }]);
        }
      }

      alert('Lưu điểm danh thành công!');
    } catch (error) {
      console.error('Error saving attendance:', error);
      alert('Lỗi khi lưu điểm danh');
    } finally {
      setSaving(false);
    }
  }

  function toggleAbsent(studentId: string) {
    setAttendanceRecords(records =>
      records.map(r =>
        r.studentId === studentId
          ? { ...r, isAbsent: !r.isAbsent }
          : r
      )
    );
  }

  const stats = {
    total: attendanceRecords.length,
    present: attendanceRecords.filter(r => !r.isAbsent).length,
    absent: attendanceRecords.filter(r => r.isAbsent).length,
  };

  // Tạo bản đồ vị trí máy -> học sinh
  function getSeatMap(): Map<string, AttendanceRecord | null> {
    const seatMap = new Map<string, AttendanceRecord | null>();

    // Khởi tạo tất cả vị trí là null
    ROWS.forEach(row => {
      COLS.forEach(col => {
        seatMap.set(`${row}${col}`, null);
      });
    });

    // Map học sinh vào vị trí tương ứng
    attendanceRecords.forEach(record => {
      if (record.computerName) {
        seatMap.set(record.computerName, record);
      }
    });

    return seatMap;
  }

  return (
    <div className="p-4 lg:p-8 pb-24 lg:pb-24">
      <div className="mb-4 lg:mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-800">Điểm danh</h1>
        <p className="text-sm lg:text-base text-gray-600 mt-1">Điểm danh học sinh theo buổi học</p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow mb-4 lg:mb-6">
        {/* Header - clickable */}
        <div
          onClick={() => setIsControlsCollapsed(!isControlsCollapsed)}
          className="flex items-center justify-between p-4 lg:p-6 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-200"
        >
          <div className="flex items-center gap-2">
            <h2 className="text-base lg:text-lg font-bold text-gray-800">Thông tin điểm danh</h2>
            {isControlsCollapsed && (
              <span className="text-sm text-gray-600">
                {classes.find(c => c.id === selectedClassId)?.name || 'Chưa chọn'} - {format(new Date(selectedDate), 'dd/MM/yyyy')}
              </span>
            )}
          </div>
          {isControlsCollapsed ? <ChevronDown size={24} /> : <ChevronUp size={24} />}
        </div>

        {/* Content - collapsible */}
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
      {attendanceRecords.length > 0 && (
        <div className="bg-white rounded-lg shadow mb-4 lg:mb-6 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b-2 border-gray-200">
              <tr>
                <th className="px-3 lg:px-6 py-2 lg:py-3 text-center text-xs lg:text-sm font-bold text-gray-700">Tổng số</th>
                <th className="px-3 lg:px-6 py-2 lg:py-3 text-center text-xs lg:text-sm font-bold text-gray-700">Có mặt</th>
                <th className="px-3 lg:px-6 py-2 lg:py-3 text-center text-xs lg:text-sm font-bold text-gray-700">Vắng</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="px-3 lg:px-6 py-3 lg:py-4 text-center">
                  <span className="text-xl lg:text-2xl font-bold text-gray-800">{stats.total}</span>
                </td>
                <td className="px-3 lg:px-6 py-3 lg:py-4 text-center">
                  <span className="text-xl lg:text-2xl font-bold text-green-600">{stats.present}</span>
                </td>
                <td className="px-3 lg:px-6 py-3 lg:py-4 text-center">
                  <span className="text-xl lg:text-2xl font-bold text-red-600">{stats.absent}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Attendance Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : !selectedClassId ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 text-sm lg:text-lg">Vui lòng chọn lớp để điểm danh</p>
        </div>
      ) : attendanceRecords.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 text-sm lg:text-lg">Lớp này chưa có học sinh</p>
          <p className="text-gray-400 text-xs lg:text-base mt-2">Thêm học sinh trước khi điểm danh</p>
        </div>
      ) : (
        <>
          {/* Desktop Grid: 5 rows (A-E) x 8 columns (1-8) */}
          <div className="hidden lg:block bg-white rounded-lg shadow p-4">
            <div className="mb-4 text-center">
              <span className="text-sm text-gray-500">Bảng giáo viên</span>
            </div>

            {/* Seat grid */}
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
                        onClick={() => record && toggleAbsent(record.studentId)}
                        className={`
                          relative p-2 rounded-lg border-2 min-h-[70px] flex flex-col items-center justify-center
                          transition-all duration-150
                          ${isEmpty
                            ? 'border-dashed border-gray-300 bg-gray-50 opacity-40'
                            : record.isAbsent
                              ? 'border-gray-300 bg-red-500 cursor-pointer hover:scale-105 hover:shadow-md active:scale-95'
                              : 'border-gray-300 bg-emerald-500 cursor-pointer hover:scale-105 hover:shadow-md active:scale-95'
                          }
                        `}
                      >
                        <span className={`text-xs font-medium ${isEmpty ? 'text-gray-400' : 'text-white'}`}>
                          {computerName}
                        </span>
                        {record && (
                          <>
                            <span className="text-lg font-bold text-white">
                              {record.isAbsent ? 'V' : 'C'}
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

          {/* Mobile Grid: 8 rows (1-8) x 5 columns (A-E) - transposed */}
          <div className="lg:hidden bg-white rounded-lg shadow p-3">
            <div className="mb-3 text-center">
              <span className="text-xs text-gray-500">Bảng giáo viên</span>
            </div>

            {/* Seat grid - transposed */}
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
                        onClick={() => record && toggleAbsent(record.studentId)}
                        className={`
                          relative p-1 rounded-md border min-h-[50px] flex flex-col items-center justify-center
                          transition-all duration-150
                          ${isEmpty
                            ? 'border-dashed border-gray-300 bg-gray-50 opacity-40'
                            : record.isAbsent
                              ? 'border-gray-300 bg-red-500 cursor-pointer active:scale-95'
                              : 'border-gray-300 bg-emerald-500 cursor-pointer active:scale-95'
                          }
                        `}
                      >
                        <span className={`text-[10px] font-medium ${isEmpty ? 'text-gray-400' : 'text-white'}`}>
                          {computerName}
                        </span>
                        {record && (
                          <span className="text-base font-bold text-white">
                            {record.isAbsent ? 'V' : 'C'}
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
                <span className="w-6 h-6 lg:w-8 lg:h-8 rounded flex items-center justify-center bg-emerald-500 text-white font-bold text-xs lg:text-sm">C</span>
                <span className="text-gray-700">Có mặt</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-6 h-6 lg:w-8 lg:h-8 rounded flex items-center justify-center bg-red-500 text-white font-bold text-xs lg:text-sm">V</span>
                <span className="text-gray-700">Vắng</span>
              </div>
            </div>
            <p className="mt-2 text-xs lg:text-sm text-gray-600">
              Nhấp vào ô để chuyển đổi: Có mặt ↔ Vắng
            </p>
          </div>
        </>
      )}

      {/* Fixed Save Button - floating at bottom */}
      {selectedClassId && attendanceRecords.length > 0 && (
        <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 lg:left-64 bg-white border-t-2 border-gray-200 shadow-lg p-4 z-20">
          <div className="max-w-7xl mx-auto flex justify-center lg:justify-start">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full lg:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed shadow-md"
            >
              <Save size={20} />
              {saving ? 'Đang lưu...' : 'Lưu điểm danh'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
