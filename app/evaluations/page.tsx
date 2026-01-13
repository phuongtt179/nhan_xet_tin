'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Class, Topic, Criterion, Student } from '@/lib/types';
import { Save, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';

interface StudentEvaluation {
  studentId: string;
  studentName: string;
  computerName: string | null;
  rating: number; // 1=Chưa đạt, 2=Hoàn thành(default), 3=Tốt, 4=Rất tốt, 0=Vắng mặt
  isAbsent: boolean; // true nếu học sinh vắng mặt
}

export default function EvaluationsPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [criteria, setCriteria] = useState<Criterion[]>([]);

  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [selectedCriterionId, setSelectedCriterionId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  const [students, setStudents] = useState<StudentEvaluation[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isControlsCollapsed, setIsControlsCollapsed] = useState(false);

  useEffect(() => {
    loadClasses();
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      loadTopicsForClass();
    } else {
      setTopics([]);
      setCriteria([]);
      setStudents([]);
    }
  }, [selectedClassId]);

  useEffect(() => {
    if (selectedTopicId) {
      loadCriteriaForTopic();
    } else {
      setCriteria([]);
      setStudents([]);
    }
  }, [selectedTopicId]);

  useEffect(() => {
    if (selectedClassId && selectedCriterionId && selectedDate) {
      loadStudentsAndEvaluations();
    } else {
      setStudents([]);
    }
  }, [selectedClassId, selectedCriterionId, selectedDate]);

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
        .order('name');

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

      const { data, error } = await supabase
        .from('topics')
        .select('*')
        .eq('grade_id', classData.grade_id)
        .order('name');

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

  async function loadStudentsAndEvaluations() {
    try {
      setLoading(true);

      // Load students in this class
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id, name, computer_name')
        .eq('class_id', selectedClassId)
        .order('computer_name', { ascending: true, nullsFirst: false });

      if (studentsError) {
        console.error('Error loading students:', studentsError);
        throw studentsError;
      }

      // Load existing evaluations for this criterion and date
      const { data: evaluationsData, error: evaluationsError } = await supabase
        .from('evaluations')
        .select('student_id, rating')
        .eq('class_id', selectedClassId)
        .eq('criterion_id', selectedCriterionId)
        .eq('evaluated_date', selectedDate);

      if (evaluationsError) {
        console.error('Error loading evaluations:', evaluationsError);
        // Don't throw, just continue without existing evaluation data
      }

      // Load attendance data for this date
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('student_id, status')
        .eq('class_id', selectedClassId)
        .eq('date', selectedDate);

      if (attendanceError) {
        console.error('Error loading attendance:', attendanceError);
        // Don't throw, just continue without attendance data
      }

      // Merge data
      const studentEvals: StudentEvaluation[] = (studentsData || []).map(student => {
        const existing = evaluationsData?.find(e => e.student_id === student.id);
        const attendance = attendanceData?.find(a => a.student_id === student.id);
        const isAbsent = attendance?.status === 'absent';

        return {
          studentId: student.id,
          studentName: student.name,
          computerName: student.computer_name,
          rating: isAbsent ? 0 : (existing?.rating || 2), // 0 nếu vắng, default 2 (Hoàn thành)
          isAbsent: isAbsent,
        };
      });

      setStudents(studentEvals);
    } catch (error) {
      console.error('Error loading students and evaluations:', error);
      alert('Lỗi khi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }

  function cycleRating(studentId: string) {
    setStudents(prevStudents =>
      prevStudents.map(s => {
        if (s.studentId === studentId && !s.isAbsent) {
          // Cycle: 2(Hoàn thành) -> 3(Tốt) -> 4(Rất tốt) -> 1(Chưa đạt) -> 2(Hoàn thành)
          let newRating: number;
          if (s.rating === 2) newRating = 3;
          else if (s.rating === 3) newRating = 4;
          else if (s.rating === 4) newRating = 1;
          else newRating = 2;

          return { ...s, rating: newRating };
        }
        return s;
      })
    );
  }

  async function handleSave() {
    if (!selectedClassId || !selectedCriterionId || !selectedDate) {
      alert('Vui lòng chọn đầy đủ lớp, tiêu chí và ngày');
      return;
    }

    try {
      setSaving(true);

      for (const student of students) {
        // Skip absent students (rating = 0)
        if (student.isAbsent) {
          continue;
        }

        // Check if evaluation exists (without .single() to avoid 406 error)
        const { data: existingList, error: checkError } = await supabase
          .from('evaluations')
          .select('id')
          .eq('student_id', student.studentId)
          .eq('criterion_id', selectedCriterionId)
          .eq('class_id', selectedClassId)
          .eq('evaluated_date', selectedDate);

        if (checkError) {
          console.error('Error checking evaluation:', checkError);
          continue;
        }

        const existing = existingList && existingList.length > 0 ? existingList[0] : null;

        if (existing) {
          // Update
          const { error: updateError } = await supabase
            .from('evaluations')
            .update({
              rating: student.rating,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          if (updateError) {
            console.error('Error updating evaluation:', updateError);
          }
        } else {
          // Insert
          const { error: insertError } = await supabase
            .from('evaluations')
            .insert([{
              student_id: student.studentId,
              criterion_id: selectedCriterionId,
              class_id: selectedClassId,
              evaluated_date: selectedDate,
              rating: student.rating,
            }]);

          if (insertError) {
            console.error('Error inserting evaluation:', insertError);
          }
        }
      }

      alert('Lưu đánh giá thành công!');
    } catch (error) {
      console.error('Error saving evaluations:', error);
      alert('Lỗi khi lưu đánh giá');
    } finally {
      setSaving(false);
    }
  }

  function getRatingLabel(rating: number): { text: string; color: string } {
    switch (rating) {
      case 0:
        return { text: 'Vắng', color: 'bg-gray-100 text-gray-500' };
      case 1:
        return { text: 'Chưa đạt', color: 'bg-red-100 text-red-800' };
      case 2:
        return { text: 'Hoàn thành', color: 'bg-blue-100 text-blue-800' };
      case 3:
        return { text: 'Tốt', color: 'bg-green-100 text-green-800' };
      case 4:
        return { text: 'Rất tốt', color: 'bg-yellow-100 text-yellow-800' };
      default:
        return { text: 'Hoàn thành', color: 'bg-blue-100 text-blue-800' };
    }
  }

  const canEvaluate = selectedClassId && selectedCriterionId && students.length > 0;

  const selectedCriterion = criteria.find(c => c.id === selectedCriterionId);

  return (
    <div className="p-4 lg:p-8 pb-24 lg:pb-24">
      <div className="mb-4 lg:mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-800">Đánh giá học sinh</h1>
        <p className="text-sm lg:text-base text-gray-600 mt-1">
          Đánh giá học sinh theo từng tiêu chí
        </p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow mb-4 lg:mb-6">
        {/* Header with collapse button */}
        <div
          className="flex items-center justify-between p-4 lg:p-6 cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => setIsControlsCollapsed(!isControlsCollapsed)}
        >
          <div>
            <h2 className="text-lg font-bold text-gray-800">Thông tin đánh giá</h2>
            {isControlsCollapsed && selectedCriterion && (
              <p className="text-sm text-gray-600 mt-1">
                {criteria.find(c => c.id === selectedCriterionId)?.name} - {selectedDate}
              </p>
            )}
          </div>
          {isControlsCollapsed ? <ChevronDown size={24} /> : <ChevronUp size={24} />}
        </div>

        {/* Collapsible content */}
        {!isControlsCollapsed && (
          <div className="px-4 lg:px-6 pb-4 lg:pb-6 space-y-4 border-t">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Lớp <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedClassId}
                  onChange={(e) => {
                    setSelectedClassId(e.target.value);
                    setSelectedTopicId('');
                    setSelectedCriterionId('');
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
                  Chủ đề <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedTopicId}
                  onChange={(e) => {
                    setSelectedTopicId(e.target.value);
                    setSelectedCriterionId('');
                  }}
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
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tiêu chí <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedCriterionId}
                  onChange={(e) => setSelectedCriterionId(e.target.value)}
                  disabled={!selectedTopicId}
                  className="w-full px-3 lg:px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm lg:text-base disabled:bg-gray-100"
                >
                  <option value="">-- Chọn tiêu chí --</option>
                  {criteria.map((criterion) => (
                    <option key={criterion.id} value={criterion.id}>
                      {criterion.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Ngày <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-3 lg:px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm lg:text-base"
                />
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Evaluation Table */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : !selectedClassId ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 text-sm lg:text-lg">Vui lòng chọn lớp để bắt đầu</p>
        </div>
      ) : !selectedTopicId ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 text-sm lg:text-lg">Vui lòng chọn chủ đề</p>
        </div>
      ) : !selectedCriterionId ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 text-sm lg:text-lg">Vui lòng chọn tiêu chí để đánh giá</p>
        </div>
      ) : students.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 text-sm lg:text-lg">Lớp này chưa có học sinh</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b-2 border-gray-200">
                <tr>
                  <th className="px-2 lg:px-4 py-3 text-center text-xs lg:text-sm font-bold text-gray-700 w-12 lg:w-16">
                    STT
                  </th>
                  <th className="px-2 lg:px-4 py-3 text-left text-xs lg:text-sm font-bold text-gray-700">
                    Họ và tên
                  </th>
                  <th className="px-2 lg:px-4 py-3 text-center text-xs lg:text-sm font-bold text-gray-700 w-20 lg:w-24">
                    Tên máy
                  </th>
                  <th className="px-2 lg:px-4 py-3 text-center text-xs lg:text-sm font-bold text-gray-700 w-32 lg:w-40">
                    Kết quả
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {students.map((student, index) => {
                  const { text, color } = getRatingLabel(student.rating);
                  return (
                    <tr
                      key={student.studentId}
                      onClick={() => cycleRating(student.studentId)}
                      className={`transition-colors ${
                        student.isAbsent
                          ? 'opacity-50 cursor-not-allowed bg-gray-50'
                          : 'hover:bg-gray-50 cursor-pointer active:bg-gray-100'
                      }`}
                    >
                      <td className="px-2 lg:px-4 py-3 text-center text-xs lg:text-sm text-gray-600">
                        {index + 1}
                      </td>
                      <td className="px-2 lg:px-4 py-3 text-xs lg:text-base font-semibold text-gray-800">
                        {student.studentName}
                      </td>
                      <td className="px-2 lg:px-4 py-3 text-center">
                        {student.computerName ? (
                          <span className="text-xs lg:text-sm font-semibold text-gray-700">
                            {student.computerName}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-2 lg:px-4 py-3 text-center">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs lg:text-sm font-semibold ${color}`}
                        >
                          {text}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="mt-4 lg:mt-6 bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-800 mb-2 text-sm lg:text-base">Hướng dẫn:</h3>
            <ul className="space-y-1 text-xs lg:text-sm text-gray-700">
              <li>• Nhấp vào dòng học sinh để thay đổi mức đánh giá</li>
              <li>• Chu kỳ: Hoàn thành → Tốt → Rất tốt → Chưa đạt → Hoàn thành</li>
              <li>• Mặc định: Hoàn thành</li>
              <li>• Nhấn nút &quot;Lưu đánh giá&quot; để lưu toàn bộ bảng</li>
            </ul>
          </div>
        </>
      )}

      {/* Fixed Save Button - floating at bottom */}
      {canEvaluate && (
        <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 lg:left-64 bg-white border-t-2 border-gray-200 shadow-lg p-4 z-20">
          <div className="max-w-7xl mx-auto flex justify-center lg:justify-start">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full lg:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed shadow-md"
            >
              <Save size={20} />
              {saving ? 'Đang lưu...' : 'Lưu đánh giá'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
