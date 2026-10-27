/**
 * lib/categories.ts
 * 
 * Centralized Category Registry for EllipHire Aptitude Screening Portal.
 * 
 * Single source of truth for:
 * 1. Stable Canonical Internal IDs (preserved across database columns & APIs).
 * 2. Exact Display Names (as mandated by rebranding specifications).
 * 3. Robust alias mapping & normalization (handling ampersands, whitespace, legacy labels, abbreviations).
 * 4. Assessment section ordering and scoring classification (Eligibility is unscored).
 */

export type CanonicalCategoryId =
  | 'APTITUDE'
  | 'CODING'
  | 'ELIGIBILITY'
  | 'ATTITUDE_AND_OWNERSHIP'
  | 'LEARNING_APTITUDE'
  | 'PROBLEM_SOLVING'
  | 'EXECUTION_AND_RELIABILITY'
  | 'COMMUNICATION_AND_TEAMWORK'
  | 'INTEGRITY'
  | 'AI_LITERACY'
  | 'PERSONALITY';

export interface CategoryMetadata {
  id: CanonicalCategoryId;
  label: string;
  legacyLabel: string;
  isScored: boolean;
  description: string;
}

export const CATEGORIES: Record<CanonicalCategoryId, CategoryMetadata> = {
  APTITUDE: {
    id: 'APTITUDE',
    label: 'Quantitative & Logical Reasoning',
    legacyLabel: 'Aptitude',
    isScored: true,
    description: 'Quantitative Ability, Logical Reasoning, and Numerical Proficiency.',
  },
  CODING: {
    id: 'CODING',
    label: 'Coding & Debugging',
    legacyLabel: 'Coding',
    isScored: true,
    description: 'Programming challenges, algorithm implementation, and debugging.',
  },
  ELIGIBILITY: {
    id: 'ELIGIBILITY',
    label: 'Eligibility & Logistics (Unscored)',
    legacyLabel: 'Eligibility',
    isScored: false,
    description: 'Screening questions to determine candidate eligibility and logistics.',
  },
  ATTITUDE_AND_OWNERSHIP: {
    id: 'ATTITUDE_AND_OWNERSHIP',
    label: 'Ownership & Initiative',
    legacyLabel: 'Attitude & Ownership',
    isScored: true,
    description: 'Evaluate candidate ownership, accountability, and initiative.',
  },
  LEARNING_APTITUDE: {
    id: 'LEARNING_APTITUDE',
    label: 'Learning Agility',
    legacyLabel: 'Learning Aptitude',
    isScored: true,
    description: 'Assess adaptability, comprehension speed, and learning agility.',
  },
  PROBLEM_SOLVING: {
    id: 'PROBLEM_SOLVING',
    label: 'Problem Solving & System Design',
    legacyLabel: 'Problem Solving',
    isScored: true,
    description: 'Structured problem analysis, architecture, and system logic.',
  },
  EXECUTION_AND_RELIABILITY: {
    id: 'EXECUTION_AND_RELIABILITY',
    label: 'Delivery & Dependability',
    legacyLabel: 'Execution & Reliability',
    isScored: true,
    description: 'Task execution, delivery planning, dependability, and follow-through.',
  },
  COMMUNICATION_AND_TEAMWORK: {
    id: 'COMMUNICATION_AND_TEAMWORK',
    label: 'Written Communication & Collaboration',
    legacyLabel: 'Communication & Teamwork',
    isScored: true,
    description: 'Written professional communication, empathy, and team collaboration.',
  },
  INTEGRITY: {
    id: 'INTEGRITY',
    label: 'Ethics & Judgment',
    legacyLabel: 'Integrity',
    isScored: true,
    description: 'Professional ethics, sound judgment, honesty, and values alignment.',
  },
  AI_LITERACY: {
    id: 'AI_LITERACY',
    label: 'AI Literacy & Responsible Use',
    legacyLabel: 'AI Literacy',
    isScored: true,
    description: 'AI tooling proficiency, prompt engineering, and responsible use.',
  },
  PERSONALITY: {
    id: 'PERSONALITY',
    label: 'Personality',
    legacyLabel: 'Personality',
    isScored: false,
    description: 'Open-text personality assessment questions.',
  },
};

/**
 * Ordered sequence for assessment flow, report displays, and test generation.
 */
export const CATEGORY_ORDER: CanonicalCategoryId[] = [
  'ELIGIBILITY',
  'APTITUDE',
  'CODING',
  'ATTITUDE_AND_OWNERSHIP',
  'LEARNING_APTITUDE',
  'PROBLEM_SOLVING',
  'EXECUTION_AND_RELIABILITY',
  'COMMUNICATION_AND_TEAMWORK',
  'INTEGRITY',
  'AI_LITERACY',
  'PERSONALITY',
];

export const CATEGORIES_LIST: CategoryMetadata[] = CATEGORY_ORDER.map(
  (id) => CATEGORIES[id]
);

/**
 * Normalization helper: strips whitespace, punctuation, replaces '&' with 'and',
 * and converts to lower case for comparison.
 */
function normalizeKey(str: string): string {
  return str
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Static dictionary of known aliases mapped to their CanonicalCategoryId.
 */
const ALIAS_MAP: Record<string, CanonicalCategoryId> = {
  // Canonical ID strings
  [normalizeKey('APTITUDE')]: 'APTITUDE',
  [normalizeKey('CODING')]: 'CODING',
  [normalizeKey('ELIGIBILITY')]: 'ELIGIBILITY',
  [normalizeKey('ATTITUDE_AND_OWNERSHIP')]: 'ATTITUDE_AND_OWNERSHIP',
  [normalizeKey('LEARNING_APTITUDE')]: 'LEARNING_APTITUDE',
  [normalizeKey('PROBLEM_SOLVING')]: 'PROBLEM_SOLVING',
  [normalizeKey('EXECUTION_AND_RELIABILITY')]: 'EXECUTION_AND_RELIABILITY',
  [normalizeKey('COMMUNICATION_AND_TEAMWORK')]: 'COMMUNICATION_AND_TEAMWORK',
  [normalizeKey('INTEGRITY')]: 'INTEGRITY',
  [normalizeKey('AI_LITERACY')]: 'AI_LITERACY',
  [normalizeKey('PERSONALITY')]: 'PERSONALITY',

  // Exact New Display Names
  [normalizeKey('Quantitative & Logical Reasoning')]: 'APTITUDE',
  [normalizeKey('Coding & Debugging')]: 'CODING',
  [normalizeKey('Eligibility & Logistics (Unscored)')]: 'ELIGIBILITY',
  [normalizeKey('Eligibility & Logistics')]: 'ELIGIBILITY',
  [normalizeKey('Ownership & Initiative')]: 'ATTITUDE_AND_OWNERSHIP',
  [normalizeKey('Learning Agility')]: 'LEARNING_APTITUDE',
  [normalizeKey('Problem Solving & System Design')]: 'PROBLEM_SOLVING',
  [normalizeKey('Delivery & Dependability')]: 'EXECUTION_AND_RELIABILITY',
  [normalizeKey('Written Communication & Collaboration')]: 'COMMUNICATION_AND_TEAMWORK',
  [normalizeKey('Ethics & Judgment')]: 'INTEGRITY',
  [normalizeKey('Ethics & Judgement')]: 'INTEGRITY',
  [normalizeKey('AI Literacy & Responsible Use')]: 'AI_LITERACY',
  [normalizeKey('Personality')]: 'PERSONALITY',
  [normalizeKey('Personality Assessment')]: 'PERSONALITY',

  // Legacy Display Names
  [normalizeKey('Aptitude')]: 'APTITUDE',
  [normalizeKey('Coding')]: 'CODING',
  [normalizeKey('Eligibility')]: 'ELIGIBILITY',
  [normalizeKey('Attitude & Ownership')]: 'ATTITUDE_AND_OWNERSHIP',
  [normalizeKey('Learning Aptitude')]: 'LEARNING_APTITUDE',
  [normalizeKey('Problem Solving')]: 'PROBLEM_SOLVING',
  [normalizeKey('Execution & Reliability')]: 'EXECUTION_AND_RELIABILITY',
  [normalizeKey('Communication & Teamwork')]: 'COMMUNICATION_AND_TEAMWORK',
  [normalizeKey('Integrity')]: 'INTEGRITY',
  [normalizeKey('AI Literacy')]: 'AI_LITERACY',

  // Legacy Abbreviations / Shortened Formats
  [normalizeKey('ATTITUDE')]: 'ATTITUDE_AND_OWNERSHIP',
  [normalizeKey('Attitude')]: 'ATTITUDE_AND_OWNERSHIP',
  [normalizeKey('OWNERSHIP')]: 'ATTITUDE_AND_OWNERSHIP',
  [normalizeKey('Ownership')]: 'ATTITUDE_AND_OWNERSHIP',
  [normalizeKey('INITIATIVE')]: 'ATTITUDE_AND_OWNERSHIP',
  [normalizeKey('Initiative')]: 'ATTITUDE_AND_OWNERSHIP',
  [normalizeKey('LEARNING')]: 'LEARNING_APTITUDE',
  [normalizeKey('Learning')]: 'LEARNING_APTITUDE',
  [normalizeKey('AGILITY')]: 'LEARNING_APTITUDE',
  [normalizeKey('Agility')]: 'LEARNING_APTITUDE',
  [normalizeKey('EXECUTION')]: 'EXECUTION_AND_RELIABILITY',
  [normalizeKey('Execution')]: 'EXECUTION_AND_RELIABILITY',
  [normalizeKey('RELIABILITY')]: 'EXECUTION_AND_RELIABILITY',
  [normalizeKey('Reliability')]: 'EXECUTION_AND_RELIABILITY',
  [normalizeKey('DELIVERY')]: 'EXECUTION_AND_RELIABILITY',
  [normalizeKey('Delivery')]: 'EXECUTION_AND_RELIABILITY',
  [normalizeKey('DEPENDABILITY')]: 'EXECUTION_AND_RELIABILITY',
  [normalizeKey('Dependability')]: 'EXECUTION_AND_RELIABILITY',
  [normalizeKey('COMMUNICATION')]: 'COMMUNICATION_AND_TEAMWORK',
  [normalizeKey('Communication')]: 'COMMUNICATION_AND_TEAMWORK',
  [normalizeKey('TEAMWORK')]: 'COMMUNICATION_AND_TEAMWORK',
  [normalizeKey('Teamwork')]: 'COMMUNICATION_AND_TEAMWORK',
  [normalizeKey('COLLABORATION')]: 'COMMUNICATION_AND_TEAMWORK',
  [normalizeKey('Collaboration')]: 'COMMUNICATION_AND_TEAMWORK',
  [normalizeKey('ETHICS')]: 'INTEGRITY',
  [normalizeKey('Ethics')]: 'INTEGRITY',
  [normalizeKey('JUDGMENT')]: 'INTEGRITY',
  [normalizeKey('Judgment')]: 'INTEGRITY',
  [normalizeKey('AI')]: 'AI_LITERACY',
};

/**
 * Resolves any category input (canonical ID, new display label, legacy label,
 * alias, or variation with & or and) to its CanonicalCategoryId.
 * 
 * Returns null if the category is invalid or unknown.
 * NEVER silently reclassifies unknown categories.
 */
export function canonicalizeCategory(input: unknown): CanonicalCategoryId | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1. Direct exact canonical ID match
  if (trimmed in CATEGORIES) {
    return trimmed as CanonicalCategoryId;
  }

  // 2. Uppercase canonical match
  const upper = trimmed.toUpperCase();
  if (upper in CATEGORIES) {
    return upper as CanonicalCategoryId;
  }

  // 3. Normalized alias lookup
  const norm = normalizeKey(trimmed);
  return ALIAS_MAP[norm] || null;
}

/**
 * Returns the exact new display label for a category.
 * If input is invalid or unknown, returns fallback or original string.
 */
export function getCategoryLabel(input: unknown, fallback?: string): string {
  const canonical = canonicalizeCategory(input);
  if (canonical && CATEGORIES[canonical]) {
    return CATEGORIES[canonical].label;
  }
  return fallback !== undefined ? fallback : String(input || 'General');
}

/**
 * Checks whether a category represents Eligibility (which is unscored).
 */
export function isEligibilityCategory(input: unknown): boolean {
  return canonicalizeCategory(input) === 'ELIGIBILITY';
}

/**
 * Checks whether a category represents Personality (which is completely unevaluated and unscored).
 */
export function isPersonalityCategory(input: unknown): boolean {
  return canonicalizeCategory(input) === 'PERSONALITY';
}

/**
 * Validates whether an input resolves to a recognized category.
 */
export function isValidCategory(input: unknown): boolean {
  return canonicalizeCategory(input) !== null;
}

/**
 * Array of all supported display names for UI dropdowns and error messages.
 */
export const SUPPORTED_DISPLAY_LABELS = CATEGORY_ORDER.map(
  (id) => CATEGORIES[id].label
);

/**
 * Complete list of supported names (both new and legacy) for spreadsheet import validation.
 */
export const SUPPORTED_IMPORT_SECTIONS = [
  ...CATEGORY_ORDER.map((id) => CATEGORIES[id].label),
  ...CATEGORY_ORDER.map((id) => CATEGORIES[id].legacyLabel),
  ...CATEGORY_ORDER,
];
