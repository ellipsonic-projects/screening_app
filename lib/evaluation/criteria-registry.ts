import { CanonicalCategoryId } from '@/lib/categories';

export interface PredefinedCriterion {
  id: string;
  name: string;
  weight: number; // Decimal proportion between 0 and 1, sum of weights = 1.0
  description: string;
}

export interface AllocatedCriterion extends PredefinedCriterion {
  maxScore: number;
}

/**
 * Predefined, category-specific evaluation criteria.
 * Built directly into the engine — requires zero recruiter or admin rubric configuration.
 */
export const CATEGORY_CRITERIA_REGISTRY: Record<CanonicalCategoryId, PredefinedCriterion[]> = {
  CODING: [
    {
      id: 'program_logic_correctness',
      name: 'Program Logic & Likely Correctness',
      weight: 0.40,
      description: 'Assesses whether the algorithmic logic, syntax, boundary handling, and requirements appear sound based on static code inspection (without live test execution verification).'
    },
    {
      id: 'algorithmic_complexity',
      name: 'Algorithmic Efficiency & Complexity',
      weight: 0.30,
      description: 'Assesses time complexity, space complexity, data structure choice, and scalability of the implementation.'
    },
    {
      id: 'code_quality_best_practices',
      name: 'Code Quality, Maintainability & Standards',
      weight: 0.30,
      description: 'Assesses code readability, naming conventions, modularity, cleanliness, and adherence to programming language best practices.'
    }
  ],

  ATTITUDE_AND_OWNERSHIP: [
    {
      id: 'accountability_follow_through',
      name: 'Accountability & Follow-Through',
      weight: 0.35,
      description: 'Evaluates personal responsibility for outcomes, admitting mistakes, proactive ownership, and complete follow-through without deflection.'
    },
    {
      id: 'initiative_proactivity',
      name: 'Proactivity & Initiative',
      weight: 0.35,
      description: 'Evaluates anticipating risks, proposing constructive improvements, self-direction, and going beyond minimum baseline requirements.'
    },
    {
      id: 'prioritization_escalation',
      name: 'Prioritization & Escalation Judgment',
      weight: 0.30,
      description: 'Evaluates sound prioritization under constraints and discerning when to resolve autonomously versus when to escalate through appropriate channels.'
    }
  ],

  LEARNING_APTITUDE: [
    {
      id: 'learning_strategy_adaptation',
      name: 'Learning Strategy & Adaptability',
      weight: 0.35,
      description: 'Evaluates approach to absorbing novel frameworks, concepts, or changing constraints, demonstrating intellectual curiosity and mental flexibility.'
    },
    {
      id: 'hypothesis_experimentation',
      name: 'Hypothesis Formulation & Experimentation',
      weight: 0.35,
      description: 'Evaluates structuring assumptions, testing unknown variables, gathering feedback, and evidence-based verification.'
    },
    {
      id: 'reflection_synthesis',
      name: 'Synthesis & Knowledge Application',
      weight: 0.30,
      description: 'Evaluates extracting lessons learned from past mistakes or challenges and applying newly acquired knowledge to solve unfamiliar problems.'
    }
  ],

  PROBLEM_SOLVING: [
    {
      id: 'problem_framing_reasoning',
      name: 'Problem Framing & Analytical Reasoning',
      weight: 0.35,
      description: 'Evaluates dissecting complex or ambiguous requirements, identifying root causes, establishing constraints, and clear problem definition.'
    },
    {
      id: 'solution_architecture_tradeoffs',
      name: 'Architecture, Design & Trade-Off Analysis',
      weight: 0.35,
      description: 'Evaluates technical soundness, structural design, modularity, and evaluating trade-offs (e.g. latency vs consistency, simplicity vs extensibility).'
    },
    {
      id: 'reliability_failure_resilience',
      name: 'Reliability, Edge Cases & Failure Scenarios',
      weight: 0.30,
      description: 'Evaluates designing for fault tolerance, edge cases, scalability, data integrity, failure recovery, and verification strategies.'
    }
  ],

  EXECUTION_AND_RELIABILITY: [
    {
      id: 'planning_milestone_prioritization',
      name: 'Planning & Milestone Delivery',
      weight: 0.35,
      description: 'Evaluates deconstructing goals into actionable milestones, realistic sequencing, and maintaining relentless focus on delivery commitments.'
    },
    {
      id: 'risk_mitigation_recovery',
      name: 'Risk Management & Failure Recovery',
      weight: 0.35,
      description: 'Evaluates anticipating delivery bottlenecks, proactive contingency planning, resilient recovery when timelines slip, and follow-through.'
    },
    {
      id: 'verification_accountability',
      name: 'Verification, Quality & Dependability',
      weight: 0.30,
      description: 'Evaluates thorough verification of completed deliverables, stakeholder transparency, and consistent dependable performance under pressure.'
    }
  ],

  COMMUNICATION_AND_TEAMWORK: [
    {
      id: 'clarity_organization',
      name: 'Clarity, Organization & Conciseness',
      weight: 0.35,
      description: 'Evaluates structured messaging, logical flow, crisp professional expression, and relevance without unnecessary filler.'
    },
    {
      id: 'audience_awareness_tone',
      name: 'Audience Awareness & Professional Tone',
      weight: 0.35,
      description: 'Evaluates calibrating depth and vocabulary to the target audience, exhibiting empathy, and maintaining a constructive, professional tone.'
    },
    {
      id: 'constructive_collaboration',
      name: 'Collaboration & Alignment',
      weight: 0.30,
      description: 'Evaluates facilitating consensus, delivering constructive feedback, acknowledging differing perspectives, and de-escalating tension.'
    }
  ],

  INTEGRITY: [
    {
      id: 'risk_recognition',
      name: 'Ethical, Privacy & Security Risk Recognition',
      weight: 0.35,
      description: 'Evaluates identifying vulnerabilities, ethical dilemmas, regulatory/privacy implications, policy breaches, and potential conflicts of interest.'
    },
    {
      id: 'decision_integrity_soundness',
      name: 'Soundness of Judgment & Values Alignment',
      weight: 0.35,
      description: 'Evaluates principled decision-making under organizational or peer pressure, upholding integrity, and adherence to professional standards.'
    },
    {
      id: 'accountability_harm_prevention',
      name: 'Harm Prevention & Responsible Escalation',
      weight: 0.30,
      description: 'Evaluates actionable steps to protect stakeholders, responsible escalation through proper channels, and prioritizing long-term trust.'
    }
  ],

  AI_LITERACY: [
    {
      id: 'tool_selection_task_framing',
      name: 'Tool Selection & Prompt Strategy',
      weight: 0.35,
      description: 'Evaluates selecting appropriate AI models or tools for the task, structuring clear and effective prompts, and defining expected outputs.'
    },
    {
      id: 'verification_hallucination_awareness',
      name: 'Output Verification & Critical Thinking',
      weight: 0.35,
      description: 'Evaluates validating AI outputs rigorously, detecting hallucinations, biases, or subtle inaccuracies, and understanding model limitations.'
    },
    {
      id: 'privacy_security_accountability',
      name: 'Security, Ethics & Human Accountability',
      weight: 0.30,
      description: 'Evaluates preventing sensitive data leaks, respecting privacy/IP constraints, and retaining human responsibility for final deliverables.'
    }
  ],

  APTITUDE: [
    {
      id: 'logical_mathematical_reasoning',
      name: 'Logical & Mathematical Reasoning',
      weight: 0.40,
      description: 'Evaluates step-by-step analytical reasoning, deductive logic, and mathematical accuracy.'
    },
    {
      id: 'completeness_structure',
      name: 'Completeness of Solution',
      weight: 0.30,
      description: 'Evaluates addressing all parts of the question, establishing proper premises, and arriving at the correct deduction.'
    },
    {
      id: 'clarity_precision',
      name: 'Clarity & Precision',
      weight: 0.30,
      description: 'Evaluates concise, structured explanation of the derived answer without ambiguity.'
    }
  ],

  ELIGIBILITY: [], // Unscored category: never evaluated via subjective AI
  PERSONALITY: [] // Personality category: evaluation criteria completely disabled pending explicit approval
};

/**
 * Specialized question-type criteria overrides (e.g. code_review).
 */
export const SPECIALIZED_TYPE_CRITERIA: Record<string, PredefinedCriterion[]> = {
  code_review: [
    {
      id: 'bug_identification',
      name: 'Bug & Vulnerability Identification',
      weight: 0.40,
      description: 'Evaluates detecting logical bugs, security flaws, performance bottlenecks, or edge-case oversights in the provided code snippet.'
    },
    {
      id: 'fix_correctness_quality',
      name: 'Correctness & Quality of Fix',
      weight: 0.35,
      description: 'Evaluates the idiomatic correctness, efficiency, and safety of the proposed fix or remediation strategy.'
    },
    {
      id: 'explanation_clarity',
      name: 'Review Clarity & Constructive Guidance',
      weight: 0.25,
      description: 'Evaluates clear explanation of bug severity, impact, and constructive, professional feedback.'
    }
  ]
};

/**
 * Retrieves the appropriate predefined criteria for a given category and question type.
 */
export function getCriteriaForQuestion(
  category: CanonicalCategoryId | null,
  questionType: string
): PredefinedCriterion[] | null {
  const normType = (questionType || '').trim().toLowerCase();

  // 1. Check specialized question-type criteria overrides
  if (SPECIALIZED_TYPE_CRITERIA[normType]) {
    return SPECIALIZED_TYPE_CRITERIA[normType];
  }

  // 2. If category is unrecognized or missing, return null
  if (!category || !CATEGORY_CRITERIA_REGISTRY[category]) {
    return null;
  }

  // 3. Category criteria
  const criteria = CATEGORY_CRITERIA_REGISTRY[category];
  return criteria.length > 0 ? criteria : null;
}

/**
 * Deterministically distributes a question's maximum marks across its applicable criteria.
 * Mathematically guarantees that:
 * 1. Every criterion receives a clean, non-zero maximum mark (maxScore > 0).
 * 2. The sum of all criterion maxScores strictly equals totalMarks.
 */
export function allocateCriterionMarks(
  criteria: PredefinedCriterion[],
  totalMarks: number
): AllocatedCriterion[] {
  if (!criteria || criteria.length === 0) return [];
  if (totalMarks <= 0) {
    return criteria.map(c => ({ ...c, maxScore: 0 }));
  }

  const K = criteria.length;
  // Step granularity: 0.5 for questions >= 5 marks, 0.1 for smaller marks
  const step = totalMarks >= 5 ? 0.5 : 0.1;
  const roundToStep = (val: number) => Math.round(val / step) * step;

  let allocatedSum = 0;
  const result: AllocatedCriterion[] = [];

  for (let i = 0; i < K - 1; i++) {
    const rawVal = totalMarks * criteria[i].weight;
    let rounded = roundToStep(rawVal);
    if (rounded <= 0) rounded = step;
    if (allocatedSum + rounded >= totalMarks) {
      rounded = Math.max(step, totalMarks - allocatedSum - (K - 1 - i) * step);
    }
    rounded = Math.round(rounded * 10) / 10;
    allocatedSum = Math.round((allocatedSum + rounded) * 10) / 10;
    result.push({ ...criteria[i], maxScore: rounded });
  }

  // Last criterion receives the exact remainder to ensure strict sum parity
  let lastScore = Math.round((totalMarks - allocatedSum) * 10) / 10;
  if (lastScore <= 0 && result.length > 0) {
    const highestIdx = result.reduce(
      (maxI, curr, idx, arr) => curr.maxScore > arr[maxI].maxScore ? idx : maxI,
      0
    );
    result[highestIdx].maxScore = Math.round((result[highestIdx].maxScore - step) * 10) / 10;
    lastScore = step;
  }
  result.push({ ...criteria[K - 1], maxScore: lastScore });

  return result;
}
