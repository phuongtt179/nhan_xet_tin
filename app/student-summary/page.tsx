'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Class, Topic, Criterion } from '@/lib/types';
import { UserCheck, BarChart2, FileDown, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { printSingleStudent, printAllStudents } from '@/lib/printUtils';
import { useAuth } from '@/contexts/AuthContext';

interface Student {
  id: string;
  name: string;
  computer_name: string | null;
}

interface TopicSummary {
  topicId: string;
  topicName: string;
  averageRating: number;
  criteriaCount: number;
  completedCount: number;
}

interface StudentDetail {
  studentId: string;
  studentName: string;
  computerName: string | null;
  topics: TopicSummary[];
  overallAverage: number;
}

export default function StudentSummaryPage() {
  const { isAdmin, getAssignedClassIds } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [availableTopics, setAvailableTopics] = useState<Topic[]>([]);

  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  const [studentDetail, setStudentDetail] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [isFiltersCollapsed, setIsFiltersCollapsed] = useState(false);

  useEffect(() => {
    loadClasses();
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      loadStudentsForClass();
      loadTopicsForClass();
    } else {
      setStudents([]);
      setAvailableTopics([]);
      setSelectedTopicIds([]);
      setStudentDetail(null);
    }
  }, [selectedClassId]);

  useEffect(() => {
    if (selectedClassId && selectedStudentId && selectedTopicIds.length > 0) {
      loadStudentSummary();
    } else {
      setStudentDetail(null);
    }
  }, [selectedClassId, selectedStudentId, selectedTopicIds, startDate, endDate]);

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

  async function loadStudentsForClass() {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('id, name, computer_name')
        .eq('class_id', selectedClassId)
        .order('computer_name', { ascending: true, nullsFirst: false });

      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error('Error loading students:', error);
    }
  }

  async function loadTopicsForClass() {
    try {
      // Get class's grade
      const { data: classData } = await supabase
        .from('classes')
        .select('grade_id')
        .eq('id', selectedClassId)
        .single();

      if (!classData) return;

      // Get all topics for this grade
      const { data, error } = await supabase
        .from('topics')
        .select('*')
        .eq('grade_id', classData.grade_id)
        .order('name');

      if (error) throw error;

      const topics = data || [];
      setAvailableTopics(topics);

      // Auto-select all topics
      setSelectedTopicIds(topics.map(t => t.id));
    } catch (error) {
      console.error('Error loading topics:', error);
    }
  }

  async function loadStudentSummary() {
    try {
      setLoading(true);

      // Get student info
      const { data: studentData } = await supabase
        .from('students')
        .select('id, name, computer_name')
        .eq('id', selectedStudentId)
        .single();

      if (!studentData) return;

      // Use only selected topics
      const topicsData = availableTopics.filter(t => selectedTopicIds.includes(t.id));

      if (topicsData.length === 0) {
        setStudentDetail({
          studentId: studentData.id,
          studentName: studentData.name,
          computerName: studentData.computer_name,
          topics: [],
          overallAverage: 0,
        });
        return;
      }

      // Get all criteria for these topics
      const { data: criteriaData } = await supabase
        .from('criteria')
        .select('id, topic_id')
        .in('topic_id', topicsData.map(t => t.id));

      // Build evaluations query
      let query = supabase
        .from('evaluations')
        .select('criterion_id, rating, evaluated_date')
        .eq('student_id', selectedStudentId)
        .eq('class_id', selectedClassId);

      if (startDate) {
        query = query.gte('evaluated_date', startDate);
      }
      if (endDate) {
        query = query.lte('evaluated_date', endDate);
      }

      const { data: evaluationsData } = await query;

      // Process data: calculate average per topic
      const topicSummaries: TopicSummary[] = topicsData.map(topic => {
        // Get criteria IDs for this topic
        const topicCriteriaIds = criteriaData?.filter(c => c.topic_id === topic.id).map(c => c.id) || [];

        if (topicCriteriaIds.length === 0) {
          return {
            topicId: topic.id,
            topicName: topic.name,
            averageRating: 0,
            criteriaCount: 0,
            completedCount: 0,
          };
        }

        // Get evaluations for this topic's criteria
        const topicEvals = evaluationsData?.filter(e => topicCriteriaIds.includes(e.criterion_id)) || [];

        if (topicEvals.length === 0) {
          return {
            topicId: topic.id,
            topicName: topic.name,
            averageRating: 0,
            criteriaCount: topicCriteriaIds.length,
            completedCount: 0,
          };
        }

        // Calculate average rating
        const avgRating = topicEvals.reduce((sum, e) => sum + e.rating, 0) / topicEvals.length;

        // Count unique criteria that have been evaluated
        const uniqueCriteria = new Set(topicEvals.map(e => e.criterion_id));

        return {
          topicId: topic.id,
          topicName: topic.name,
          averageRating: avgRating,
          criteriaCount: topicCriteriaIds.length,
          completedCount: uniqueCriteria.size,
        };
      });

      // Calculate overall average
      const topicsWithRatings = topicSummaries.filter(t => t.averageRating > 0);
      const overallAverage = topicsWithRatings.length > 0
        ? topicsWithRatings.reduce((sum, t) => sum + t.averageRating, 0) / topicsWithRatings.length
        : 0;

      setStudentDetail({
        studentId: studentData.id,
        studentName: studentData.name,
        computerName: studentData.computer_name,
        topics: topicSummaries,
        overallAverage,
      });
    } catch (error) {
      console.error('Error loading student summary:', error);
      alert('Lỗi khi tải tổng hợp');
    } finally {
      setLoading(false);
    }
  }

  function toggleTopicSelection(topicId: string) {
    setSelectedTopicIds(prev => {
      if (prev.includes(topicId)) {
        return prev.filter(id => id !== topicId);
      } else {
        return [...prev, topicId];
      }
    });
  }

  function selectAllTopics() {
    setSelectedTopicIds(availableTopics.map(t => t.id));
  }

  function deselectAllTopics() {
    setSelectedTopicIds([]);
  }

  function exportSingleStudentPDF() {
    if (!studentDetail) return;

    const selectedClass = classes.find(c => c.id === selectedClassId);
    if (!selectedClass) return;

    const gradeName = (selectedClass as any).grades?.name || '';

    printSingleStudent(
      selectedClass.name,
      gradeName,
      startDate,
      endDate,
      studentDetail
    );
  }

  async function exportAllStudentsPDF() {
    if (!selectedClassId || selectedTopicIds.length === 0) {
      alert('Vui lòng chọn lớp và chủ đề');
      return;
    }

    try {
      setLoading(true);

      const selectedClass = classes.find(c => c.id === selectedClassId);
      if (!selectedClass) return;

      // Load all students in class
      const { data: allStudents } = await supabase
        .from('students')
        .select('id, name, computer_name')
        .eq('class_id', selectedClassId)
        .order('computer_name', { ascending: true, nullsFirst: false });

      if (!allStudents || allStudents.length === 0) {
        alert('Không có học sinh nào trong lớp');
        return;
      }

      // Use only selected topics
      const topicsData = availableTopics.filter(t => selectedTopicIds.includes(t.id));

      // Get all criteria for these topics
      const { data: criteriaData } = await supabase
        .from('criteria')
        .select('id, topic_id')
        .in('topic_id', topicsData.map(t => t.id));

      // Build evaluations query for all students
      let query = supabase
        .from('evaluations')
        .select('student_id, criterion_id, rating, evaluated_date')
        .eq('class_id', selectedClassId)
        .in('student_id', allStudents.map(s => s.id));

      if (startDate) {
        query = query.gte('evaluated_date', startDate);
      }
      if (endDate) {
        query = query.lte('evaluated_date', endDate);
      }

      const { data: allEvaluationsData } = await query;

      // Process data for each student
      const studentDetails = allStudents.map(student => {
        const studentEvals = allEvaluationsData?.filter(e => e.student_id === student.id) || [];

        const topicSummaries = topicsData.map(topic => {
          const topicCriteriaIds = criteriaData?.filter(c => c.topic_id === topic.id).map(c => c.id) || [];
          const topicEvals = studentEvals.filter(e => topicCriteriaIds.includes(e.criterion_id));

          const avgRating = topicEvals.length > 0
            ? topicEvals.reduce((sum, e) => sum + e.rating, 0) / topicEvals.length
            : 0;

          const uniqueCriteria = new Set(topicEvals.map(e => e.criterion_id));

          return {
            topicName: topic.name,
            averageRating: avgRating,
            criteriaCount: topicCriteriaIds.length,
            completedCount: uniqueCriteria.size,
          };
        });

        const topicsWithRatings = topicSummaries.filter(t => t.averageRating > 0);
        const overallAverage = topicsWithRatings.length > 0
          ? topicsWithRatings.reduce((sum, t) => sum + t.averageRating, 0) / topicsWithRatings.length
          : 0;

        return {
          name: student.name,
          computerName: student.computer_name,
          topics: topicSummaries,
          overallAverage
        };
      });

      const gradeName = (selectedClass as any).grades?.name || '';

      printAllStudents(
        selectedClass.name,
        gradeName,
        startDate,
        endDate,
        topicsData,
        studentDetails
      );
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Lỗi khi xuất PDF');
    } finally {
      setLoading(false);
    }
  }

  function getRatingLabel(rating: number) {
    if (rating === 0) {
      return <span className="text-gray-400 text-xs">Chưa có</span>;
    }
    const rounded = Math.round(rating);
    const labels: { [key: number]: { text: string; color: string } } = {
      1: { text: 'Chưa đạt', color: 'text-red-600 bg-red-50' },
      2: { text: 'Hoàn thành', color: 'text-blue-600 bg-blue-50' },
      3: { text: 'Tốt', color: 'text-green-600 bg-green-50' },
      4: { text: 'Rất tốt', color: 'text-yellow-600 bg-yellow-50' },
    };
    const label = labels[rounded] || labels[2];
    return (
      <span className={`px-2 py-1 rounded text-xs font-semibold ${label.color}`}>
        {label.text}
      </span>
    );
  }

  function calculateOverallResult(topics: { averageRating: number }[]) {
    const ratings = topics.map(t => t.averageRating).filter(r => r > 0);
    if (ratings.length === 0) return { text: '-', color: 'text-gray-400' };

    const totalTopics = ratings.length;
    const goodOrBetter = ratings.filter(r => r >= 3).length;
    const notCompleted = ratings.filter(r => Math.round(r) === 1).length;

    if (goodOrBetter >= (totalTopics * 3 / 4) && notCompleted === 0) {
      return { text: 'Hoàn thành tốt', color: 'text-green-600' };
    }
    if (notCompleted >= (totalTopics / 2)) {
      return { text: 'Chưa hoàn thành', color: 'text-red-600' };
    }
    return { text: 'Hoàn thành', color: 'text-blue-600' };
  }

  const canShowSummary = selectedClassId && selectedStudentId && studentDetail && studentDetail.topics.length > 0;

  return (
    <div className="p-4 lg:p-8 pb-20 lg:pb-8">
      <div className="mb-4 lg:mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-800 flex items-center gap-2">
            <UserCheck className="text-blue-600" size={32} />
            Tổng hợp theo Học sinh
          </h1>
          <p className="text-sm lg:text-base text-gray-600 mt-1">
            Xem tổng hợp đánh giá của từng học sinh theo các chủ đề
          </p>
        </div>
        {selectedClassId && selectedTopicIds.length > 0 && (
          <button
            onClick={exportAllStudentsPDF}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold text-sm lg:text-base"
          >
            <FileDown size={20} />
            <span className="hidden lg:inline">Xuất PDF cả lớp</span>
            <span className="lg:hidden">PDF lớp</span>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow mb-4 lg:mb-6">
        {/* Header - clickable */}
        <div
          onClick={() => setIsFiltersCollapsed(!isFiltersCollapsed)}
          className="flex items-center justify-between p-4 lg:p-6 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-200"
        >
          <div className="flex items-center gap-2">
            <h2 className="text-base lg:text-lg font-bold text-gray-800">Bộ lọc</h2>
            {isFiltersCollapsed && (
              <span className="text-sm text-gray-600">
                {classes.find(c => c.id === selectedClassId)?.name || 'Chưa chọn lớp'} - {students.find(s => s.id === selectedStudentId)?.name || 'Chưa chọn học sinh'}
                {startDate && ` (${format(new Date(startDate), 'dd/MM/yyyy')} - ${format(new Date(endDate), 'dd/MM/yyyy')})`}
              </span>
            )}
          </div>
          {isFiltersCollapsed ? <ChevronDown size={24} /> : <ChevronUp size={24} />}
        </div>

        {/* Content - collapsible */}
        {!isFiltersCollapsed && (
          <div className="p-4 lg:p-6 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Lớp <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedClassId}
                  onChange={(e) => {
                    setSelectedClassId(e.target.value);
                    setSelectedStudentId('');
                  }}
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
                  Học sinh <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  disabled={!selectedClassId}
                  className="w-full px-3 lg:px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm lg:text-base disabled:bg-gray-100"
                >
                  <option value="">-- Chọn học sinh --</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name} {student.computer_name ? `(${student.computer_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Từ ngày</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 lg:px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm lg:text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Đến ngày</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 lg:px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm lg:text-base"
                />
              </div>
            </div>

            <p className="text-xs text-gray-500">
              * Để trống &quot;Từ ngày&quot; để xem tất cả đánh giá từ trước đến nay
            </p>
          </div>
        )}
      </div>

      {/* Topic Selection */}
      {selectedClassId && availableTopics.length > 0 && (
        <div className="bg-white p-4 lg:p-6 rounded-lg shadow mb-4 lg:mb-6">
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-semibold text-gray-700">
              Chọn chủ đề để xem báo cáo <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAllTopics}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                Chọn tất cả
              </button>
              <span className="text-gray-400">|</span>
              <button
                type="button"
                onClick={deselectAllTopics}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                Bỏ chọn tất cả
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-3">
            {availableTopics.map((topic) => (
              <label
                key={topic.id}
                className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
              >
                <input
                  type="checkbox"
                  checked={selectedTopicIds.includes(topic.id)}
                  onChange={() => toggleTopicSelection(topic.id)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{topic.name}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Đã chọn: {selectedTopicIds.length}/{availableTopics.length} chủ đề
          </p>
        </div>
      )}

      {/* Summary */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : !selectedClassId ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 text-sm lg:text-lg">Vui lòng chọn lớp để xem tổng hợp</p>
        </div>
      ) : availableTopics.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 text-sm lg:text-lg">Khối lớp này chưa có chủ đề nào</p>
        </div>
      ) : selectedTopicIds.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 text-sm lg:text-lg">Vui lòng chọn ít nhất một chủ đề</p>
        </div>
      ) : !selectedStudentId ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 text-sm lg:text-lg">Vui lòng chọn học sinh để xem tổng hợp</p>
        </div>
      ) : studentDetail && studentDetail.topics.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 text-sm lg:text-lg">Không có dữ liệu đánh giá cho các chủ đề đã chọn</p>
        </div>
      ) : !canShowSummary ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 text-sm lg:text-lg">Chưa có dữ liệu đánh giá</p>
        </div>
      ) : (
        <>
          {/* Student Info Card */}
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-200 rounded-lg p-4 lg:p-6 mb-4 lg:mb-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h2 className="text-xl lg:text-2xl font-bold text-gray-800">
                  {studentDetail.studentName}
                </h2>
                {studentDetail.computerName && (
                  <p className="text-sm text-gray-600 mt-1">
                    Máy: <span className="font-semibold">{studentDetail.computerName}</span>
                  </p>
                )}
              </div>
              <div className="text-right flex items-center gap-3">
                <div>
                  <p className="text-xs lg:text-sm text-gray-600">Kết quả</p>
                  <div className={`text-xl lg:text-2xl font-bold ${calculateOverallResult(studentDetail.topics).color}`}>
                    {calculateOverallResult(studentDetail.topics).text}
                  </div>
                </div>
                <button
                  onClick={exportSingleStudentPDF}
                  className="flex items-center gap-2 px-3 lg:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-sm"
                  title="Xuất PDF học sinh này"
                >
                  <FileDown size={18} />
                  <span className="hidden lg:inline">Xuất PDF</span>
                </button>
              </div>
            </div>
          </div>

          {/* Topics Summary Table */}
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-gray-50 border-b-2 border-gray-200">
                <tr>
                  <th className="px-3 lg:px-4 py-3 text-left text-xs lg:text-sm font-bold text-gray-700">
                    Chủ đề
                  </th>
                  <th className="px-3 lg:px-4 py-3 text-center text-xs lg:text-sm font-bold text-gray-700">
                    Tiến độ
                  </th>
                  <th className="px-3 lg:px-4 py-3 text-center text-xs lg:text-sm font-bold text-gray-700">
                    Đánh giá
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {studentDetail.topics.map((topic) => (
                  <tr key={topic.topicId} className="hover:bg-gray-50">
                    <td className="px-3 lg:px-4 py-3 text-sm lg:text-base font-semibold text-gray-800">
                      {topic.topicName}
                    </td>
                    <td className="px-3 lg:px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs lg:text-sm text-gray-600">
                          {topic.completedCount}/{topic.criteriaCount} tiêu chí
                        </span>
                        {topic.criteriaCount > 0 && (
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{
                                width: `${(topic.completedCount / topic.criteriaCount) * 100}%`,
                              }}
                            ></div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 lg:px-4 py-3 text-center">
                      {getRatingLabel(topic.averageRating)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="mt-4 lg:mt-6 bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-800 mb-2 text-sm lg:text-base">Ghi chú:</h3>
            <ul className="space-y-1 text-xs lg:text-sm text-gray-700">
              <li>• <span className="text-red-600 font-semibold">Chưa đạt</span>, <span className="text-blue-600 font-semibold">Hoàn thành</span>, <span className="text-green-600 font-semibold">Tốt</span>, <span className="text-yellow-600 font-semibold">Rất tốt</span></li>
              <li>• <span className="font-semibold">Hoàn thành tốt</span>: ≥3/4 chủ đề đạt Tốt+ và không có Chưa đạt</li>
              <li>• <span className="font-semibold">Chưa hoàn thành</span>: ≥1/2 chủ đề Chưa đạt</li>
              <li>• Tiến độ hiển thị số tiêu chí đã được đánh giá / tổng số tiêu chí</li>
            </ul>
          </div>
</>
      )}
    </div>
  );
}
