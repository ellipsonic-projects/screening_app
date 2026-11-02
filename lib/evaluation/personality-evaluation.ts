/**
 * lib/evaluation/personality-evaluation.ts
 *
 * Dedicated Qualitative Personality & Work-Style Evaluation Engine for EllipHire.
 * Completely decoupled from numeric scoring, marks allocation, and ranking rubrics.
 *
 * Purpose:
 * Generates an evidence-based qualitative candidate overview across 7 work-style dimensions
 * from behavioural, situational, and reflective interview responses (P01–P33).
 *
 * Strict Principles:
 * 1. Qualitative only: No numeric marks, total scores, rankings, or hiring recommendations.
 * 2. Evidence-based: Distinguishes self-reported interests, demonstrated past behaviour,
 *    hypothetical intentions, and personal reflections.
 * 3. Hobbies / Preferences Safeguard: Never infers competence or character from favourite
 *    books, movies, hobbies, or cultural preferences.
 * 4. Human Review Focus: Designed for recruiters and hiring managers to review substance
 *    and follow up with targeted interview questions.
 */

export type WorkStyleDimensionId =
  | 'OWNERSHIP_AND_INITIATIVE'
  | 'COLLABORATION'
  | 'COMMUNICATION'
  | 'ADAPTABILITY'
  | 'LEARNING_ORIENTATION'
  | 'SELF_MANAGEMENT'
  | 'JUDGMENT_AND_INTEGRITY';

export interface PredefinedCriterion {
  id: string;
  name: string;
  weight: number;
  description: string;
}

export interface WorkStyleDimension {
  id: WorkStyleDimensionId;
  name: string;
  weight: number;
  criteria: PredefinedCriterion[];
}

export interface QuestionEvaluationConfig {
  code: string;
  section: 'PERSONAL_INTERESTS' | 'BEHAVIOURAL' | 'SITUATIONAL' | 'PERSONAL_REFLECTION';
  scored: boolean;
  primaryDimension?: WorkStyleDimensionId;
  secondaryDimensions?: WorkStyleDimensionId[];
  responseNature:
    | 'SELF_REPORTED_INTEREST'
    | 'PAST_BEHAVIOUR'
    | 'HYPOTHETICAL'
    | 'PAST_OR_HYPOTHETICAL'
    | 'PERSONAL_REFLECTION';
  description: string;
}

export type EvidenceStatus = 'SUFFICIENT' | 'LIMITED' | 'INSUFFICIENT';

export type QualitativeScoreLevel =
  | 'LIMITED_EVIDENCE'
  | 'DEVELOPING'
  | 'STRONG'
  | 'PARTICULARLY_STRONG'
  | 'INSUFFICIENT_EVIDENCE';

// --------------------------------------------------
// 1. DIMENSION DEFINITIONS & CRITERIA
// --------------------------------------------------

export const WORKSTYLE_DIMENSIONS: Record<WorkStyleDimensionId, WorkStyleDimension> = {
  OWNERSHIP_AND_INITIATIVE: {
    id: 'OWNERSHIP_AND_INITIATIVE',
    name: 'Ownership & Initiative',
    weight: 0.15,
    criteria: [
      {
        id: 'accountability_follow_through',
        name: 'Accountability & Follow-Through',
        weight: 0.35,
        description: 'Takes responsibility for actions, acknowledges mistakes, accepts ownership of outcomes, and follows through.'
      },
      {
        id: 'initiative_proactivity',
        name: 'Proactivity & Initiative',
        weight: 0.35,
        description: 'Takes constructive action without constant supervision; acts before issues escalate.'
      },
      {
        id: 'ownership_escalation_judgment',
        name: 'Ownership & Escalation Judgment',
        weight: 0.30,
        description: 'Distinguishes between independent problem resolution and timely escalation.'
      }
    ]
  },
  COLLABORATION: {
    id: 'COLLABORATION',
    name: 'Collaboration & Teamwork',
    weight: 0.15,
    criteria: [
      {
        id: 'perspective_taking',
        name: 'Perspective Taking & Respect',
        weight: 0.35,
        description: 'Considers differing viewpoints, respects diverse working styles, and engages constructively.'
      },
      {
        id: 'constructive_disagreement',
        name: 'Constructive Disagreement & Conflict Handling',
        weight: 0.35,
        description: 'Handles disagreements professionally and seeks practical team-oriented solutions.'
      },
      {
        id: 'shared_responsibility',
        name: 'Shared Responsibility & Contribution',
        weight: 0.30,
        description: 'Recognizes others’ contributions and supports shared team commitments.'
      }
    ]
  },
  COMMUNICATION: {
    id: 'COMMUNICATION',
    name: 'Communication Clarity & Transparency',
    weight: 0.15,
    criteria: [
      {
        id: 'communication_clarity_context',
        name: 'Clarity & Context',
        weight: 0.35,
        description: 'Explains problems clearly with sufficient context for diverse audiences.'
      },
      {
        id: 'communication_transparency',
        name: 'Transparency & Timely Updates',
        weight: 0.35,
        description: 'Communicates blockers, progress, and delays proactively rather than withholding information.'
      },
      {
        id: 'communication_listening_feedback',
        name: 'Listening & Feedback Receptivity',
        weight: 0.30,
        description: 'Listens attentively, asks clarifying questions, and incorporates constructive feedback.'
      }
    ]
  },
  ADAPTABILITY: {
    id: 'ADAPTABILITY',
    name: 'Adaptability & Resilience',
    weight: 0.15,
    criteria: [
      {
        id: 'response_to_change',
        name: 'Response to Changing Conditions',
        weight: 0.35,
        description: 'Responds flexibly to shifting requirements, priorities, and unexpected constraints.'
      },
      {
        id: 'priority_reassessment',
        name: 'Priority Reassessment',
        weight: 0.35,
        description: 'Reconsiders commitments thoughtfully when conditions change without dropping core duties.'
      },
      {
        id: 'uncertainty_recovery',
        name: 'Response to Uncertainty & Setbacks',
        weight: 0.30,
        description: 'Maintains composure and problem-solving focus when unexpected roadblocks occur.'
      }
    ]
  },
  LEARNING_ORIENTATION: {
    id: 'LEARNING_ORIENTATION',
    name: 'Learning Orientation & Growth',
    weight: 0.10,
    criteria: [
      {
        id: 'self_directed_learning',
        name: 'Self-Directed Learning',
        weight: 0.35,
        description: 'Proactively explores unfamiliar subjects, resources, and identifies knowledge gaps.'
      },
      {
        id: 'feedback_experimentation',
        name: 'Feedback & Experimentation',
        weight: 0.35,
        description: 'Tests assumptions, leverages feedback, and experiments with alternative approaches.'
      },
      {
        id: 'reflection_knowledge_application',
        name: 'Reflection & Knowledge Application',
        weight: 0.30,
        description: 'Reflects on past experiences, extracts lessons from errors, and applies them to new work.'
      }
    ]
  },
  SELF_MANAGEMENT: {
    id: 'SELF_MANAGEMENT',
    name: 'Self-Management & Delivery',
    weight: 0.15,
    criteria: [
      {
        id: 'planning_prioritization',
        name: 'Planning & Prioritization',
        weight: 0.35,
        description: 'Organizes workload realistically, sequences dependencies, and manages competing tasks.'
      },
      {
        id: 'independent_execution',
        name: 'Independent Execution',
        weight: 0.35,
        description: 'Drives tasks forward independently while identifying when clarification is essential.'
      },
      {
        id: 'time_commitment_management',
        name: 'Commitment & Deadline Management',
        weight: 0.30,
        description: 'Manages deadlines realistically, communicates delivery risks early, and respects team dependencies.'
      }
    ]
  },
  JUDGMENT_AND_INTEGRITY: {
    id: 'JUDGMENT_AND_INTEGRITY',
    name: 'Judgment & Professional Ethics',
    weight: 0.15,
    criteria: [
      {
        id: 'risk_consequence_recognition',
        name: 'Risk & Consequence Recognition',
        weight: 0.35,
        description: 'Identifies ethical risks, safety oversights, and long-term implications of decisions.'
      },
      {
        id: 'principled_decision_making',
        name: 'Principled Decision-Making',
        weight: 0.35,
        description: 'Makes defensible, ethical choices under deadline or peer pressure.'
      },
      {
        id: 'responsible_action_escalation',
        name: 'Responsible Action & Escalation',
        weight: 0.30,
        description: 'Acts responsibly to mitigate harm and uses appropriate disclosure channels.'
      }
    ]
  }
};

// --------------------------------------------------
// 2. QUESTION SPECIFICATION REGISTRY (P01–P33)
// --------------------------------------------------

export const QUESTION_EVALUATION_REGISTRY: Record<string, QuestionEvaluationConfig> = {
  // P01–P06: Conversation Starters (Unscored, Personal Interests)
  P01: { code: 'P01', section: 'PERSONAL_INTERESTS', scored: false, responseNature: 'SELF_REPORTED_INTEREST', description: 'Favourite hobbies or creative outlets' },
  P02: { code: 'P02', section: 'PERSONAL_INTERESTS', scored: false, responseNature: 'SELF_REPORTED_INTEREST', description: 'Books, films, or podcasts that inspired curiosity' },
  P03: { code: 'P03', section: 'PERSONAL_INTERESTS', scored: false, responseNature: 'SELF_REPORTED_INTEREST', description: 'Preferred learning formats and intellectual topics' },
  P04: { code: 'P04', section: 'PERSONAL_INTERESTS', scored: false, responseNature: 'SELF_REPORTED_INTEREST', description: 'Favourite technical or non-technical personal projects' },
  P05: { code: 'P05', section: 'PERSONAL_INTERESTS', scored: false, responseNature: 'SELF_REPORTED_INTEREST', description: 'Inspirational figures or thinkers' },
  P06: { code: 'P06', section: 'PERSONAL_INTERESTS', scored: false, responseNature: 'SELF_REPORTED_INTEREST', description: 'Areas of personal curiosity outside of technology' },

  // P07–P12: Behavioural Questions
  P07: { code: 'P07', section: 'BEHAVIOURAL', scored: true, primaryDimension: 'OWNERSHIP_AND_INITIATIVE', secondaryDimensions: ['COMMUNICATION', 'SELF_MANAGEMENT'], responseNature: 'HYPOTHETICAL', description: 'The unfinished task — deadline ownership and proactive action.' },
  P08: { code: 'P08', section: 'BEHAVIOURAL', scored: true, primaryDimension: 'COMMUNICATION', secondaryDimensions: ['COLLABORATION'], responseNature: 'PAST_BEHAVIOUR', description: 'The uncomfortable truth — disagreement with someone senior.' },
  P09: { code: 'P09', section: 'BEHAVIOURAL', scored: true, primaryDimension: 'COLLABORATION', secondaryDimensions: [], responseNature: 'HYPOTHETICAL', description: 'The forgotten contribution — recognition and conflict handling.' },
  P10: { code: 'P10', section: 'BEHAVIOURAL', scored: true, primaryDimension: 'COLLABORATION', secondaryDimensions: ['ADAPTABILITY'], responseNature: 'HYPOTHETICAL', description: 'The difficult teammate — working-style differences.' },
  P11: { code: 'P11', section: 'BEHAVIOURAL', scored: true, primaryDimension: 'LEARNING_ORIENTATION', secondaryDimensions: ['OWNERSHIP_AND_INITIATIVE'], responseNature: 'HYPOTHETICAL', description: 'The repeated mistake — reflection and corrective action.' },
  P12: { code: 'P12', section: 'BEHAVIOURAL', scored: true, primaryDimension: 'SELF_MANAGEMENT', secondaryDimensions: ['OWNERSHIP_AND_INITIATIVE'], responseNature: 'HYPOTHETICAL', description: 'The independent worker — autonomy and clarification judgment.' },

  // P13–P18: Situational Judgment Questions
  P13: { code: 'P13', section: 'SITUATIONAL', scored: true, primaryDimension: 'COMMUNICATION', secondaryDimensions: ['SELF_MANAGEMENT', 'OWNERSHIP_AND_INITIATIVE'], responseNature: 'HYPOTHETICAL', description: 'The hybrid work problem — remote blocker communication.' },
  P14: { code: 'P14', section: 'SITUATIONAL', scored: true, primaryDimension: 'JUDGMENT_AND_INTEGRITY', secondaryDimensions: ['OWNERSHIP_AND_INITIATIVE'], responseNature: 'HYPOTHETICAL', description: 'The credit and responsibility dilemma — disclosure of a known issue.' },
  P15: { code: 'P15', section: 'SITUATIONAL', scored: true, primaryDimension: 'COLLABORATION', secondaryDimensions: ['JUDGMENT_AND_INTEGRITY', 'COMMUNICATION'], responseNature: 'HYPOTHETICAL', description: 'The unpopular decision — disagreement with the group.' },
  P16: { code: 'P16', section: 'SITUATIONAL', scored: true, primaryDimension: 'ADAPTABILITY', secondaryDimensions: ['SELF_MANAGEMENT'], responseNature: 'HYPOTHETICAL', description: 'The changing environment — changing priorities.' },
  P17: { code: 'P17', section: 'SITUATIONAL', scored: true, primaryDimension: 'LEARNING_ORIENTATION', secondaryDimensions: ['COMMUNICATION'], responseNature: 'HYPOTHETICAL', description: 'The feedback challenge — evaluating criticism.' },
  P18: { code: 'P18', section: 'SITUATIONAL', scored: true, primaryDimension: 'JUDGMENT_AND_INTEGRITY', secondaryDimensions: ['OWNERSHIP_AND_INITIATIVE'], responseNature: 'HYPOTHETICAL', description: 'The ethical shortcut — transparency and responsible decisions.' },

  // P19–P33: Personal Reflection (Unscored, Descriptive Supporting Context)
  P19: { code: 'P19', section: 'PERSONAL_REFLECTION', scored: false, responseNature: 'PERSONAL_REFLECTION', description: 'Proudest personal or academic achievement' },
  P20: { code: 'P20', section: 'PERSONAL_REFLECTION', scored: false, responseNature: 'PERSONAL_REFLECTION', description: 'Most significant setback and key takeaways' },
  P21: { code: 'P21', section: 'PERSONAL_REFLECTION', scored: false, responseNature: 'PERSONAL_REFLECTION', description: 'Preferred team working environment and culture' },
  P22: { code: 'P22', section: 'PERSONAL_REFLECTION', scored: false, responseNature: 'PERSONAL_REFLECTION', description: 'Approach to receiving constructive criticism' },
  P23: { code: 'P23', section: 'PERSONAL_REFLECTION', scored: false, responseNature: 'PERSONAL_REFLECTION', description: 'Handling ambiguity under shifting requirements' },
  P24: { code: 'P24', section: 'PERSONAL_REFLECTION', scored: false, responseNature: 'PERSONAL_REFLECTION', description: 'Motivations for software engineering & problem solving' },
  P25: { code: 'P25', section: 'PERSONAL_REFLECTION', scored: false, responseNature: 'PERSONAL_REFLECTION', description: 'Balancing speed and code quality' },
  P26: { code: 'P26', section: 'PERSONAL_REFLECTION', scored: false, responseNature: 'PERSONAL_REFLECTION', description: 'Managing interpersonal friction with peers' },
  P27: { code: 'P27', section: 'PERSONAL_REFLECTION', scored: false, responseNature: 'PERSONAL_REFLECTION', description: 'Sustaining focus during repetitive or tedious tasks' },
  P28: { code: 'P28', section: 'PERSONAL_REFLECTION', scored: false, responseNature: 'PERSONAL_REFLECTION', description: 'Approach to seeking help vs independent debugging' },
  P29: { code: 'P29', section: 'PERSONAL_REFLECTION', scored: false, responseNature: 'PERSONAL_REFLECTION', description: 'Long-term professional aspirations and growth goals' },
  P30: { code: 'P30', section: 'PERSONAL_REFLECTION', scored: false, responseNature: 'PERSONAL_REFLECTION', description: 'Personal definition of professional integrity' },
  P31: { code: 'P31', section: 'PERSONAL_REFLECTION', scored: false, responseNature: 'PERSONAL_REFLECTION', description: 'Preferred communication medium for critical decisions' },
  P32: { code: 'P32', section: 'PERSONAL_REFLECTION', scored: false, responseNature: 'PERSONAL_REFLECTION', description: 'Handling competing deadlines under pressure' },
  P33: { code: 'P33', section: 'PERSONAL_REFLECTION', scored: false, responseNature: 'PERSONAL_REFLECTION', description: 'Self-assessment of greatest area for professional growth' }
};

// --------------------------------------------------
// 3. DETERMINISTIC QUESTION RESOLVER (NO GUESSWORK)
// --------------------------------------------------

export interface ResolvedQuestionInfo {
  code: string;
  isMapped: boolean;
  config?: QuestionEvaluationConfig;
  warning?: string;
}

/**
 * Resolves a Personality question to its canonical P01–P33 identifier.
 * Inspects options_json metadata first, then checks for explicit regex prefixes in question_text.
 * Does NOT guess or rely on display_order or test array index.
 */
export function resolvePersonalityQuestionCode(question: {
  id?: string;
  question_text?: string;
  options_json?: any;
}): ResolvedQuestionInfo {
  // 1. Check options_json metadata
  const opts = question.options_json;
  if (opts && typeof opts === 'object') {
    const rawCode = String(opts.code || opts.questionCode || opts.id || '').trim().toUpperCase();
    if (rawCode && rawCode in QUESTION_EVALUATION_REGISTRY) {
      return {
        code: rawCode,
        isMapped: true,
        config: QUESTION_EVALUATION_REGISTRY[rawCode]
      };
    }
  }

  // 2. Check question_text regex prefix (e.g. "[P07]", "P07:", "P07 -", "P7.")
  const text = String(question.question_text || '').trim();
  const match = text.match(/^\s*\[?(P0?[1-9]|P[12][0-9]|P3[0-3])\]?[:\s.-]/i);
  if (match && match[1]) {
    let normalized = match[1].toUpperCase();
    if (normalized.length === 2 && normalized.startsWith('P')) {
      // P7 -> P07
      normalized = `P0${normalized.slice(1)}`;
    }
    if (normalized in QUESTION_EVALUATION_REGISTRY) {
      return {
        code: normalized,
        isMapped: true,
        config: QUESTION_EVALUATION_REGISTRY[normalized]
      };
    }
  }

  // 3. Explicitly unmapped — Flagged, never guessed
  return {
    code: 'UNMAPPED_QUESTION',
    isMapped: false,
    warning: `Question ID ${question.id || 'unknown'} does not contain a recognized P01–P33 identifier in its metadata or text prefix.`
  };
}

// --------------------------------------------------
// 4. QUALITATIVE OVERVIEW DATA STRUCTURES
// --------------------------------------------------

export interface QuestionObservation {
  questionId: string;
  questionCode: string;
  questionText: string;
  studentAnswer: string;
  band: 'PERSONAL_INTERESTS' | 'BEHAVIOURAL' | 'SITUATIONAL' | 'PERSONAL_REFLECTION' | 'UNMAPPED';
  evidenceNature: 'SELF_REPORTED_INTEREST' | 'PAST_BEHAVIOUR' | 'HYPOTHETICAL' | 'PAST_OR_HYPOTHETICAL' | 'PERSONAL_REFLECTION' | 'UNSPECIFIED';
  evidenceStatus: EvidenceStatus;
  summary: string;
  keyObservations: string[];
  concreteFollowUpQuestions: string[];
  isMapped: boolean;
}

export interface DimensionObservation {
  dimensionId: WorkStyleDimensionId;
  dimensionName: string;
  qualitativeLevel: QualitativeScoreLevel;
  evidenceStatus: EvidenceStatus;
  summary: string;
  supportingObservations: string[];
  referencedQuestionCodes: string[];
}

export interface PersonalityOverviewPayload {
  candidateOverview: string;
  selfReportedInterests: {
    summary: string;
    details: string[];
    disclaimer: string;
  };
  demonstratedStrengths: {
    statement: string;
    referencedQuestions: string[];
  }[];
  potentialDevelopmentAreas: {
    statement: string;
    referencedQuestions: string[];
  }[];
  dimensionObservations: Record<WorkStyleDimensionId, DimensionObservation>;
  insufficientEvidenceNotes: string[];
  recommendedFollowUpQuestions: {
    question: string;
    context: string;
    questionCodeRef: string;
  }[];
  unmappedQuestionsCount: number;
  evaluatedAt: string;
  modelUsed: string;
}

// --------------------------------------------------
// 5. PROMPT GENERATOR
// --------------------------------------------------

export function buildPersonalityOverviewPrompt(
  items: Array<{
    questionId: string;
    questionCode: string;
    questionText: string;
    studentAnswer: string;
    resolved: ResolvedQuestionInfo;
  }>
): string {
  let prompt = `You are an expert behavioural and organizational psychology examiner performing an evidence-based candidate work-style overview for the EllipHire Aptitude Screening Portal.

STRICT EVALUATION PRINCIPLES:
1. THIS IS NOT A PSYCHOLOGICAL OR DIAGNOSTIC EVALUATION. Do not label the candidate as lazy, arrogant, manipulative, or emotionally unstable. Do not assign psychological types (e.g. MBTI, Enneagram).
2. DO NOT GENERATE NUMERIC MARKS, TOTAL SCORES, RANKINGS, OR HIRING RECOMMENDATIONS.
3. DISTINGUISH ACTUAL PAST BEHAVIOUR FROM HYPOTHETICAL INTENTIONS:
   - For behavioural questions (P07–P12): Note whether the candidate provided concrete past evidence or described hypothetical intentions. Do not treat hypothetical intentions as demonstrated past competence.
   - For situational questions (P13–P18): Assess the candidate's reasoning, proposed actions, and consequence awareness.
   - For personal reflections (P19–P33): Summarize self-reported reflections without treating them as standalone proof of competence.
   - For personal interests (P01–P06): Summarize self-reported context only. STRICTLY PROHIBIT inferring workplace competence or personality traits from hobbies, books, films, characters, or preferences.
4. IDENTIFY INSUFFICIENT EVIDENCE: If an answer is generic (e.g. "I work hard"), mark it as INSUFFICIENT or LIMITED evidence. Do not manufacture virtues or assume weaknesses from brevity.
5. REFERENCE QUESTION CODES: Support every significant observation by citing the relevant question code (e.g., [P08], [P14]).
6. FORMULATE FOLLOW-UP QUESTIONS: Provide concrete, actionable interview questions for human interviewers to probe in subsequent rounds.

SUBMITTED CANDIDATE RESPONSES FOR REVIEW:\n\n`;

  for (const item of items) {
    prompt += `--------------------------------------------------\n`;
    prompt += `QUESTION CODE: ${item.questionCode} [Mapped: ${item.resolved.isMapped ? 'YES' : 'NO - UNMAPPED'}]\n`;
    if (item.resolved.config) {
      prompt += `BAND: ${item.resolved.config.section}\n`;
      prompt += `EXPECTED NATURE: ${item.resolved.config.responseNature}\n`;
    }
    prompt += `QUESTION PROMPT: ${item.questionText}\n`;
    prompt += `CANDIDATE ANSWER:\n${item.studentAnswer.trim() || '[BLANK - NO ANSWER PROVIDED]'}\n\n`;
  }

  prompt += `--------------------------------------------------
REQUIRED JSON OUTPUT SCHEMA:
Return a valid JSON object matching this exact schema:
{
  "candidateOverview": "Executive summary (3-5 sentences) summarizing observed work-style evidence, communication habits, and problem-solving reasoning.",
  "selfReportedInterests": {
    "summary": "Summary of interests and creative outlets reported in P01-P06.",
    "details": ["Interest 1", "Interest 2"],
    "disclaimer": "Self-reported context only; not indicative of workplace competence or performance."
  },
  "demonstratedStrengths": [
    {
      "statement": "Specific evidence-backed strength observation",
      "referencedQuestions": ["P08", "P14"]
    }
  ],
  "potentialDevelopmentAreas": [
    {
      "statement": "Observed limitation, lack of past evidence, or area needing growth",
      "referencedQuestions": ["P07"]
    }
  ],
  "dimensionObservations": {
    "OWNERSHIP_AND_INITIATIVE": {
      "qualitativeLevel": "LIMITED_EVIDENCE | DEVELOPING | STRONG | PARTICULARLY_STRONG | INSUFFICIENT_EVIDENCE",
      "evidenceStatus": "SUFFICIENT | LIMITED | INSUFFICIENT",
      "summary": "Specific observation on ownership and follow-through",
      "supportingObservations": ["Point 1", "Point 2"],
      "referencedQuestionCodes": ["P07"]
    },
    "COLLABORATION": {
      "qualitativeLevel": "...",
      "evidenceStatus": "...",
      "summary": "...",
      "supportingObservations": [],
      "referencedQuestionCodes": []
    },
    "COMMUNICATION": {
      "qualitativeLevel": "...",
      "evidenceStatus": "...",
      "summary": "...",
      "supportingObservations": [],
      "referencedQuestionCodes": []
    },
    "ADAPTABILITY": {
      "qualitativeLevel": "...",
      "evidenceStatus": "...",
      "summary": "...",
      "supportingObservations": [],
      "referencedQuestionCodes": []
    },
    "LEARNING_ORIENTATION": {
      "qualitativeLevel": "...",
      "evidenceStatus": "...",
      "summary": "...",
      "supportingObservations": [],
      "referencedQuestionCodes": []
    },
    "SELF_MANAGEMENT": {
      "qualitativeLevel": "...",
      "evidenceStatus": "...",
      "summary": "...",
      "supportingObservations": [],
      "referencedQuestionCodes": []
    },
    "JUDGMENT_AND_INTEGRITY": {
      "qualitativeLevel": "...",
      "evidenceStatus": "...",
      "summary": "...",
      "supportingObservations": [],
      "referencedQuestionCodes": []
    }
  },
  "insufficientEvidenceNotes": [
    "Note any generic or blank responses where evidence was insufficient"
  ],
  "recommendedFollowUpQuestions": [
    {
      "question": "Concrete question for interviewer",
      "context": "Why to ask this based on candidate's answer",
      "questionCodeRef": "P08"
    }
  ],
  "perQuestionNotes": [
    {
      "questionCode": "P01",
      "summary": "Brief observation",
      "evidenceStatus": "SUFFICIENT | LIMITED | INSUFFICIENT"
    }
  ]
}
`;

  return prompt;
}

// --------------------------------------------------
// 6. QUALITATIVE EVALUATOR (OPENROUTER / LLM CALL)
// --------------------------------------------------

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const PRIMARY_MODEL = 'openai/gpt-oss-120b';
const FALLBACK_MODEL = 'google/gemini-3-flash-preview';
const DEFAULT_TIMEOUT_MS = 40000;

export async function evaluatePersonalityResponses(
  responses: Array<{
    questionId: string;
    questionText: string;
    optionsJson: any;
    studentAnswer: string;
  }>
): Promise<{
  success: boolean;
  overview: PersonalityOverviewPayload;
  questionObservations: Map<string, QuestionObservation>;
  modelUsed: string;
  error?: string;
}> {
  // 1. Resolve questions and extract P01–P33 identifiers
  const items = responses.map(r => {
    const resolved = resolvePersonalityQuestionCode({
      id: r.questionId,
      question_text: r.questionText,
      options_json: r.optionsJson
    });
    return {
      questionId: r.questionId,
      questionCode: resolved.code,
      questionText: r.questionText,
      studentAnswer: r.studentAnswer || '',
      resolved
    };
  });

  const unmappedCount = items.filter(i => !i.resolved.isMapped).length;

  // Check if candidate left all responses blank
  const hasAnyAnswer = items.some(i => i.studentAnswer.trim().length > 0);
  if (!hasAnyAnswer) {
    const emptyOverview: PersonalityOverviewPayload = {
      candidateOverview: 'No Personality responses were provided by the candidate. All questions were left blank.',
      selfReportedInterests: {
        summary: 'None provided.',
        details: [],
        disclaimer: 'Self-reported context only; not indicative of workplace competence.'
      },
      demonstratedStrengths: [],
      potentialDevelopmentAreas: [
        {
          statement: 'No responses were submitted for work-style and behavioural evaluation.',
          referencedQuestions: []
        }
      ],
      dimensionObservations: createEmptyDimensionObservations('INSUFFICIENT', 'No answer submitted.'),
      insufficientEvidenceNotes: ['Candidate submitted blank answers across all personality questions.'],
      recommendedFollowUpQuestions: [
        {
          question: 'Could you tell us about a challenging team project or a time you handled changing deadlines?',
          context: 'Candidate did not complete the written behavioural assessment.',
          questionCodeRef: 'P07'
        }
      ],
      unmappedQuestionsCount: unmappedCount,
      evaluatedAt: new Date().toISOString(),
      modelUsed: 'deterministic_blank'
    };

    const emptyMap = new Map<string, QuestionObservation>();
    for (const item of items) {
      emptyMap.set(item.questionId, {
        questionId: item.questionId,
        questionCode: item.questionCode,
        questionText: item.questionText,
        studentAnswer: '',
        band: (item.resolved.config?.section as any) || 'UNMAPPED',
        evidenceNature: item.resolved.config?.responseNature || 'UNSPECIFIED',
        evidenceStatus: 'INSUFFICIENT',
        summary: 'No answer provided.',
        keyObservations: ['Answer was left blank.'],
        concreteFollowUpQuestions: [],
        isMapped: item.resolved.isMapped
      });
    }

    return {
      success: true,
      overview: emptyOverview,
      questionObservations: emptyMap,
      modelUsed: 'deterministic_blank'
    };
  }

  // 2. Call OpenRouter
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.GROQ_API_KEY;
  if (!apiKey) {
    const fallbackOverview = createFallbackOverview(items, 'API key is not configured on the server.', unmappedCount);
    return {
      success: false,
      overview: fallbackOverview.overview,
      questionObservations: fallbackOverview.questionObservations,
      modelUsed: 'none',
      error: 'OPENROUTER_API_KEY is not configured on the server.'
    };
  }

  const prompt = buildPersonalityOverviewPrompt(items);
  const models = [PRIMARY_MODEL, FALLBACK_MODEL];
  let modelUsed = PRIMARY_MODEL;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

      const response = await fetch(OPENROUTER_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://elliphire.com',
          'X-Title': 'EllipHire Assessment Platform - Personality Overview',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          models: models,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens: 2500,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (attempt < 2) continue;
        throw new Error(`OpenRouter returned HTTP ${response.status}`);
      }

      const data = await response.json();
      const textContent = data.choices?.[0]?.message?.content || '';
      modelUsed = data.model || PRIMARY_MODEL;

      if (!textContent) {
        throw new Error('Empty response from model');
      }

      const parsed = parsePersonalityJson(textContent, items, modelUsed, unmappedCount);
      return {
        success: true,
        overview: parsed.overview,
        questionObservations: parsed.questionObservations,
        modelUsed
      };
    } catch (err: any) {
      if (attempt === 2) {
        console.warn(`[Personality Evaluator Error] Failed after 2 attempts: ${err.message}`);
        const fallback = createFallbackOverview(items, err.message, unmappedCount);
        return {
          success: false,
          overview: fallback.overview,
          questionObservations: fallback.questionObservations,
          modelUsed: 'fallback',
          error: err.message
        };
      }
    }
  }

  const fallback = createFallbackOverview(items, 'Unexpected evaluation termination', unmappedCount);
  return {
    success: false,
    overview: fallback.overview,
    questionObservations: fallback.questionObservations,
    modelUsed: 'fallback',
    error: 'Evaluation error'
  };
}

function parsePersonalityJson(
  rawText: string,
  items: Array<{
    questionId: string;
    questionCode: string;
    questionText: string;
    studentAnswer: string;
    resolved: ResolvedQuestionInfo;
  }>,
  modelUsed: string,
  unmappedCount: number
): {
  overview: PersonalityOverviewPayload;
  questionObservations: Map<string, QuestionObservation>;
} {
  const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
  const obj = JSON.parse(cleaned);

  const dimensionObservations: Record<WorkStyleDimensionId, DimensionObservation> = {} as any;
  for (const [dimKey, dimMeta] of Object.entries(WORKSTYLE_DIMENSIONS)) {
    const rawDim = obj.dimensionObservations?.[dimKey] || {};
    dimensionObservations[dimKey as WorkStyleDimensionId] = {
      dimensionId: dimKey as WorkStyleDimensionId,
      dimensionName: dimMeta.name,
      qualitativeLevel: rawDim.qualitativeLevel || 'DEVELOPING',
      evidenceStatus: rawDim.evidenceStatus || 'LIMITED',
      summary: rawDim.summary || 'Evidence evaluated from responses.',
      supportingObservations: Array.isArray(rawDim.supportingObservations) ? rawDim.supportingObservations : [],
      referencedQuestionCodes: Array.isArray(rawDim.referencedQuestionCodes) ? rawDim.referencedQuestionCodes : []
    };
  }

  const overview: PersonalityOverviewPayload = {
    candidateOverview: String(obj.candidateOverview || 'Qualitative candidate work-style overview.'),
    selfReportedInterests: {
      summary: String(obj.selfReportedInterests?.summary || 'Self-reported interests.'),
      details: Array.isArray(obj.selfReportedInterests?.details) ? obj.selfReportedInterests.details : [],
      disclaimer: 'Self-reported context only; not indicative of workplace competence.'
    },
    demonstratedStrengths: Array.isArray(obj.demonstratedStrengths) ? obj.demonstratedStrengths : [],
    potentialDevelopmentAreas: Array.isArray(obj.potentialDevelopmentAreas) ? obj.potentialDevelopmentAreas : [],
    dimensionObservations,
    insufficientEvidenceNotes: Array.isArray(obj.insufficientEvidenceNotes) ? obj.insufficientEvidenceNotes : [],
    recommendedFollowUpQuestions: Array.isArray(obj.recommendedFollowUpQuestions) ? obj.recommendedFollowUpQuestions : [],
    unmappedQuestionsCount: unmappedCount,
    evaluatedAt: new Date().toISOString(),
    modelUsed
  };

  const perQuestionNotesMap = new Map<string, any>();
  if (Array.isArray(obj.perQuestionNotes)) {
    for (const note of obj.perQuestionNotes) {
      if (note && note.questionCode) {
        perQuestionNotesMap.set(note.questionCode, note);
      }
    }
  }

  const questionObservations = new Map<string, QuestionObservation>();
  for (const item of items) {
    const note = perQuestionNotesMap.get(item.questionCode);
    questionObservations.set(item.questionId, {
      questionId: item.questionId,
      questionCode: item.questionCode,
      questionText: item.questionText,
      studentAnswer: item.studentAnswer,
      band: (item.resolved.config?.section as any) || 'UNMAPPED',
      evidenceNature: item.resolved.config?.responseNature || 'UNSPECIFIED',
      evidenceStatus: note?.evidenceStatus || (item.studentAnswer.trim() ? 'SUFFICIENT' : 'INSUFFICIENT'),
      summary: note?.summary || (item.studentAnswer.trim() ? 'Response recorded for review.' : 'No response provided.'),
      keyObservations: Array.isArray(note?.keyObservations) ? note.keyObservations : [],
      concreteFollowUpQuestions: [],
      isMapped: item.resolved.isMapped
    });
  }

  return { overview, questionObservations };
}

function createEmptyDimensionObservations(status: EvidenceStatus, message: string): Record<WorkStyleDimensionId, DimensionObservation> {
  const result: any = {};
  for (const [key, dim] of Object.entries(WORKSTYLE_DIMENSIONS)) {
    result[key] = {
      dimensionId: key as WorkStyleDimensionId,
      dimensionName: dim.name,
      qualitativeLevel: 'INSUFFICIENT_EVIDENCE',
      evidenceStatus: status,
      summary: message,
      supportingObservations: [],
      referencedQuestionCodes: []
    };
  }
  return result;
}

function createFallbackOverview(
  items: Array<{
    questionId: string;
    questionCode: string;
    questionText: string;
    studentAnswer: string;
    resolved: ResolvedQuestionInfo;
  }>,
  reason: string,
  unmappedCount: number
): {
  overview: PersonalityOverviewPayload;
  questionObservations: Map<string, QuestionObservation>;
} {
  const defaultFollowUps = items
    .filter(i => i.resolved.isMapped && i.studentAnswer.trim())
    .slice(0, 3)
    .map(i => ({
      question: `Can you walk through a concrete example related to [${i.questionCode}] and explain the reasoning behind your decisions?`,
      context: `Probe for detailed behavioural follow-up on candidate's response to ${i.questionCode}.`,
      questionCodeRef: i.questionCode
    }));

  const overview: PersonalityOverviewPayload = {
    candidateOverview: `Automated qualitative evaluation could not complete (${reason}). Candidate responses are preserved below for human review.`,
    selfReportedInterests: {
      summary: 'Review individual answers below.',
      details: [],
      disclaimer: 'Self-reported context only; not indicative of workplace competence.'
    },
    demonstratedStrengths: [],
    potentialDevelopmentAreas: [],
    dimensionObservations: createEmptyDimensionObservations('LIMITED', 'Awaiting administrator manual review.'),
    insufficientEvidenceNotes: [`Evaluation incomplete: ${reason}`],
    recommendedFollowUpQuestions: defaultFollowUps,
    unmappedQuestionsCount: unmappedCount,
    evaluatedAt: new Date().toISOString(),
    modelUsed: 'fallback'
  };

  const questionObservations = new Map<string, QuestionObservation>();
  for (const item of items) {
    questionObservations.set(item.questionId, {
      questionId: item.questionId,
      questionCode: item.questionCode,
      questionText: item.questionText,
      studentAnswer: item.studentAnswer,
      band: (item.resolved.config?.section as any) || 'UNMAPPED',
      evidenceNature: item.resolved.config?.responseNature || 'UNSPECIFIED',
      evidenceStatus: item.studentAnswer.trim() ? 'LIMITED' : 'INSUFFICIENT',
      summary: item.studentAnswer.trim() ? 'Response available for manual interviewer review.' : 'No response provided.',
      keyObservations: [],
      concreteFollowUpQuestions: [],
      isMapped: item.resolved.isMapped
    });
  }

  return { overview, questionObservations };
}
