export interface User {
  id: string;
  name: string;
  role: string;
  email?: string;
  phone?: string;
  avatar?: string;
  bio?: string;
  department_section: string;
  enrollment_status: string;
  section_id?: number;
  status: string;
  is_active?: boolean;
  created_at?: string;
  last_login?: string;
}

export interface Course {
  id: number;
  code: string;
  name: string;
  units: number;
}

export interface Section {
  id: number;
  name: string;
  year_level: string;
  status: string;
  courses: Course[];
  instructors: { id: string; name: string; avatar: string }[];
  subject_assignments?: { course_id: number; instructor_id: string }[];
  student_count: number;
  created_at: string;
}

export interface Message {
  id: number;
  from_id: string;
  from_name: string;
  to_id: string;
  to_name: string;
  subject: string;
  body: string;
  is_read: boolean;
  is_spam: boolean;
  is_important: boolean;
  is_unsent?: boolean;
  created_at: string;
}

export interface Announcement {
  id: number;
  title: string;
  body: string;
  type: string;
  color: string;
  target_audience: string;
  target_class?: string;
  author_id: string;
  author_name: string;
  created_at: string;
}

export interface Assignment {
  id: number;
  course_code: string;
  course_name: string;
  title: string;
  description: string;
  due_date: string;
  max_points: number;
  instructor_id: string;
  instructor_name: string;
  submission_count: number;
  submitted_by_me?: boolean;
  my_grade?: number | null;
  my_submission?: { id: number; file_name: string; submitted_at: string; feedback?: string };
  created_at: string;
  submissions?: Submission[];
}

export interface Submission {
  id: number;
  assignment_id?: number;
  student_id: string;
  student_name?: string;
  file_name: string;
  grade: number | null;
  feedback?: string;
  submitted_at: string;
  graded_at?: string;
}

export interface Schedule {
  id: number;
  course_code: string;
  course_label: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  room_location: string;
  section_or_instructor: string;
  units?: number;
  created_at?: string;
}

export interface Preferences {
  dark_mode: boolean;
  accent_color: string;
  notifications_email: boolean;
  notifications_bell: boolean;
  notifications_messages: boolean;
}

export interface Grade {
  id: any;
  student_id: string;
  student_name: string;
  professor_id: string;
  professor_name: string;
  subject: string;
  section: string;
  attendance_score: number;
  recitation_score: number;
  quiz_score: number;
  activities_score: number;
  exam_score: number;
  final_grade: number;
  percentage_score: number;
  remarks: string;
  updated_at: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
}

export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  per_page?: number;
  total_pages?: number;
  unread_count?: number;
}
