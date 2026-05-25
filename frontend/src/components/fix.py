import re

with open('GradesView.tsx', 'r') as f:
    content = f.read()

# We need to replace everything between fetchGrades and handleQuizUpdate with the correct code.
# Find where fetchGrades starts and where handleQuizUpdate starts.

fetch_grades_start = content.find('  const fetchGrades = async () => {')
handle_activity_start = content.find('  const handleActivityUpdate = async (updatedActivities: Activity[]) => {')

correct_block = """  const fetchGrades = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/grades');
      setGrades(data.data || []);
    } catch (e) {
      toast('Failed to load grades', 'error', 'fa-times-circle');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateInput = (studentId: string, subject: string, field: keyof GradeRecord, value: string) => {
    
    let numVal = value === '' ? 0 : Number(value);
    
    // Enforce limits
    if (field === 'recitation_score' && numVal > 10) numVal = 10;
    if (field === 'attendance_score' && numVal > 100) numVal = 100;
    if (field === 'activities_score' && numVal > 100) numVal = 100;
    if (field === 'exam_score' && numVal > 100) numVal = 100;

    setDisplayData(prev => prev.map(g => {
      if (g.student_id === studentId && g.subject === subject) {
        return { ...g, [field]: numVal };
      }
      return g;
    }));
  };

  const handleSave = async (studentId: string, subject: string) => {
    const record = displayData.find(g => g.student_id === studentId && g.subject === subject);
    const original = grades.find(g => g.student_id === studentId && g.subject === subject);
    if (!record || !original) return;

    // BREAK INFINITE LOOP: Only trigger API save if values actually changed
    if (record.recitation_score === original.recitation_score && 
        record.exam_score === original.exam_score) {
      return;
    }

    try {
      await api.post('/grades', {
        student_id: record.student_id,
        subject: record.subject,
        section: record.section,
        attendance_score: record.attendance_score,
        recitation_score: record.recitation_score,
        quizzes_data: record.quizzes_data,
        activities_data: record.activities_data || "[]",
        activities_score: record.activities_score,
        exam_score: record.exam_score
      });
      fetchGrades(); 
    } catch (e) {
      toast('Error saving grade', 'error', 'fa-times-circle');
    }
  };

  const handleQuizUpdate = async (updatedQuizzes: Quiz[]) => {
    const qData = JSON.stringify(updatedQuizzes);
    const record = displayData.find(g => g.student_id === quizModal.studentId && g.subject === quizModal.subject);
    if (!record) return;

    try {
      await api.post('/grades', {
        student_id: record.student_id,
        subject: record.subject,
        section: record.section,
        attendance_score: record.attendance_score,
        recitation_score: record.recitation_score,
        quizzes_data: qData,
        activities_data: record.activities_data || "[]",
        activities_score: record.activities_score,
        exam_score: record.exam_score
      });
      setQuizModal({ ...quizModal, open: false });
      fetchGrades();
    } catch (e) {
      toast('Error saving quizzes', 'error', 'fa-times-circle');
    }
  };

"""

new_content = content[:fetch_grades_start] + correct_block + content[handle_activity_start:]

with open('GradesView.tsx', 'w') as f:
    f.write(new_content)

print("Fixed!")
