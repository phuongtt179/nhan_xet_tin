'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Class } from '@/lib/types';
import { Save, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';

interface AttendanceRecord {
  studentId: string;
  studentName: string;
  computerName: string | null;
  isAbsent: boolean; // true = vắng, false = có mặt
  note: string;
}

export default function AttendancePage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [schoolYears, setSchoolYears] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('2025-2026');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isControlsCollapsed, setIsControlsCollapsed] = useState(false);

  useEffect(() => {
    loadSchoolYears();
  }, []);

  useEffect(() => {
    loadClasses();
    setSelectedClassId(''); // Reset class when year changes
  }, [selectedYear]);

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

      {/* Attendance List */}
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
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b-2 border-gray-200">
              <tr>
                <th className="px-2 lg:px-6 py-3 lg:py-4 text-left text-xs lg:text-sm font-bold text-gray-700">Họ và tên</th>
                <th className="px-2 lg:px-6 py-3 lg:py-4 text-center text-xs lg:text-sm font-bold text-gray-700 w-16 lg:w-24">Tên máy</th>
                <th className="px-2 lg:px-6 py-3 lg:py-4 text-center text-xs lg:text-sm font-bold text-gray-700 w-20 lg:w-32">Vắng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {attendanceRecords.map((record, index) => (
                <tr
                  key={record.studentId}
                  onClick={() => toggleAbsent(record.studentId)}
                  className="hover:bg-gray-50 transition-colors cursor-pointer active:bg-gray-100"
                >
                  <td className="px-2 lg:px-6 py-3 lg:py-4 text-xs lg:text-base font-semibold text-gray-800 whitespace-nowrap">
                    {index + 1}. {record.studentName}
                  </td>
                  <td className="px-2 lg:px-6 py-3 lg:py-4 text-center">
                    {record.computerName ? (
                      <span className="text-xs lg:text-sm font-semibold text-gray-700">{record.computerName}</span>
                    ) : (
                      <span className="text-gray-400 text-xs">-</span>
                    )}
                  </td>
                  <td className="px-2 lg:px-6 py-3 lg:py-4 text-center">
                    <input
                      type="checkbox"
                      checked={record.isAbsent}
                      onChange={() => {}}
                      className="w-5 h-5 lg:w-6 lg:h-6 text-red-600 border-gray-300 rounded focus:ring-red-500 pointer-events-none"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
