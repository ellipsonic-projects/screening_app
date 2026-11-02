/**
 * Shared TypeScript Types
 * Used across frontend and backend
 */

export interface CriterionEvaluation {
  id: string;
  name: string;
  score: number;
  maxScore: number;
  explanation: string;
}

export interface EvaluationRequest {
  questionId: string;
  section?: string;
  questionType: string;
  question: string;
  studentAnswer: string;
  maxMarks: number;
  evaluationRubric?: string[];
  metadata?: Record<string, any>;
}

export interface EvaluationResponse {
  questionId: string;
  score: number;
  maximumMarks: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
  deductionReasons?: string[];
  criteriaScores?: CriterionEvaluation[];
  evaluationStatus: 'COMPLETED' | 'FAILED' | 'PENDING' | 'PROCESSING' | 'RETRYING';
  evaluatedAt: string;
  modelUsed?: string;
  rawJson?: any;
  error?: string;
  success: boolean;
}

