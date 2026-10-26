import prisma from '@/lib/prisma';
import { 
  CATEGORIES, 
  CATEGORY_ORDER, 
  canonicalizeCategory, 
  isEligibilityCategory, 
  getCategoryLabel 
} from '@/lib/categories';

export interface ShortlistConfig {
  shortlistSize: number;
  overallCutoffEnabled: boolean;
  overallCutoffPercentage: number;
  sectionCutoffs: Record<string, number>;
  overallWeight: number;
  sectionWeight: number;
  categoryWeights: Record<string, number>;
}

export interface CandidateCategoryScore {
  category: string;
  categoryLabel: string;
  earnedMarks: number;
  maxMarks: number;
  percentage: number;
  configuredWeight: number;
  normalizedWeight: number;
  meetsCutoff: boolean;
  requiredCutoff: number | null;
}

export type CandidateShortlistStatus =
  | 'shortlisted'
  | 'not_shortlisted'
  | 'disqualified'
  | 'pending_review';

export interface RankedCandidate {
  studentId: string;
  fullName: string;
  usn: string;
  email: string;
  branch: string;
  testId: string;
  testTitle: string;
  round: number;
  templateId: string | null;
  attemptStatus: string;
  isAttemptEligible: boolean;
  timeTakenMinutes: number;
  violationsCount: number;
  submittedAt: string | null;

  // Marks & Percentages
  overallEarnedMarks: number;
  overallMaxMarks: number;
  overallPercentage: number;
  categoryScores: Record<string, CandidateCategoryScore>;
  weightedSectionPercentage: number;
  rankingScore: number;

  // Eligibility & Cutoff Results
  meetsAttemptEligibility: boolean;
  meetsOverallCutoff: boolean;
  meetsSectionCutoffs: boolean;
  isQualified: boolean;

  // Status & Rank
  shortlistStatus: CandidateShortlistStatus;
  rank: number | null;
  exclusionReasons: string[];
  needsReview: boolean;
  reviewReason: string | null;
}

export interface ShortlistCalculationResult {
  round: number;
  templateId: string | null;
  templateName: string | null;
  config: ShortlistConfig;
  calculatedAt: string;
  summary: {
    totalEvaluatedAttempts: number;
    totalUniqueCandidates: number;
    qualifiedCount: number;
    shortlistedCount: number;
    notShortlistedCount: number;
    disqualifiedCount: number;
    pendingReviewCount: number;
  };
  candidates: RankedCandidate[];
}

/**
 * Validates Shortlist Configuration server-side.
 * Throws a descriptive Error if any rule is violated.
 */
export function validateShortlistConfig(config: Partial<ShortlistConfig>): ShortlistConfig {
  const shortlistSize = Number(config.shortlistSize);
  if (!Number.isInteger(shortlistSize) || shortlistSize <= 0) {
    throw new Error('Shortlist size must be a positive integer greater than or equal to 1.');
  }

  const overallWeight = Number(config.overallWeight ?? 50);
  const sectionWeight = Number(config.sectionWeight ?? 50);

  if (isNaN(overallWeight) || overallWeight < 0 || overallWeight > 100) {
    throw new Error('Overall performance weight must be a number between 0 and 100.');
  }
  if (isNaN(sectionWeight) || sectionWeight < 0 || sectionWeight > 100) {
    throw new Error('Section performance weight must be a number between 0 and 100.');
  }

  const totalWeight = Math.round((overallWeight + sectionWeight) * 100) / 100;
  if (Math.abs(totalWeight - 100) > 0.01) {
    throw new Error(`Overall weight (${overallWeight}%) and Section weight (${sectionWeight}%) must total exactly 100% (currently ${totalWeight}%).`);
  }

  const categoryWeights: Record<string, number> = {};
  if (config.categoryWeights && typeof config.categoryWeights === 'object') {
    for (const [rawCat, weightVal] of Object.entries(config.categoryWeights)) {
      const canonical = canonicalizeCategory(rawCat);
      if (!canonical || isEligibilityCategory(canonical)) continue;
      const numWeight = Number(weightVal);
      if (isNaN(numWeight) || numWeight < 0) {
        throw new Error(`Relative weight for category "${getCategoryLabel(canonical)}" must be non-negative.`);
      }
      categoryWeights[canonical] = numWeight;
    }
  }

  if (sectionWeight > 0) {
    const sumCatWeights = Object.values(categoryWeights).reduce((a, b) => a + b, 0);
    if (sumCatWeights <= 0) {
      throw new Error('When section weight is greater than 0, at least one scored category must have a relative weight greater than 0.');
    }
  }

  const overallCutoffEnabled = Boolean(config.overallCutoffEnabled);
  const overallCutoffPercentage = Number(config.overallCutoffPercentage ?? 60);
  if (overallCutoffEnabled) {
    if (isNaN(overallCutoffPercentage) || overallCutoffPercentage < 0 || overallCutoffPercentage > 100) {
      throw new Error('Overall minimum cutoff percentage must be between 0 and 100.');
    }
  }

  const sectionCutoffs: Record<string, number> = {};
  if (config.sectionCutoffs && typeof config.sectionCutoffs === 'object') {
    for (const [rawCat, cutoffVal] of Object.entries(config.sectionCutoffs)) {
      const canonical = canonicalizeCategory(rawCat);
      if (!canonical || isEligibilityCategory(canonical)) continue;
      const numCutoff = Number(cutoffVal);
      if (!isNaN(numCutoff) && numCutoff > 0) {
        if (numCutoff < 0 || numCutoff > 100) {
          throw new Error(`Minimum cutoff for "${getCategoryLabel(canonical)}" must be between 0 and 100%.`);
        }
        sectionCutoffs[canonical] = numCutoff;
      }
    }
  }

  return {
    shortlistSize,
    overallCutoffEnabled,
    overallCutoffPercentage,
    sectionCutoffs,
    overallWeight,
    sectionWeight,
    categoryWeights
  };
}

/**
 * Normalizes relative category weights within the section component so they sum to 1.0.
 */
export function normalizeCategoryWeights(weights: Record<string, number>): Record<string, number> {
  const normalized: Record<string, number> = {};
  let totalRelativeWeight = 0;

  for (const [cat, w] of Object.entries(weights)) {
    if (w > 0) totalRelativeWeight += w;
  }

  for (const [cat, w] of Object.entries(weights)) {
    if (totalRelativeWeight > 0 && w > 0) {
      normalized[cat] = w / totalRelativeWeight;
    } else {
      normalized[cat] = 0;
    }
  }

  return normalized;
}

/**
 * Selects the authoritative test attempt for a candidate who may have multiple attempts in the same round.
 *
 * Authoritative Attempt Precedence:
 * 1. Evaluated attempts with status 'evaluated' > 'evaluating'/'submitted' > 'in_progress' > 'ineligible_attempt' > 'not_started'
 * 2. If multiple evaluated attempts: Highest absolute test score
 * 3. Tie-breaker: Latest completion/submission time (end_time or created_at)
 */
export function selectAuthoritativeAttempt(candidateTests: any[]): any {
  if (!candidateTests || candidateTests.length === 0) return null;
  if (candidateTests.length === 1) return candidateTests[0];

  const getStatusPriority = (status: string | null) => {
    switch (status) {
      case 'evaluated': return 5;
      case 'evaluating':
      case 'submitted':
      case 'auto_submitted': return 4;
      case 'in_progress': return 3;
      case 'ineligible_attempt': return 2;
      case 'not_started': return 1;
      default: return 0;
    }
  };

  const sorted = [...candidateTests].sort((a, b) => {
    // 1. Status priority
    const prioA = getStatusPriority(a.status);
    const prioB = getStatusPriority(b.status);
    if (prioB !== prioA) return prioB - prioA;

    // 2. Highest score (if evaluated)
    const scoreA = a.score !== null && a.score !== undefined ? Number(a.score) : -1;
    const scoreB = b.score !== null && b.score !== undefined ? Number(b.score) : -1;
    if (scoreB !== scoreA) return scoreB - scoreA;

    // 3. Latest submission date
    const dateA = a.end_time ? new Date(a.end_time).getTime() : (a.created_at ? new Date(a.created_at).getTime() : 0);
    const dateB = b.end_time ? new Date(b.end_time).getTime() : (b.created_at ? new Date(b.created_at).getTime() : 0);
    return dateB - dateA;
  });

  return sorted[0];
}

/**
 * Calculates candidate rankings and shortlists using Approach B.
 *
 * Formula:
 * Ranking Score = (Overall Percentage × Overall Weight / 100) + (Weighted Section Percentage × Section Weight / 100)
 */
export async function calculateShortlist(options: {
  round: number;
  templateId?: string | null;
  config: ShortlistConfig;
}): Promise<ShortlistCalculationResult> {
  const { round, templateId, config } = options;
  const validatedConfig = validateShortlistConfig(config);
  const normalizedCatWeights = normalizeCategoryWeights(validatedConfig.categoryWeights);

  // Fetch Template details if templateId is provided
  let templateName: string | null = null;
  if (templateId) {
    const template = await prisma.testTemplate.findUnique({
      where: { id: templateId },
      select: { name: true }
    });
    templateName = template?.name || null;
  }

  // Build filter for assessment and round isolation
  const testFilter: any = {
    round: round
  };
  if (templateId) {
    testFilter.template_id = templateId;
  }

  // Fetch tests with full student, questions, responses and AI evaluations
  const tests = await prisma.test.findMany({
    where: testFilter,
    include: {
      student: {
        include: {
          user: { select: { email: true } }
        }
      },
      test_questions: {
        include: { question: true }
      },
      test_responses: {
        include: {
          question: true,
          ai_evaluation: true
        }
      }
    },
    orderBy: { created_at: 'desc' }
  });

  // Group tests by student to identify authoritative attempt and prevent duplicate entries
  const testsByStudent = new Map<string, any[]>();
  for (const t of tests) {
    if (!t.student_id) continue;
    if (!testsByStudent.has(t.student_id)) {
      testsByStudent.set(t.student_id, []);
    }
    testsByStudent.get(t.student_id)!.push(t);
  }

  const authoritativeTests: any[] = [];
  for (const [, studentTests] of testsByStudent.entries()) {
    const authoritative = selectAuthoritativeAttempt(studentTests);
    if (authoritative) {
      authoritativeTests.push(authoritative);
    }
  }

  const REVIEWABLE_TYPES = ['coding', 'structured_response', 'open_text'];
  const processedCandidates: RankedCandidate[] = [];

  for (const test of authoritativeTests) {
    const student = test.student;
    const testTitle = test.title || (test.round === 2 ? 'Round 2 Technical Interview Assessment' : 'Round 1 Assessment');

    let timeTakenMins = 0;
    if (test.start_time && test.end_time) {
      timeTakenMins = Math.round((new Date(test.end_time).getTime() - new Date(test.start_time).getTime()) / 60000);
    }

    const isIneligible = test.status === 'ineligible_attempt';
    const isEvaluating = test.status === 'evaluating' || test.status === 'in_progress' || test.status === 'not_started';
    const isFailed = test.status === 'evaluation_failed';

    // Check for any failed or pending subjective AI evaluations in responses
    let hasFailedSubEval = false;
    let hasPendingSubEval = false;

    for (const r of test.test_responses) {
      if (isEligibilityCategory(r.question?.section)) continue;
      const isReviewable = REVIEWABLE_TYPES.includes(r.question?.type || '');
      const aiStatus = (r.ai_evaluation as any)?.evaluation_status || r.evaluation_status;

      if (isReviewable) {
        if (aiStatus === 'FAILED') {
          hasFailedSubEval = true;
        } else if (aiStatus === 'PENDING' || aiStatus === 'PROCESSING' || aiStatus === 'RETRYING') {
          hasPendingSubEval = true;
        }
      }
    }

    // Determine Evaluation Quality Flags
    let needsReview = false;
    let reviewReason: string | null = null;
    const exclusionReasons: string[] = [];

    if (isIneligible) {
      exclusionReasons.push('Ineligible attempt: Did not meet the minimum 60% question attempt threshold.');
    } else if (isFailed || hasFailedSubEval) {
      needsReview = true;
      reviewReason = 'Evaluation failed: One or more subjective questions failed automated evaluation. Requires retry or admin review.';
      exclusionReasons.push('Evaluation failed: Requires admin review.');
    } else if (isEvaluating || hasPendingSubEval) {
      needsReview = true;
      reviewReason = 'Evaluation pending: Test or subjective responses are still being evaluated.';
      exclusionReasons.push('Evaluation incomplete: Currently evaluating.');
    }

    // Calculate Marks & Category Totals
    let overallEarnedMarks = 0;
    let overallMaxMarks = 0;
    const categoryEarnedMap: Record<string, number> = {};
    const categoryMaxMap: Record<string, number> = {};

    // 1. Compute Max Marks per category from assigned test questions (excluding Eligibility)
    for (const tq of test.test_questions) {
      const sec = canonicalizeCategory(tq.question.section);
      if (!sec || isEligibilityCategory(sec)) continue;

      const pts = Number(tq.question.points || 0);
      overallMaxMarks += pts;
      categoryMaxMap[sec] = (categoryMaxMap[sec] || 0) + pts;
      if (!(sec in categoryEarnedMap)) {
        categoryEarnedMap[sec] = 0;
      }
    }

    // 2. Compute Earned Marks per category from responses (excluding Eligibility)
    if (!isIneligible && !needsReview) {
      for (const r of test.test_responses) {
        const sec = canonicalizeCategory(r.question.section);
        if (!sec || isEligibilityCategory(sec)) continue;

        const ai = r.ai_evaluation as any;
        let earned = 0;
        if (ai && ai.obtained_marks !== null && ai.obtained_marks !== undefined) {
          earned = Number(ai.obtained_marks);
        } else if (r.points_earned !== null && r.points_earned !== undefined) {
          earned = Number(r.points_earned);
        }

        if (earned > 0) {
          overallEarnedMarks += earned;
          categoryEarnedMap[sec] = (categoryEarnedMap[sec] || 0) + earned;
        }
      }
    }

    // 3. Compute Percentages
    const overallPercentage = overallMaxMarks > 0 
      ? Math.round(((overallEarnedMarks / overallMaxMarks) * 100) * 100) / 100
      : 0;

    const categoryScores: Record<string, CandidateCategoryScore> = {};
    let weightedSectionPercentage = 0;
    let meetsAllSectionCutoffs = true;

    // Process all categories present in the test or configured in weights/cutoffs
    const allRelevantCategories = new Set<string>([
      ...Object.keys(categoryMaxMap),
      ...Object.keys(validatedConfig.categoryWeights),
      ...Object.keys(validatedConfig.sectionCutoffs)
    ]);

    for (const cat of allRelevantCategories) {
      if (isEligibilityCategory(cat)) continue;

      const earned = categoryEarnedMap[cat] || 0;
      const max = categoryMaxMap[cat] || 0;
      const catPct = max > 0 ? Math.round(((earned / max) * 100) * 100) / 100 : 0;
      const cfgWeight = validatedConfig.categoryWeights[cat] || 0;
      const normWeight = normalizedCatWeights[cat] || 0;
      const reqCutoff = validatedConfig.sectionCutoffs[cat] !== undefined ? validatedConfig.sectionCutoffs[cat] : null;

      let meetsCutoff = true;
      if (reqCutoff !== null && reqCutoff > 0) {
        if (catPct < reqCutoff) {
          meetsCutoff = false;
          meetsAllSectionCutoffs = false;
          if (!isIneligible && !needsReview) {
            exclusionReasons.push(`Section "${getCategoryLabel(cat)}" score (${catPct}%) is below the required cutoff of ${reqCutoff}%.`);
          }
        }
      }

      if (normWeight > 0) {
        weightedSectionPercentage += catPct * normWeight;
      }

      categoryScores[cat] = {
        category: cat,
        categoryLabel: getCategoryLabel(cat),
        earnedMarks: earned,
        maxMarks: max,
        percentage: catPct,
        configuredWeight: cfgWeight,
        normalizedWeight: Math.round(normWeight * 1000) / 1000,
        meetsCutoff,
        requiredCutoff: reqCutoff
      };
    }

    weightedSectionPercentage = Math.round(weightedSectionPercentage * 100) / 100;

    // Check Overall Cutoff
    let meetsOverallCutoff = true;
    if (validatedConfig.overallCutoffEnabled && validatedConfig.overallCutoffPercentage > 0) {
      if (overallPercentage < validatedConfig.overallCutoffPercentage) {
        meetsOverallCutoff = false;
        if (!isIneligible && !needsReview) {
          exclusionReasons.push(`Overall score (${overallPercentage}%) is below the required overall cutoff of ${validatedConfig.overallCutoffPercentage}%.`);
        }
      }
    }

    // Compute Approach B Ranking Score
    // Ranking Score = (Overall Percentage × Overall Weight) + (Weighted Section Percentage × Section Weight) / 100
    let rankingScore = 0;
    if (!isIneligible && !needsReview) {
      const overallComponent = (overallPercentage * validatedConfig.overallWeight) / 100;
      const sectionComponent = (weightedSectionPercentage * validatedConfig.sectionWeight) / 100;
      rankingScore = Math.round((overallComponent + sectionComponent) * 1000) / 1000;
    }

    const isQualified = !isIneligible && !needsReview && meetsOverallCutoff && meetsAllSectionCutoffs;

    let shortlistStatus: CandidateShortlistStatus = 'not_shortlisted';
    if (needsReview) {
      shortlistStatus = 'pending_review';
    } else if (!isQualified) {
      shortlistStatus = 'disqualified';
    }

    processedCandidates.push({
      studentId: student?.id || test.student_id,
      fullName: student?.full_name || 'Unknown Candidate',
      usn: student?.usn || '',
      email: student?.user?.email || '',
      branch: student?.branch_name || '',
      testId: test.id,
      testTitle,
      round: test.round || round,
      templateId: test.template_id,
      attemptStatus: test.status || 'not_started',
      isAttemptEligible: !isIneligible,
      timeTakenMinutes: timeTakenMins,
      violationsCount: test.violations_count || 0,
      submittedAt: test.end_time ? test.end_time.toISOString() : null,

      overallEarnedMarks,
      overallMaxMarks,
      overallPercentage,
      categoryScores,
      weightedSectionPercentage,
      rankingScore,

      meetsAttemptEligibility: !isIneligible,
      meetsOverallCutoff,
      meetsSectionCutoffs: meetsAllSectionCutoffs,
      isQualified,

      shortlistStatus,
      rank: null,
      exclusionReasons,
      needsReview,
      reviewReason
    });
  }

  // Deterministic Tie-Break & Ranking Sort
  // 1. rankingScore (DESC)
  // 2. overallPercentage (DESC)
  // 3. Primary category percentage (highest weighted category or CODING) (DESC)
  // 4. timeTakenMinutes (ASC - faster completion favored)
  // 5. violationsCount (ASC - fewer violations favored)
  // 6. usn (ASC - stable alphabetical fallback)
  const highestWeightedCategory = Object.entries(validatedConfig.categoryWeights)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'CODING';

  const qualifiedCandidates = processedCandidates.filter(c => c.isQualified);
  const unqualifiedCandidates = processedCandidates.filter(c => !c.isQualified);

  qualifiedCandidates.sort((a, b) => {
    // 1. Ranking score
    if (b.rankingScore !== a.rankingScore) {
      return b.rankingScore - a.rankingScore;
    }

    // 2. Overall percentage
    if (b.overallPercentage !== a.overallPercentage) {
      return b.overallPercentage - a.overallPercentage;
    }

    // 3. Highest weighted category score
    const catA = a.categoryScores[highestWeightedCategory]?.percentage || 0;
    const catB = b.categoryScores[highestWeightedCategory]?.percentage || 0;
    if (catB !== catA) {
      return catB - catA;
    }

    // 4. Time taken (fewer minutes is better)
    if (a.timeTakenMinutes !== b.timeTakenMinutes) {
      return a.timeTakenMinutes - b.timeTakenMinutes;
    }

    // 5. Proctoring violations (fewer is better)
    if (a.violationsCount !== b.violationsCount) {
      return a.violationsCount - b.violationsCount;
    }

    // 6. Deterministic USN
    return a.usn.localeCompare(b.usn);
  });

  // Assign Ranks and Top N Shortlist Status
  let shortlistedCount = 0;
  let notShortlistedCount = 0;

  qualifiedCandidates.forEach((candidate, idx) => {
    candidate.rank = idx + 1;
    if (idx < validatedConfig.shortlistSize) {
      candidate.shortlistStatus = 'shortlisted';
      shortlistedCount++;
    } else {
      candidate.shortlistStatus = 'not_shortlisted';
      notShortlistedCount++;
    }
  });

  const disqualifiedCount = unqualifiedCandidates.filter(c => c.shortlistStatus === 'disqualified').length;
  const pendingReviewCount = unqualifiedCandidates.filter(c => c.shortlistStatus === 'pending_review').length;

  const allOrderedCandidates = [
    ...qualifiedCandidates,
    ...unqualifiedCandidates
  ];

  return {
    round,
    templateId: templateId || null,
    templateName,
    config: validatedConfig,
    calculatedAt: new Date().toISOString(),
    summary: {
      totalEvaluatedAttempts: authoritativeTests.length,
      totalUniqueCandidates: testsByStudent.size,
      qualifiedCount: qualifiedCandidates.length,
      shortlistedCount,
      notShortlistedCount,
      disqualifiedCount,
      pendingReviewCount
    },
    candidates: allOrderedCandidates
  };
}

/**
 * Persists the confirmed shortlist snapshot to the database.
 */
export async function publishShortlistSnapshot(options: {
  round: number;
  templateId?: string | null;
  adminUserId: string;
  config: ShortlistConfig;
  candidates: RankedCandidate[];
}): Promise<any> {
  const { round, templateId, adminUserId, config, candidates } = options;

  return await prisma.$transaction(async (tx) => {
    // 1. Create PublishedShortlist record
    const published = await tx.publishedShortlist.create({
      data: {
        template_id: templateId || undefined,
        round,
        published_by: adminUserId,
        shortlist_size: config.shortlistSize,
        config_snapshot: config as any
      }
    });

    // 2. Bulk insert ShortlistCandidate records
    if (candidates.length > 0) {
      await tx.shortlistCandidate.createMany({
        data: candidates.map(c => ({
          shortlist_id: published.id,
          student_id: c.studentId,
          test_id: c.testId,
          rank: c.rank,
          ranking_score: c.rankingScore,
          overall_percentage: c.overallPercentage,
          section_percentages: Object.fromEntries(
            Object.entries(c.categoryScores).map(([k, v]) => [k, v.percentage])
          ),
          status: c.shortlistStatus,
          exclusion_reasons: c.exclusionReasons.length > 0 ? c.exclusionReasons : undefined
        }))
      });
    }

    return published;
  });
}
