import prisma from '@/lib/prisma';
import { isEligibilityCategory, canonicalizeCategory } from '@/lib/categories';

export async function recalculateTestScore(testId: string): Promise<number> {
  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: {
      test_questions: {
        include: { question: true }
      }
    }
  });

  if (!test) throw new Error(`Test ${testId} not found`);

  // Calculate maximum possible points for the test (Eligibility is unscored)
  let totalPossiblePoints = 0;
  for (const tq of test.test_questions) {
    if (isEligibilityCategory(tq.question.section)) continue;
    totalPossiblePoints += tq.question.points || 0;
  }

  // Get all responses
  const responses = await prisma.testResponse.findMany({
    where: { test_id: testId },
    include: { question: true }
  });

  // Get all AI Evaluations
  const aiEvaluations = await prisma.aIEvaluation.findMany({
    where: { test_id: testId }
  });

  let totalEarnedPoints = 0;
  let overallAiMarks = 0;
  const sectionTotals: Record<string, number> = {};

  const REVIEWABLE_TYPES = ['coding', 'structured_response', 'open_text'];
  let hasFailedEvaluation = false;

  for (const response of responses) {
    if (isEligibilityCategory(response.question?.section)) continue;
    
    const isSubjective = REVIEWABLE_TYPES.includes(response.question?.type || '');
    const aiEval = aiEvaluations.find(e => e.test_response_id === response.id);
    const evalStatus = aiEval?.evaluation_status || response.evaluation_status;

    if (isSubjective && evalStatus === 'FAILED') {
      hasFailedEvaluation = true;
    }

    let earned = 0;

    // Explicitly check AI Evaluation marks for this response
    if (aiEval && aiEval.obtained_marks !== null && aiEval.obtained_marks !== undefined) {
      earned = Number(aiEval.obtained_marks);
    } else if (response.points_earned !== null && response.points_earned !== undefined) {
      earned = Number(response.points_earned);
    }

    if (earned > 0) {
      totalEarnedPoints += earned;
      const section = canonicalizeCategory(response.question?.section) || 'uncategorized';
      if (!sectionTotals[section]) sectionTotals[section] = 0;
      sectionTotals[section] += earned;
    }
  }

  for (const evaluation of aiEvaluations) {
    if (isEligibilityCategory(evaluation.section)) continue;
    if (evaluation.obtained_marks !== null && evaluation.obtained_marks !== undefined) {
      overallAiMarks += Number(evaluation.obtained_marks);
    }
  }

  const overallPercentage = totalPossiblePoints > 0 ? (totalEarnedPoints / totalPossiblePoints) * 100 : 0;

  if (hasFailedEvaluation) {
    // If any evaluation failed, candidate score must NOT be finalized as zero/partial
    await prisma.test.update({
      where: { id: testId },
      data: {
        score: null,
        status: 'evaluation_failed'
      }
    });

    await prisma.testAnalytics.upsert({
      where: { test_id: testId },
      update: {
        total_score: null,
        overall_ai_marks: overallAiMarks,
        overall_percentage: null,
        section_totals: sectionTotals
      },
      create: {
        test_id: testId,
        total_score: null,
        overall_ai_marks: overallAiMarks,
        overall_percentage: null,
        section_totals: sectionTotals
      }
    });

    return 0;
  }

  const updateData: any = {
    score: totalEarnedPoints
  };
  if (test.status === 'evaluation_failed') {
    updateData.status = 'evaluated';
  }

  // Persist the recalculated absolute score
  await prisma.test.update({
    where: { id: testId },
    data: updateData
  });

  // Upsert TestAnalytics
  await prisma.testAnalytics.upsert({
    where: { test_id: testId },
    update: {
      total_score: totalEarnedPoints,
      overall_ai_marks: overallAiMarks,
      overall_percentage: overallPercentage,
      section_totals: sectionTotals
    },
    create: {
      test_id: testId,
      total_score: totalEarnedPoints,
      overall_ai_marks: overallAiMarks,
      overall_percentage: overallPercentage,
      section_totals: sectionTotals
    }
  });

  return totalEarnedPoints;
}
