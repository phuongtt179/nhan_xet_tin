'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Class } from '@/lib/types';
import { Check, X as XIcon, Download } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

interface Student {
  id: string;
  name: string;
  computer_name: string | null;
}

interface AttendanceSession {
  date: string;
  attendanceMap: Map<string, 'present' | 'absent'>;
}

interface StudentSummary {
  student: Student;
  totalPresent: number;
  totalAbsent: number;
  sessions: ('present' | 'absent' | 'unknown')[];
}

export default function AttendanceSummaryPage() {
  const { isAdmin, getAssignedClassIds } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('2025-2026');
  const [schoolYears, setSchoolYears] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  const [students, setStudents] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [summary, setSummary] = useState<StudentSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSchoolYears();
  }, []);

  useEffect(() => {
    loadClasses();
    setSelectedClassId('');
  }, [selectedYear]);

  useEffect(() => {
    if (selectedClassId) {
      loadAttendanceSummary();
    } else {
      setStudents([]);
      setSessions([]);
      setSummary([]);
    }
  }, [selectedClassId, fromDate, toDate]);

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
      const assignedClassIds = isAdmin ? null : getAssignedClassIds();

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

      // Filter by assigned classes for non-admin
      if (!isAdmin && assignedClassIds && assignedClassIds.length > 0) {
        query = query.in('id', assignedClassIds);
      } else if (!isAdmin && (!assignedClassIds || assignedClassIds.length === 0)) {
        query = query.in('id', ['no-match']);
      }

      const { data, error } = await query;

      if (error) throw error;
      setClasses(data || []);
    } catch (error) {
      console.error('Error loading classes:', error);
    }
  }

  async function loadAttendanceSummary() {
    try {
      setLoading(true);

      // Load students
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id, name, computer_name')
        .eq('class_id', selectedClassId)
        .order('computer_name', { ascending: true, nullsFirst: false });

      if (studentsError) throw studentsError;

      // Load all attendance records for this class with date filter
      let query = supabase
        .from('attendance')
        .select('student_id, date, status')
        .eq('class_id', selectedClassId);

      if (fromDate) {
        query = query.gte('date', fromDate);
      }
      if (toDate) {
        query = query.lte('date', toDate);
      }

      const { data: attendanceData, error: attendanceError } = await query.order('date', { ascending: true });

      if (attendanceError) throw attendanceError;

      // Get unique dates (sessions)
      const uniqueDates = Array.from(
        new Set(attendanceData?.map(a => a.date) || [])
      ).sort();

      // Create sessions with attendance map
      const sessionsData: AttendanceSession[] = uniqueDates.map(date => {
        const attendanceMap = new Map<string, 'present' | 'absent'>();
        attendanceData
          ?.filter(a => a.date === date)
          .forEach(a => {
            attendanceMap.set(a.student_id, a.status as 'present' | 'absent');
          });
        return { date, attendanceMap };
      });

      // Calculate summary for each student
      const summaryData: StudentSummary[] = (studentsData || []).map(student => {
        const sessions = sessionsData.map(session =>
          session.attendanceMap.get(student.id) || 'unknown'
        );

        const totalPresent = sessions.filter(s => s === 'present').length;
        const totalAbsent = sessions.filter(s => s === 'absent').length;

        return {
          student,
          totalPresent,
          totalAbsent,
          sessions,
        };
      });

      setStudents(studentsData || []);
      setSessions(sessionsData);
      setSummary(summaryData);
    } catch (error) {
      console.error('Error loading attendance summary:', error);
      alert('Lỗi khi tải thống kê điểm danh');
    } finally {
      setLoading(false);
    }
  }

  function exportToCSV() {
    if (summary.length === 0) {
      alert('Không có dữ liệu để xuất');
      return;
    }

    // CSV Header
    const headers = [
      'STT',
      'Họ và tên',
      'Tên máy',
      'Tổng số buổi',
      'Số buổi có mặt',
      'Số buổi vắng',
      ...sessions.map((s, i) => `Buổi ${i + 1} (${format(new Date(s.date), 'dd/MM/yyyy')})`)
    ];

    // CSV Rows
    const rows = summary.map((item, index) => [
      index + 1,
      item.student.name,
      item.student.computer_name || '-',
      sessions.length,
      item.totalPresent,
      item.totalAbsent,
      ...item.sessions.map(s => s === 'present' ? 'Có mặt' : s === 'absent' ? 'Vắng' : '-')
    ]);

    // Combine
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Download
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `thong-ke-diem-danh-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  }

  const selectedClass = classes.find(c => c.id === selectedClassId);

  return (
    <div className="p-4 lg:p-8 pb-24 lg:pb-24">
      <div className="mb-4 lg:mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-800">Thống kê buổi học</h1>
        <p className="text-sm lg:text-base text-gray-600 mt-1">
          Xem tổng hợp điểm danh theo lớp
        </p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow mb-4 lg:mb-6 p-4 lg:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
              <option value="">-- Chọn lớp --</option>
              {classes.map((classItem) => (
                <option key={classItem.id} value={classItem.id}>
                  {(classItem as any).grades?.name} - {classItem.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Từ ngày
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-3 lg:px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm lg:text-base"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Đến ngày
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-3 lg:px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm lg:text-base"
            />
          </div>
        </div>
      </div>

      {/* Summary Table */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : !selectedClassId ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 text-sm lg:text-lg">Vui lòng chọn lớp để xem thống kê</p>
        </div>
      ) : summary.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 text-sm lg:text-lg">Chưa có dữ liệu điểm danh</p>
        </div>
      ) : (
        <>
          {/* Export Button */}
          <div className="mb-4 flex justify-end">
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm lg:text-base"
            >
              <Download size={18} />
              Xuất CSV
            </button>
          </div>

          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full text-xs lg:text-sm">
              <thead className="bg-gray-50 border-b-2 border-gray-200">
                <tr>
                  <th className="px-2 lg:px-3 py-2 text-center font-bold text-gray-700 sticky left-0 bg-gray-50 z-10">
                    STT
                  </th>
                  <th className="px-2 lg:px-4 py-2 text-left font-bold text-gray-700 sticky left-8 lg:left-12 bg-gray-50 z-10 min-w-[120px]">
                    Họ và tên
                  </th>
                  <th className="px-2 lg:px-3 py-2 text-center font-bold text-gray-700">
                    Tên máy
                  </th>
                  <th className="px-2 lg:px-3 py-2 text-center font-bold text-gray-700">
                    Tổng buổi
                  </th>
                  {sessions.map((session, index) => (
                    <th
                      key={session.date}
                      className="px-2 lg:px-3 py-2 text-center font-bold text-gray-700 min-w-[60px]"
                    >
                      <div>Buổi {index + 1}</div>
                      <div className="text-xs font-normal text-gray-500">
                        {format(new Date(session.date), 'dd/MM')}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {summary.map((item, index) => (
                  <tr key={item.student.id} className="hover:bg-gray-50">
                    <td className="px-2 lg:px-3 py-3 text-center text-gray-600 sticky left-0 bg-white">
                      {index + 1}
                    </td>
                    <td className="px-2 lg:px-4 py-3 font-semibold text-gray-800 sticky left-8 lg:left-12 bg-white">
                      {item.student.name}
                    </td>
                    <td className="px-2 lg:px-3 py-3 text-center text-gray-700">
                      {item.student.computer_name || '-'}
                    </td>
                    <td className="px-2 lg:px-3 py-3 text-center">
                      <span className="text-blue-600 font-semibold">
                        {item.totalPresent}
                      </span>
                      <span className="text-gray-400 mx-1">/</span>
                      <span className="text-gray-600">{sessions.length}</span>
                    </td>
                    {item.sessions.map((status, sessionIndex) => (
                      <td
                        key={sessionIndex}
                        className="px-2 lg:px-3 py-3 text-center"
                      >
                        {status === 'present' ? (
                          <Check className="inline-block text-green-600" size={18} />
                        ) : status === 'absent' ? (
                          <XIcon className="inline-block text-red-600" size={18} />
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="mt-4 bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-800 mb-2 text-sm lg:text-base">Chú thích:</h3>
            <div className="flex flex-wrap gap-4 text-xs lg:text-sm text-gray-700">
              <div className="flex items-center gap-2">
                <Check className="text-green-600" size={16} />
                <span>Có mặt</span>
              </div>
              <div className="flex items-center gap-2">
                <XIcon className="text-red-600" size={16} />
                <span>Vắng</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400">-</span>
                <span>Chưa điểm danh</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
