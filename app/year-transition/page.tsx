'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Class, Grade, Student } from '@/lib/types';
import { RefreshCw, ArrowRight, Plus, AlertCircle } from 'lucide-react';

interface ClassWithStudents extends Class {
  student_count?: number;
  students?: Student[];
}

interface ClassMapping {
  oldClassId: string;
  oldClassName: string;
  newClassName: string;
  newGradeId: string;
  studentIds: string[];
}

export default function YearTransitionPage() {
  const [sourceYear, setSourceYear] = useState('2025-2026');
  const [targetYear, setTargetYear] = useState('2026-2027');
  const [schoolYears, setSchoolYears] = useState<string[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [classes, setClasses] = useState<ClassWithStudents[]>([]);
  const [classMappings, setClassMappings] = useState<ClassMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Select year, 2: Map classes, 3: Confirm

  useEffect(() => {
    loadSchoolYears();
    loadGrades();
  }, []);

  useEffect(() => {
    if (sourceYear) {
      loadClasses();
    }
  }, [sourceYear]);

  async function loadSchoolYears() {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('school_year')
        .order('school_year', { ascending: false });

      if (error) throw error;

      const uniqueYears = Array.from(new Set(data?.map(c => c.school_year) || []));
      setSchoolYears(uniqueYears);
    } catch (error) {
      console.error('Error loading school years:', error);
    }
  }

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

  async function loadClasses() {
    try {
      setLoading(true);

      // Load classes with student count
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select(`
          *,
          grades (id, name)
        `)
        .eq('school_year', sourceYear)
        .order('grade_id');

      if (classError) throw classError;

      // Load students for each class
      const classesWithStudents = await Promise.all(
        (classData || []).map(async (classItem) => {
          const { data: students, error: studentsError } = await supabase
            .from('students')
            .select('*')
            .eq('class_id', classItem.id);

          if (studentsError) throw studentsError;

          return {
            ...classItem,
            students: students || [],
            student_count: students?.length || 0,
          };
        })
      );

      setClasses(classesWithStudents);

      // Initialize class mappings
      const initialMappings: ClassMapping[] = classesWithStudents
        .filter(c => c.grades?.name !== 'Khối 5') // Exclude grade 5 (graduated)
        .map(c => {
          const currentGradeName = c.grades?.name || '';
          const currentGradeNumber = parseInt(currentGradeName.replace(/\D/g, ''));
          const nextGradeNumber = currentGradeNumber + 1;
          const nextGrade = grades.find(g => g.name.includes(nextGradeNumber.toString()));

          return {
            oldClassId: c.id,
            oldClassName: c.name,
            newClassName: c.name.replace(currentGradeNumber.toString(), nextGradeNumber.toString()),
            newGradeId: nextGrade?.id || '',
            studentIds: c.students?.map((s: Student) => s.id) || [],
          };
        });

      setClassMappings(initialMappings);
    } catch (error) {
      console.error('Error loading classes:', error);
      alert('Không thể tải danh sách lớp học');
    } finally {
      setLoading(false);
    }
  }

  function updateMapping(index: number, field: keyof ClassMapping, value: any) {
    const updated = [...classMappings];
    updated[index] = { ...updated[index], [field]: value };
    setClassMappings(updated);
  }

  async function executeTransition() {
    if (!confirm(
      `Xác nhận chuyển năm học từ ${sourceYear} sang ${targetYear}?\n\n` +
      `- ${classMappings.length} lớp sẽ được tạo mới\n` +
      `- Học sinh lớp 5 sẽ không được chuyển (tốt nghiệp)\n` +
      `- Dữ liệu cũ được giữ nguyên\n\n` +
      `Thao tác này không thể hoàn tác!`
    )) {
      return;
    }

    try {
      setLoading(true);

      // Create new classes for target year
      const newClassesData = classMappings.map(mapping => ({
        name: mapping.newClassName,
        grade_id: mapping.newGradeId,
        school_year: targetYear,
        schedule: null,
      }));

      const { data: newClasses, error: createError } = await supabase
        .from('classes')
        .insert(newClassesData)
        .select();

      if (createError) throw createError;

      // Update students to new classes
      const updatePromises = classMappings.map(async (mapping, index) => {
        const newClass = newClasses[index];

        // Update all students in this class
        const { error: updateError } = await supabase
          .from('students')
          .update({ class_id: newClass.id })
          .in('id', mapping.studentIds);

        if (updateError) throw updateError;
      });

      await Promise.all(updatePromises);

      alert(`Chuyển năm học thành công!\n\n` +
        `✓ Đã tạo ${newClasses.length} lớp mới cho năm học ${targetYear}\n` +
        `✓ Đã chuyển học sinh sang lớp mới\n` +
        `✓ Học sinh lớp 5 đã tốt nghiệp (không được chuyển)`
      );

      // Reset
      setStep(1);
      loadSchoolYears();
      setClassMappings([]);
    } catch (error: any) {
      console.error('Error executing transition:', error);
      alert(error.message || 'Có lỗi xảy ra khi chuyển năm học');
    } finally {
      setLoading(false);
    }
  }

  const graduatedClasses = classes.filter(c => c.grades?.name === 'Khối 5');
  const totalGraduated = graduatedClasses.reduce((sum, c) => sum + (c.student_count || 0), 0);

  return (
    <div className="p-4 lg:p-8 pb-20 lg:pb-8">
      <div className="mb-6 lg:mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-800 flex items-center gap-2">
          <RefreshCw className="text-blue-600" />
          Chuyển năm học
        </h1>
        <p className="text-sm lg:text-base text-gray-600 mt-1">
          Chuyển học sinh sang năm học mới
        </p>
      </div>

      {/* Step Indicator */}
      <div className="mb-8 flex items-center justify-center gap-4">
        <div className={`flex items-center gap-2 ${step >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
            1
          </div>
          <span className="hidden lg:inline font-semibold">Chọn năm học</span>
        </div>
        <ArrowRight className="text-gray-400" />
        <div className={`flex items-center gap-2 ${step >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
            2
          </div>
          <span className="hidden lg:inline font-semibold">Ánh xạ lớp học</span>
        </div>
        <ArrowRight className="text-gray-400" />
        <div className={`flex items-center gap-2 ${step >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${step >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
            3
          </div>
          <span className="hidden lg:inline font-semibold">Xác nhận</span>
        </div>
      </div>

      {/* Step 1: Select Year */}
      {step === 1 && (
        <div className="bg-white rounded-xl shadow-md p-6 max-w-2xl mx-auto">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Bước 1: Chọn năm học</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Năm học hiện tại (nguồn)
              </label>
              <select
                value={sourceYear}
                onChange={(e) => setSourceYear(e.target.value)}
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
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Năm học mới (đích)
              </label>
              <input
                type="text"
                value={targetYear}
                onChange={(e) => setTargetYear(e.target.value)}
                placeholder="Ví dụ: 2026-2027"
                pattern="\d{4}-\d{4}"
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                Định dạng: YYYY-YYYY (ví dụ: 2026-2027)
              </p>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <>
                {classes.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                    <h3 className="font-semibold text-blue-800 mb-2">Tổng quan năm học {sourceYear}:</h3>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>• {classes.length} lớp học</li>
                      <li>• {classes.reduce((sum, c) => sum + (c.student_count || 0), 0)} học sinh</li>
                      <li className="text-red-600">• {totalGraduated} học sinh lớp 5 sẽ tốt nghiệp</li>
                    </ul>
                  </div>
                )}

                <button
                  onClick={() => setStep(2)}
                  disabled={classes.length === 0 || !targetYear}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Tiếp theo: Ánh xạ lớp học
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Map Classes */}
      {step === 2 && (
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">Bước 2: Ánh xạ lớp học</h2>
            <button
              onClick={() => setStep(1)}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              ← Quay lại
            </button>
          </div>

          {/* Warning for graduated students */}
          {totalGraduated > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4 flex items-start gap-2">
              <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
              <div className="text-sm text-yellow-800">
                <p className="font-semibold">Lưu ý:</p>
                <p>{totalGraduated} học sinh lớp 5 sẽ tốt nghiệp và không được chuyển sang năm học mới.</p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {classMappings.map((mapping, index) => {
              const oldClass = classes.find(c => c.id === mapping.oldClassId);
              return (
                <div key={mapping.oldClassId} className="border border-gray-200 rounded-lg p-4">
                  <div className="grid lg:grid-cols-3 gap-4">
                    {/* Old Class Info */}
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Lớp cũ ({sourceYear})</p>
                      <p className="font-semibold text-gray-800">{oldClass?.name}</p>
                      <p className="text-sm text-gray-600">{oldClass?.grades?.name}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {oldClass?.student_count || 0} học sinh
                      </p>
                    </div>

                    <div className="flex items-center justify-center">
                      <ArrowRight className="text-blue-600" />
                    </div>

                    {/* New Class Input */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Lớp mới ({targetYear})
                      </label>
                      <input
                        type="text"
                        value={mapping.newClassName}
                        onChange={(e) => updateMapping(index, 'newClassName', e.target.value)}
                        className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none mb-2"
                        placeholder="Tên lớp mới"
                      />
                      <select
                        value={mapping.newGradeId}
                        onChange={(e) => updateMapping(index, 'newGradeId', e.target.value)}
                        className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                      >
                        <option value="">-- Chọn khối --</option>
                        {grades.map((grade) => (
                          <option key={grade.id} value={grade.id}>
                            {grade.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => setStep(3)}
            disabled={classMappings.some(m => !m.newClassName || !m.newGradeId)}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed mt-6"
          >
            Tiếp theo: Xác nhận
          </button>
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === 3 && (
        <div className="bg-white rounded-xl shadow-md p-6 max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">Bước 3: Xác nhận</h2>
            <button
              onClick={() => setStep(2)}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              ← Quay lại
            </button>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <h3 className="font-semibold text-blue-800 mb-2">Tóm tắt chuyển năm học:</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Từ năm học: <span className="font-semibold">{sourceYear}</span></li>
              <li>• Sang năm học: <span className="font-semibold">{targetYear}</span></li>
              <li>• Số lớp sẽ tạo mới: <span className="font-semibold">{classMappings.length}</span></li>
              <li>• Tổng số học sinh chuyển: <span className="font-semibold">
                {classMappings.reduce((sum, m) => sum + m.studentIds.length, 0)}
              </span></li>
              {totalGraduated > 0 && (
                <li className="text-red-600">• Học sinh tốt nghiệp (lớp 5): <span className="font-semibold">{totalGraduated}</span></li>
              )}
            </ul>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-yellow-800">
              ⚠️ <span className="font-semibold">Lưu ý:</span> Thao tác này sẽ tạo các lớp mới và chuyển học sinh.
              Dữ liệu cũ (điểm danh, đánh giá) của năm học {sourceYear} sẽ được giữ nguyên.
            </p>
          </div>

          <div className="space-y-2">
            <button
              onClick={executeTransition}
              disabled={loading}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {loading ? 'Đang xử lý...' : 'Xác nhận chuyển năm học'}
            </button>
            <button
              onClick={() => setStep(2)}
              disabled={loading}
              className="w-full px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
            >
              Quay lại kiểm tra
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
