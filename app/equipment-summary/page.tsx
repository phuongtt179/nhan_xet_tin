'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Class } from '@/lib/types';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { vi } from 'date-fns/locale';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface StudentEquipmentSummary {
  studentId: string;
  studentName: string;
  computerName: string | null;
  totalDays: number;
  forgotCount: number;
}

// Định nghĩa vị trí máy tính trong lớp học
const ROWS = ['A', 'B', 'C', 'D', 'E'];
const COLS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function EquipmentSummaryPage() {
  const { isAdmin, getAssignedClassIds } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [schoolYears, setSchoolYears] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('2025-2026');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [summaryData, setSummaryData] = useState<StudentEquipmentSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [isControlsCollapsed, setIsControlsCollapsed] = useState(false);

  useEffect(() => {
    loadSchoolYears();
  }, []);

  useEffect(() => {
    loadClasses();
    setSelectedClassId('');
  }, [selectedYear]);

  useEffect(() => {
    if (selectedClassId && startDate && endDate) {
      loadSummary();
    }
  }, [selectedClassId, startDate, endDate]);

  async function loadSchoolYears() {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('school_year')
        .order('school_year', { ascending: false });

      if (error) throw error;

      const uniqueYears = Array.from(new Set(data?.map(c => c.school_year) || []));
      setSchoolYears(uniqueYears);

      if (uniqueYears.length > 0) {
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
      if (data && data.length > 0) {
        setSelectedClassId(data[0].id);
      }
    } catch (error) {
      console.error('Error loading classes:', error);
    }
  }

  async function loadSummary() {
    try {
      setLoading(true);

      // Get students in this class
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id, name, computer_name')
        .eq('class_id', selectedClassId)
        .order('computer_name', { ascending: true, nullsFirst: false });

      if (studentsError) throw studentsError;

      // Get equipment check records in date range
      const { data: equipmentData, error: equipmentError } = await supabase
        .from('equipment_checks')
        .select('student_id, forgot_equipment, date')
        .eq('class_id', selectedClassId)
        .gte('date', startDate)
        .lte('date', endDate);

      if (equipmentError && equipmentError.code !== 'PGRST116') {
        console.error('Error loading equipment data:', equipmentError);
      }

      // Calculate summary for each student
      const summary: StudentEquipmentSummary[] = (studentsData || []).map(student => {
        const studentRecords = equipmentData?.filter(r => r.student_id === student.id) || [];
        const forgotCount = studentRecords.filter(r => r.forgot_equipment).length;

        return {
          studentId: student.id,
          studentName: student.name,
          computerName: student.computer_name,
          totalDays: studentRecords.length,
          forgotCount: forgotCount,
        };
      });

      setSummaryData(summary);
    } catch (error) {
      console.error('Error loading summary:', error);
      alert('Lỗi khi tải dữ liệu thống kê');
    } finally {
      setLoading(false);
    }
  }

  // Tạo bản đồ vị trí máy -> học sinh
  function getSeatMap(): Map<string, StudentEquipmentSummary | null> {
    const seatMap = new Map<string, StudentEquipmentSummary | null>();

    ROWS.forEach(row => {
      COLS.forEach(col => {
        seatMap.set(`${row}${col}`, null);
      });
    });

    summaryData.forEach(student => {
      if (student.computerName) {
        seatMap.set(student.computerName, student);
      }
    });

    return seatMap;
  }

  const totalForgot = summaryData.reduce((sum, s) => sum + s.forgotCount, 0);
  const studentsWithForgot = summaryData.filter(s => s.forgotCount > 0).length;

  return (
    <div className="p-4 lg:p-8 pb-24 lg:pb-8">
      <div className="mb-4 lg:mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-800">Thống kê đồ dùng học tập</h1>
        <p className="text-sm lg:text-base text-gray-600 mt-1">Tổng hợp số lần quên đồ dùng của học sinh</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow mb-4 lg:mb-6">
        <button
          onClick={() => setIsControlsCollapsed(!isControlsCollapsed)}
          className="w-full flex items-center justify-between p-4 lg:p-6 text-left hover:bg-gray-50 transition-colors"
        >
          <span className="font-semibold text-gray-700">Bộ lọc</span>
          {isControlsCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
        </button>

        {!isControlsCollapsed && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 px-4 lg:px-6 pb-4 lg:pb-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Năm học</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm lg:text-base"
            >
              {schoolYears.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Lớp</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm lg:text-base"
            >
              {classes.map((classItem) => (
                <option key={classItem.id} value={classItem.id}>
                  {(classItem as any).grades?.name} - {classItem.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Từ ngày</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm lg:text-base"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Đến ngày</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm lg:text-base"
            />
          </div>
        </div>
        )}
      </div>

      {/* Overall Stats */}
      {summaryData.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 lg:p-6 mb-4 lg:mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Tổng quan</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl lg:text-3xl font-bold text-gray-800">{summaryData.length}</p>
              <p className="text-xs lg:text-sm text-gray-600">Tổng học sinh</p>
            </div>
            <div className="text-center">
              <p className="text-2xl lg:text-3xl font-bold text-orange-600">{studentsWithForgot}</p>
              <p className="text-xs lg:text-sm text-gray-600">HS quên đồ</p>
            </div>
            <div className="text-center">
              <p className="text-2xl lg:text-3xl font-bold text-red-600">{totalForgot}</p>
              <p className="text-xs lg:text-sm text-gray-600">Tổng lượt quên</p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : !selectedClassId ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 text-sm lg:text-lg">Vui lòng chọn lớp để xem thống kê</p>
        </div>
      ) : summaryData.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 text-sm lg:text-lg">Không có dữ liệu trong khoảng thời gian này</p>
        </div>
      ) : (
        <>
          {/* Desktop Grid */}
          <div className="hidden lg:block bg-white rounded-lg shadow p-4">
            <h2 className="text-lg font-bold text-gray-800 mb-4 text-center">Số lần quên đồ dùng</h2>

            {ROWS.map(row => {
              const seatMap = getSeatMap();
              return (
                <div key={row} className="grid grid-cols-8 gap-2 mb-2">
                  {COLS.map(col => {
                    const computerName = `${row}${col}`;
                    const student = seatMap.get(computerName);
                    const isEmpty = !student;
                    const hasForgot = student && student.forgotCount > 0;

                    return (
                      <div
                        key={computerName}
                        className={`
                          relative p-2 rounded-lg border-2 min-h-[70px] flex flex-col items-center justify-center
                          ${isEmpty
                            ? 'border-dashed border-gray-300 bg-gray-50 opacity-40'
                            : hasForgot
                              ? 'border-orange-300 bg-orange-50'
                              : 'border-green-300 bg-green-50'
                          }
                        `}
                      >
                        <span className={`text-xs font-medium ${isEmpty ? 'text-gray-400' : 'text-gray-600'}`}>
                          {computerName}
                        </span>
                        {student && (
                          <>
                            <span className={`text-xl font-bold ${hasForgot ? 'text-orange-600' : 'text-green-600'}`}>
                              {student.forgotCount}
                            </span>
                            <span className="text-[10px] truncate max-w-full text-gray-600">
                              {student.studentName}
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
            <h2 className="text-base font-bold text-gray-800 mb-3 text-center">Số lần quên đồ dùng</h2>

            {COLS.map(col => {
              const seatMap = getSeatMap();
              return (
                <div key={col} className="grid grid-cols-5 gap-1 mb-1">
                  {ROWS.map(row => {
                    const computerName = `${row}${col}`;
                    const student = seatMap.get(computerName);
                    const isEmpty = !student;
                    const hasForgot = student && student.forgotCount > 0;

                    return (
                      <div
                        key={computerName}
                        className={`
                          relative p-1 rounded-md border min-h-[50px] flex flex-col items-center justify-center
                          ${isEmpty
                            ? 'border-dashed border-gray-300 bg-gray-50 opacity-40'
                            : hasForgot
                              ? 'border-orange-300 bg-orange-50'
                              : 'border-green-300 bg-green-50'
                          }
                        `}
                      >
                        <span className={`text-[10px] font-medium ${isEmpty ? 'text-gray-400' : 'text-gray-600'}`}>
                          {computerName}
                        </span>
                        {student && (
                          <span className={`text-base font-bold ${hasForgot ? 'text-orange-600' : 'text-green-600'}`}>
                            {student.forgotCount}
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
                <span className="w-6 h-6 lg:w-8 lg:h-8 rounded border-2 border-green-300 bg-green-50 flex items-center justify-center text-green-600 font-bold text-xs lg:text-sm">0</span>
                <span className="text-gray-700">Không quên</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-6 h-6 lg:w-8 lg:h-8 rounded border-2 border-orange-300 bg-orange-50 flex items-center justify-center text-orange-600 font-bold text-xs lg:text-sm">N</span>
                <span className="text-gray-700">Số lần quên</span>
              </div>
            </div>
          </div>

          {/* Students with most forgot */}
          {studentsWithForgot > 0 && (
            <div className="mt-4 lg:mt-6 bg-white rounded-lg shadow p-4 lg:p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Danh sách học sinh quên đồ dùng</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b-2 border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs lg:text-sm font-bold text-gray-700">STT</th>
                      <th className="px-3 py-2 text-left text-xs lg:text-sm font-bold text-gray-700">Họ tên</th>
                      <th className="px-3 py-2 text-center text-xs lg:text-sm font-bold text-gray-700">Máy</th>
                      <th className="px-3 py-2 text-center text-xs lg:text-sm font-bold text-gray-700">Số lần quên</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {summaryData
                      .filter(s => s.forgotCount > 0)
                      .sort((a, b) => b.forgotCount - a.forgotCount)
                      .map((student, index) => (
                        <tr key={student.studentId} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-xs lg:text-sm text-gray-600">{index + 1}</td>
                          <td className="px-3 py-2 text-xs lg:text-sm font-medium text-gray-800">{student.studentName}</td>
                          <td className="px-3 py-2 text-center text-xs lg:text-sm text-gray-600">{student.computerName || '-'}</td>
                          <td className="px-3 py-2 text-center">
                            <span className="inline-flex items-center justify-center px-2 py-1 rounded-full bg-orange-100 text-orange-700 font-bold text-xs lg:text-sm">
                              {student.forgotCount}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
