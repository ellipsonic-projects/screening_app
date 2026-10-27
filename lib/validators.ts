/**
 * Validation Schemas using Zod
 * Centralized validation for all API inputs and forms
 */

import { z } from 'zod';
import { isPersonalityCategory } from '@/lib/categories';

// ==================== Auth Schemas ====================
export const RegisterSchema = z.object({
  email: z.string().trim().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  role: z.enum(['student', 'admin']).default('student'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const LoginSchema = z.object({
  email: z.string().trim().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

// ==================== Student Schemas ====================
export const StudentProfileSchema = z.object({
  email: z.string().email('Invalid email format'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  phone: z.string().regex(/^[0-9]{10}$/, 'Phone must be 10 digits'),
  college: z.string().min(2, 'College name is required'),
  usn: z.string().min(1, 'USN is required'),
  branchName: z.string().min(1, 'Branch name is required'),
  cameraPermission: z.boolean().default(false),
  microphonePermission: z.boolean().default(false),
});

export const AdminProfileSchema = z.object({
  email: z.string().email('Invalid email format').optional(),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  department: z.string().min(2, 'Department is required'),
});

// ==================== Question Schemas ====================
export const QuestionSchema = z.object({
  questionText: z.string().min(3, 'Question text must be at least 3 characters'),
  type: z.enum(['mcq', 'coding', 'single_select', 'open_text', 'ranking', 'structured_response', 'multi_select']),
  timeLimitSeconds: z.number().optional().default(60),
  points: z.number().min(0, 'Points must be at least 0').default(0),
  isPublished: z.boolean().default(false),
  explanation: z.string().optional(),
  
  weight: z.number().optional().default(1),
  expectedDuration: z.number().optional().default(5),
  isRequired: z.boolean().optional().default(true),
  displayOrder: z.number().optional().default(0),
  section: z.string().optional().default('APTITUDE'),
  sectionOrder: z.number().optional().default(0),
  questionOrder: z.number().optional().default(0),

  // Conditional validation based on type
  optionsJson: z.any().optional(),
  correctAnswer: z.string().optional(),
}).refine((data) => {
  if (data.type === 'mcq') {
    return !!data.optionsJson && !!data.correctAnswer;
  }
  if (data.type === 'single_select') {
    return !!data.optionsJson;
  }
  if (data.type === 'multi_select' || data.type === 'ranking') {
    return !!data.optionsJson && !!data.correctAnswer;
  }
  if (data.type === 'coding') {
    return !!data.optionsJson; // coding uses optionsJson for starter code and test cases
  }
  if (data.type === 'structured_response') {
    return !!data.optionsJson; // uses optionsJson for fields/steps
  }
  return true;
}, {
  message: 'Missing required configuration for the selected question type',
}).refine((data) => {
  if (isPersonalityCategory(data.section)) {
    return data.type === 'open_text';
  }
  return true;
}, {
  message: 'Personality category only supports open-text questions',
  path: ['type'],
});

export const SubmitTestResponseSchema = z.object({
  assessmentId: z.string().uuid('Invalid assessment ID').optional(),
  studentId: z.string().optional(),
  submittedAt: z.string().datetime().optional(),
  status: z.enum(['submitted', 'auto_submitted']).optional(),
  violations: z.array(z.any()).optional(),
  responses: z.array(
    z.object({
      questionId: z.string().uuid('Invalid question ID'),
      section: z.string().optional(),
      questionType: z.string().optional(),
      answer: z.string().optional(),
    })
  ).default([]),
});




// Type exports
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type StudentProfileInput = z.infer<typeof StudentProfileSchema>;
export type AdminProfileInput = z.infer<typeof AdminProfileSchema>;


