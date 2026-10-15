import { EvaluationRequest } from '@/types';
import { 
  canonicalizeCategory, 
  CATEGORIES, 
  CanonicalCategoryId, 
  isEligibilityCategory 
} from '@/lib/categories';
import { 
  getCriteriaForQuestion, 
  allocateCriterionMarks, 
  AllocatedCriterion 
} from '@/lib/evaluation/criteria-registry';

const SUPPORTED_SUBJECTIVE_TYPES = [
  'coding',
  'code_review',
  'open_text',
  'open_response',
  'essay',
  'structured_response',
  'scenario',
  'case_study',
  'ai_scenario'
];

/**
 * Dynamically selects and builds the evaluation prompt combining:
 * 1. The canonical category's predefined criteria and assessment goals.
 * 2. The question type's operational instructions (e.g. coding static inspection vs structured fields).
 * 3. Question metadata (constraints, sample input/output, fields, scenario context).
 * 4. Deterministic criterion mark allocations summing strictly to maxMarks.
 * 5. Strict structured JSON output schema.
 */
export function getEvaluationPrompt(request: EvaluationRequest): string {
  const rawSection = request.section || '';
  const rawType = (request.questionType || '').trim().toLowerCase();

  // 1. Guard against unscored Eligibility category
  if (isEligibilityCategory(rawSection)) {
    throw new Error(
      `Eligibility questions are unscored and must never be routed to the AI evaluation engine.`
    );
  }

  // 2. Validate category
  const canonicalCategory = canonicalizeCategory(rawSection);
  if (!canonicalCategory) {
    throw new Error(
      `Unsupported or unrecognized category: "${rawSection || 'Missing'}". Cannot select evaluation criteria.`
    );
  }

  // 3. Validate supported question type
  const isSubjectiveType = SUPPORTED_SUBJECTIVE_TYPES.includes(rawType);
  if (!isSubjectiveType) {
    throw new Error(
      `Unsupported question type: "${rawType}" for subjective AI evaluation in section "${canonicalCategory}". Objective types must use deterministic grading.`
    );
  }

  // 4. Retrieve predefined criteria for this category and type
  const criteria = getCriteriaForQuestion(canonicalCategory, rawType);
  if (!criteria || criteria.length === 0) {
    throw new Error(
      `No predefined evaluation criteria registered for category "${canonicalCategory}" and question type "${rawType}".`
    );
  }

  // 5. Deterministically allocate criterion marks against question maximum
  const allocatedCriteria = allocateCriterionMarks(criteria, request.maxMarks);

  // 6. Build composable prompt
  return buildPromptContent(request, canonicalCategory, rawType, allocatedCriteria);
}

function buildPromptContent(
  request: EvaluationRequest,
  category: CanonicalCategoryId,
  questionType: string,
  allocatedCriteria: AllocatedCriterion[]
): string {
  const categoryMeta = CATEGORIES[category];
  const isCoding = questionType === 'coding';
  const isCodeReview = questionType === 'code_review';
  const isStructured = questionType === 'structured_response';

  // Section 1: Role & Purpose
  let roleHeader = `You are an expert technical and professional examiner for the "${categoryMeta.label}" assessment section.\n`;
  roleHeader += `Section Focus: ${categoryMeta.description}\n`;

  // Section 2: Question-Type Specific Instructions & Execution Telemetry Notice
  let typeInstructions = '';
  if (isCoding) {
    typeInstructions = `
CRITICAL CODING EVALUATION CONSTRAINTS:
1. STATIC CODE INSPECTION ONLY: You are performing a static code review. You DO NOT have live execution results or compiler outputs for this submission.
2. DO NOT state or claim that the code "passed all test cases" or "executed successfully". Instead, explain whether the logic and edge case handling appear functionally sound and compliant based on static inspection.
3. Review algorithmic logic, syntax correctness, time/space complexity, modularity, and language best practices.
`;
  } else if (isCodeReview) {
    typeInstructions = `
CRITICAL CODE-REVIEW EVALUATION INSTRUCTIONS:
1. Assess whether the candidate correctly identified the bug(s), security vulnerabilities, or performance bottlenecks in the given code snippet.
2. Evaluate whether the proposed fix or explanation is accurate, safe, and idiomatic.
3. Assess the constructive tone and clarity of the candidate's feedback.
`;
  } else if (isStructured) {
    typeInstructions = `
CRITICAL STRUCTURED-RESPONSE INSTRUCTIONS:
1. Evaluate how thoroughly the candidate addressed each required field/step of the structured prompt.
2. Assess logical progression, completeness, coherence, and depth across all structured components.
`;
  } else {
    typeInstructions = `
EVALUATION INSTRUCTIONS:
1. Evaluate the submission against the question prompt with rigorous, evidence-based objectivity.
2. Award marks proportionally based strictly on the candidate's demonstrated quality, reasoning, and depth.
`;
  }

  // Section 3: Question Context & Metadata
  let questionBlock = `QUESTION / PROBLEM STATEMENT:\n${request.question}\n`;

  const meta = request.metadata || {};
  if (meta.scenario) {
    questionBlock += `\nScenario Context:\n${meta.scenario}\n`;
  }
  if (meta.caseStudyTitle || meta.caseStudyProblemStatement) {
    questionBlock += `\nCase Study: ${meta.caseStudyTitle || ''}\n${meta.caseStudyProblemStatement || ''}\n`;
    if (meta.caseStudyContext) questionBlock += `Context: ${meta.caseStudyContext}\n`;
    if (meta.caseStudyBackground) questionBlock += `Background: ${meta.caseStudyBackground}\n`;
  }
  if (meta.constraints) {
    questionBlock += `\nConstraints:\n${meta.constraints}\n`;
  }
  if (meta.sampleInput || meta.sampleOutput) {
    questionBlock += `\nSample Input:\n${meta.sampleInput || 'N/A'}\nSample Output:\n${meta.sampleOutput || 'N/A'}\n`;
  }
  if (Array.isArray(meta.fields) && meta.fields.length > 0) {
    questionBlock += `\nRequired Structured Fields:\n`;
    meta.fields.forEach((f: any, idx: number) => {
      questionBlock += `${idx + 1}. ${typeof f === 'object' ? (f.label || f.name || JSON.stringify(f)) : String(f)}\n`;
    });
  }
  if (meta.minWords || meta.maxWords) {
    questionBlock += `\nExpected Word Count: ${meta.minWords ? `Min ${meta.minWords}` : ''} ${meta.maxWords ? `Max ${meta.maxWords}` : ''}\n`;
  }

  // Section 4: Student Submission
  const studentBlock = `\nCANDIDATE'S SUBMISSION:\n${request.studentAnswer}\n`;

  // Section 5: Predefined Criteria & Marks Allocation Table
  let criteriaBlock = `\nPREDEFINED EVALUATION CRITERIA & MARK ALLOCATIONS (TOTAL: ${request.maxMarks} MARKS):\n`;
  criteriaBlock += `You MUST score the submission against each of the following predefined criteria. Do NOT alter, omit, or add criteria.\n\n`;

  allocatedCriteria.forEach((c, index) => {
    criteriaBlock += `${index + 1}. [ID: "${c.id}"] ${c.name} — MAXIMUM: ${c.maxScore} marks\n`;
    criteriaBlock += `   Scope: ${c.description}\n`;
  });

  // Section 6: Output Schema & Validation Rules
  const schemaBlock = `
RESPONSE REQUIREMENTS:
Analyze the candidate's submission and respond STRICTLY in valid JSON matching this schema, without markdown code fences or conversational text:

{
  "evaluationStatus": "Correct" | "Partially Correct" | "Incorrect",
  "criteria": [
${allocatedCriteria.map(c => `    {
      "id": "${c.id}",
      "name": "${c.name}",
      "score": <number between 0.0 and ${c.maxScore}>,
      "maxScore": ${c.maxScore},
      "explanation": "<Specific evidence and justification for score awarded>"
    }`).join(',\n')}
  ],
  "score": <number equal to the exact sum of criterion scores>,
  "feedback": "<Overall qualitative summary feedback>",
  "strengths": ["<1-3 key strengths demonstrated>"],
  "improvements": ["<1-3 actionable improvements>"],
  "deductionReasons": ["<Specific reason(s) for any marks deducted>"]
}

SCORING RULES:
1. For every criterion, the score MUST be between 0.0 and its maxScore (rounded to 1 decimal place).
2. The overall "score" property MUST equal the exact mathematical sum of all criterion scores.
3. If the answer is completely missing, irrelevant, or logically invalid, assign 0.0 to all criteria.
4. Output STRICT standard JSON only.
`;

  return `${roleHeader}${typeInstructions}\n${questionBlock}${studentBlock}${criteriaBlock}${schemaBlock}`;
}
