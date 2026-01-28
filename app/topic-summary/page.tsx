'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Class, Topic, Criterion, Subject } from '@/lib/types';
import { Star, BarChart2, ChevronDown, ChevronUp, FileDown } from 'lucide-react';
import { format } from 'date-fns';
import { printTopicSummary } from '@/lib/printUtils';
import { useAuth } from '@/contexts/AuthContext';

interface StudentSummary {
  studentId: string;
  studentName: string;
  computerName: string | null;
  criteriaRatings: { [criterionId: string]: number }; // Average rating per criterion
  totalAverage: number;
}

export default function TopicSummaryPage() {
  const { isAdmin, getAssignedClassIds, getAssignedSubjects } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [criteria, setCriteria] = useState<Criterion[]>([]);

  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  const [summaryData, setSummaryData] = useState<StudentSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFiltersCollapsed, setIsFiltersCollapsed] = useState(false);

  // Subject selection for teachers with multiple subjects
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [assignedSubjects, setAssignedSubjects] = useState<Subject[]>([]);

  useEffect(() => {
    if (!isAdmin) {
      // Load subjects assigned to this teacher
      const subjects = getAssignedSubjects();
      setAssignedSubjects(subjects);
      // Auto-select if only one subject
      if (subjects.length === 1) {
        setSelectedSubjectId(subjects[0].id);
      }
    } else {
      // Admin: load all subjects
      loadAllSubjects();
    }
  }, [isAdmin]);

  useEffect(() => {
    // Load classes when subject is selected (for teachers) or always for admin
    if (isAdmin || selectedSubjectId) {
      loadClasses();
    } else if (!isAdmin && assignedSubjects.length > 0 && !selectedSubjectId) {
      // Teacher hasn't selected a subject yet
      setClasses([]);
    }
  }, [selectedSubjectId, isAdmin]);

  async function loadAllSubjects() {
    try {
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setAssignedSubjects(data || []);
      // Auto-select first subject for admin if available
      if (data && data.length > 0) {
        setSelectedSubjectId(data[0].id);
      }
    } catch (error) {
      console.error('Error loading subjects:', error);
    }
  }

  useEffect(() => {
    if (selectedClassId) {
      loadTopicsForClass();
    } else {
      setTopics([]);
      setCriteria([]);
    }
  }, [selectedClassId]);

  useEffect(() => {
    if (selectedTopicId) {
      loadCriteriaForTopic();
    } else {
      setCriteria([]);
    }
  }, [selectedTopicId]);

  useEffect(() => {
    if (selectedClassId && selectedTopicId && criteria.length > 0) {
      loadSummary();
    }
  }, [selectedClassId, selectedTopicId, startDate, endDate, criteria]);

  async function loadClasses() {
    try {
      // Get assigned class IDs filtered by selected subject
      const assignedClassIds = isAdmin ? null : getAssignedClassIds(selectedSubjectId);

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

  async function loadTopicsForClass() {
    try {
      const { data: classData } = await supabase
        .from('classes')
        .select('grade_id')
        .eq('id', selectedClassId)
        .single();

      if (!classData) return;

      let query = supabase
        .from('topics')
        .select('*')
        .eq('grade_id', classData.grade_id)
        .order('name');

      // Filter by subject_id if selected
      if (selectedSubjectId) {
        query = query.eq('subject_id', selectedSubjectId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTopics(data || []);
    } catch (error) {
      console.error('Error loading topics:', error);
    }
  }

  async function loadCriteriaForTopic() {
    try {
      const { data, error } = await supabase
        .from('criteria')
        .select('*')
        .eq('topic_id', selectedTopicId)
        .order('created_at');

      if (error) throw error;
      setCriteria(data || []);
    } catch (error) {
      console.error('Error loading criteria:', error);
    }
  }

  async function loadSummary() {
    try {
      setLoading(true);

      // Get all students in class
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id, name, computer_name')
        .eq('class_id', selectedClassId)
        .order('computer_name', { ascending: true, nullsFirst: false });

      if (studentsError) throw studentsError;

      // Build date filter
      let query = supabase
        .from('evaluations')
        .select('student_id, criterion_id, rating, evaluated_date')
        .eq('class_id', selectedClassId)
        .in('criterion_id', criteria.map(c => c.id));

      if (startDate) {
        query = query.gte('evaluated_date', startDate);
      }
      if (endDate) {
        query = query.lte('evaluated_date', endDate);
      }

      const { data: evaluationsData, error: evaluationsError } = await query;

      if (evaluationsError) throw evaluationsError;

      // Process data: calculate average rating per student per criterion
      const summaries: StudentSummary[] = (studentsData || []).map(student => {
        const studentEvals = evaluationsData?.filter(e => e.student_id === student.id) || [];

        const criteriaRatings: { [criterionId: string]: number } = {};
        let totalRating = 0;
        let totalCount = 0;

        criteria.forEach(criterion => {
          const criterionEvals = studentEvals.filter(e => e.criterion_id === criterion.id);

          if (criterionEvals.length > 0) {
            const avgRating =
              criterionEvals.reduce((sum, e) => sum + e.rating, 0) / criterionEvals.length;
            criteriaRatings[criterion.id] = avgRating;
            totalRating += avgRating;
            totalCount++;
          } else {
            criteriaRatings[criterion.id] = 0;
          }
        });

        const totalAverage = totalCount > 0 ? totalRating / totalCount : 0;

        return {
          studentId: student.id,
          studentName: student.name,
          computerName: student.computer_name,
          criteriaRatings,
          totalAverage,
        };
      });

      setSummaryData(summaries);
    } catch (error) {
      console.error('Error loading summary:', error);
      alert('Lỗi khi tải tổng hợp');
    } finally {
      setLoading(false);
    }
  }

  function getRatingLabel(rating: number) {
    if (rating === 0) {
      return <span className="text-gray-400 text-xs">-</span>;
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

  function calculateResult(criteriaRatings: { [key: string]: number }) {
    const ratings = Object.values(criteriaRatings).filter(r => r > 0);
    if (ratings.length === 0) return { text: '-', color: 'text-gray-400' };

    const totalCriteria = ratings.length;
    const goodOrBetter = ratings.filter(r => r >= 3).length;
    const notCompleted = ratings.filter(r => r === 1).length;

    if (goodOrBetter >= (totalCriteria * 3 / 4) && notCompleted === 0) {
      return { text: 'Hoàn thành tốt', color: 'text-green-600 bg-green-100' };
    }
    if (notCompleted >= (totalCriteria / 2)) {
      return { text: 'Chưa hoàn thành', color: 'text-red-600 bg-red-100' };
    }
    return { text: 'Hoàn thành', color: 'text-blue-600 bg-blue-100' };
  }

  function exportTopicSummaryPDF() {
    if (!selectedClassId || !selectedTopicId || summaryData.length === 0) {
      alert('Không có dữ liệu để xuất PDF');
      return;
    }

    const selectedClass = classes.find(c => c.id === selectedClassId);
    const selectedTopic = topics.find(t => t.id === selectedTopicId);

    if (!selectedClass || !selectedTopic) return;

    const gradeName = (selectedClass as any).grades?.name || '';

    printTopicSummary(
      selectedClass.name,
      selectedTopic.name,
      gradeName,
      startDate,
      endDate,
      criteria,
      summaryData
    );
  }

  const canShowSummary =
    selectedClassId && selectedTopicId && criteria.length > 0 && summaryData.length > 0;

  return (
    <div className="p-4 lg:p-8 pb-20 lg:pb-8">
      <div className="mb-4 lg:mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-800 flex items-center gap-2">
            <BarChart2 className="text-blue-600" size={32} />
            Tổng hợp theo Chủ đề
          </h1>
          <p className="text-sm lg:text-base text-gray-600 mt-1">
            Xem tổng hợp đánh giá của tất cả học sinh theo từng chủ đề
          </p>
        </div>
        {canShowSummary && (
          <button
            onClick={exportTopicSummaryPDF}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold text-sm lg:text-base"
          >
            <FileDown size={20} />
            <span className="hidden lg:inline">Xuất PDF</span>
            <span className="lg:hidden">PDF</span>
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
                {classes.find(c => c.id === selectedClassId)?.name || 'Chưa chọn lớp'} - {topics.find(t => t.id === selectedTopicId)?.name || 'Chưa chọn chủ đề'}
                {startDate && ` (${format(new Date(startDate), 'dd/MM/yyyy')} - ${format(new Date(endDate), 'dd/MM/yyyy')})`}
              </span>
            )}
          </div>
          {isFiltersCollapsed ? <ChevronDown size={24} /> : <ChevronUp size={24} />}
        </div>

        {/* Content - collapsible */}
        {!isFiltersCollapsed && (
          <div className="p-4 lg:p-6 space-y-4">
            {/* Subject selector - show when multiple subjects available */}
            {assignedSubjects.length > 1 && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Môn học <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => {
                    setSelectedSubjectId(e.target.value);
                    setSelectedClassId('');
                    setSelectedTopicId('');
                  }}
                  className="w-full px-3 lg:px-4 py-2 border-2 border-blue-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm lg:text-base bg-blue-50"
                >
                  <option value="">-- Chọn môn học --</option>
                  {assignedSubjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Lớp <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedClassId}
                  onChange={(e) => {
                    setSelectedClassId(e.target.value);
                    setSelectedTopicId('');
                  }}
                  disabled={!isAdmin && assignedSubjects.length > 1 && !selectedSubjectId}
                  className="w-full px-3 lg:px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm lg:text-base disabled:bg-gray-100"
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
                  Chủ đề <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedTopicId}
                  onChange={(e) => setSelectedTopicId(e.target.value)}
                  disabled={!selectedClassId}
                  className="w-full px-3 lg:px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm lg:text-base disabled:bg-gray-100"
                >
                  <option value="">-- Chọn chủ đề --</option>
                  {topics.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.name}
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

      {/* Summary Table */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : !isAdmin && assignedSubjects.length > 1 && !selectedSubjectId ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 text-sm lg:text-lg">Vui lòng chọn môn học để bắt đầu</p>
        </div>
      ) : !selectedClassId ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 text-sm lg:text-lg">Vui lòng chọn lớp để xem tổng hợp</p>
        </div>
      ) : !selectedTopicId ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 text-sm lg:text-lg">Vui lòng chọn chủ đề để xem tổng hợp</p>
        </div>
      ) : criteria.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 text-sm lg:text-lg">Chủ đề này chưa có tiêu chí đánh giá</p>
        </div>
      ) : !canShowSummary ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 text-sm lg:text-lg">Chưa có dữ liệu đánh giá</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-gray-50 border-b-2 border-gray-200">
              <tr>
                <th className="sticky left-0 z-10 bg-gray-50 px-3 lg:px-4 py-3 text-left text-xs lg:text-sm font-bold text-gray-700 border-r-2 border-gray-200">
                  Học sinh
                </th>
                {criteria.map((criterion) => (
                  <th
                    key={criterion.id}
                    className="px-3 lg:px-4 py-3 text-center text-xs lg:text-sm font-bold text-gray-700 min-w-[120px] border-r border-gray-200"
                  >
                    {criterion.name}
                  </th>
                ))}
                <th className="px-3 lg:px-4 py-3 text-center text-xs lg:text-sm font-bold text-gray-700 bg-blue-50 min-w-[120px]">
                  Kết quả
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {summaryData.map((student) => {
                const result = calculateResult(student.criteriaRatings);
                return (
                  <tr key={student.studentId} className="hover:bg-gray-50">
                    <td className="sticky left-0 z-10 bg-white hover:bg-gray-50 px-3 lg:px-4 py-3 border-r-2 border-gray-200">
                      <div className="text-sm lg:text-base font-semibold text-gray-800">
                        {student.studentName}
                      </div>
                      {student.computerName && (
                        <div className="text-xs text-gray-500">Máy: {student.computerName}</div>
                      )}
                    </td>
                    {criteria.map((criterion) => (
                      <td
                        key={criterion.id}
                        className="px-3 lg:px-4 py-3 text-center border-r border-gray-200"
                      >
                        {getRatingLabel(student.criteriaRatings[criterion.id] || 0)}
                      </td>
                    ))}
                    <td className="px-3 lg:px-4 py-3 text-center bg-blue-50">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${result.color}`}>
                        {result.text}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      {canShowSummary && (
        <div className="mt-6 bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-2 text-sm lg:text-base">Ghi chú:</h3>
          <ul className="space-y-1 text-xs lg:text-sm text-gray-700">
            <li>• <span className="text-red-600 font-semibold">Chưa đạt</span> = 1 điểm, <span className="text-blue-600 font-semibold">Hoàn thành</span> = 2 điểm, <span className="text-green-600 font-semibold">Tốt</span> = 3 điểm, <span className="text-yellow-600 font-semibold">Rất tốt</span> = 4 điểm</li>
            <li>• <span className="font-semibold">Hoàn thành tốt</span>: ≥3/4 tiêu chí đạt Tốt+ và không có Chưa đạt</li>
            <li>• <span className="font-semibold">Chưa hoàn thành</span>: ≥1/2 tiêu chí Chưa đạt</li>
            <li>• Dấu &quot;-&quot; nghĩa là chưa có đánh giá</li>
          </ul>
        </div>
      )}
    </div>
  );
}
