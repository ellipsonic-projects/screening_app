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

  for (const response of responses) {
    if (isEligibilityCategory(response.question?.section)) continue;
    
    let earned = 0;

    // Explicitly check AI Evaluation marks for this response
    const aiEval = aiEvaluations.find(e => e.test_response_id === response.id);
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
    if (evaluation.obtained_marks !== null && evaluation.obtained_marks !== undefined) {
      overallAiMarks += Number(evaluation.obtained_marks);
    }
  }

  const overallPercentage = totalPossiblePoints > 0 ? (totalEarnedPoints / totalPossiblePoints) * 100 : 0;

  // Persist the recalculated absolute score
  await prisma.test.update({
    where: { id: testId },
    data: {
      score: totalEarnedPoints
    }
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
