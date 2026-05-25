export const API_BASE = '/v1';

export const ROLES = {
  ADMIN: 'admin',
  INSTRUCTOR: 'instructor', 
  STUDENT: 'student',
} as const;

export const TARGETS = {
  ALL: 'ALL',
  STUDENTS: 'STUDENTS',
  FACULTY: 'FACULTY',
} as const;

export const ANN_COLORS: Record<string, string> = {
  ACADEMIC: 'emerald',
  URGENT: 'red',
  CAMPUS: 'indigo',
  FACULTY: 'amber',
};

export type Role = typeof ROLES[keyof typeof ROLES];
