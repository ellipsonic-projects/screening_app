import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.slice(7);
    const decoded = verifyToken(token);

    if (!decoded || (decoded.role !== 'admin' && decoded.role !== 'recruiter' && decoded.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { testId } = await params;

    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        student: true,
        analytics: true,
        test_responses: {
          include: {
            question: true,
            ai_evaluation: true
          }
        },
        test_questions: {
          include: {
            question: true
          }
        }
      }
    });

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }

    const SECTIONS = [
      { id: 'ELIGIBILITY', label: 'Eligibility' },
      { id: 'APTITUDE', label: 'Aptitude' },
      { id: 'CODING', label: 'Coding' },
      { id: 'ATTITUDE_AND_OWNERSHIP', label: 'Attitude & Ownership' },
      { id: 'LEARNING_APTITUDE', label: 'Learning Aptitude' },
      { id: 'PROBLEM_SOLVING', label: 'Problem Solving' },
      { id: 'EXECUTION_AND_RELIABILITY', label: 'Execution & Reliability' },
      { id: 'COMMUNICATION_AND_TEAMWORK', label: 'Communication & Teamwork' },
      { id: 'INTEGRITY', label: 'Integrity' },
      { id: 'AI_LITERACY', label: 'AI Literacy' },
    ];

    const sectionScores = SECTIONS.map(sec => {
      const responsesInSection = test.test_responses.filter(r => r.question.section === sec.id);
      
      const totalMarks = responsesInSection.reduce((sum, r) => sum + (r.question.points || 0), 0);
      const marksObtained = responsesInSection.reduce((sum, r) => sum + (Number(r.points_earned) || 0), 0);
      
      return {
        sectionName: sec.label,
        marksObtained,
        totalMarks,
        isCompleted: test.status === 'submitted' || test.status === 'auto_submitted',
        hasQuestions: responsesInSection.length > 0
      };
    }).filter(sec => sec.hasQuestions); // Only return sections they actually had questions for, or should we return all? The prompt said "Display the report section-wise in this exact order... Each section should display..." If they have no questions, maybe we shouldn't display it. Wait, the prompt says "Display the report section-wise in this exact order: 1...10". I will return all 10 sections, but maybe the frontend will handle it. No, returning all 10 is safest, but with 0/0. Wait, actually I'll just return all 10.
    
    const finalSectionScores = SECTIONS.map(sec => {
      const questionsInSection = test.test_questions.filter((tq: any) => tq.question.section === sec.id);
      const responsesInSection = test.test_responses.filter(r => r.question.section === sec.id);
      
      const totalMarks = sec.id === 'ELIGIBILITY' ? null : questionsInSection.reduce((sum: number, tq: any) => sum + (tq.question.points || 0), 0);
      const marksObtained = sec.id === 'ELIGIBILITY' ? null : responsesInSection.reduce((sum: number, r: any) => {
        const ai = r.ai_evaluation as any;
        const earned = ai && ai.obtained_marks !== null && ai.obtained_marks !== undefined 
          ? Number(ai.obtained_marks) 
          : (Number(r.points_earned) || 0);
        return sum + earned;
      }, 0);
      
      return {
        sectionName: sec.label,
        marksObtained,
        totalMarks,
        isCompleted: test.status === 'submitted' || test.status === 'auto_submitted'
      };
    });

    let overallTotalMarks = 0;
    let overallMarksObtained = 0;
    
    test.test_questions.forEach((tq: any) => {
      if (tq.question.section !== 'ELIGIBILITY') {
        overallTotalMarks += (tq.question.points || 0);
      }
    });

    test.test_responses.forEach((r: any) => {
      if (r.question.section !== 'ELIGIBILITY') {
        const ai = r.ai_evaluation as any;
        const earned = ai && ai.obtained_marks !== null && ai.obtained_marks !== undefined 
          ? Number(ai.obtained_marks) 
          : (Number(r.points_earned) || 0);
        overallMarksObtained += earned;
      }
    });

    const scores = {
      overallScore: test.score ? Number(test.score) : overallMarksObtained,
      overallTotalMarks,
      sectionScores: finalSectionScores
    };
    // Group AI Evaluations by Section
    const REVIEWABLE_TYPES = ['coding', 'structured_response', 'open_text'];
    const aiEvaluationsBySection = SECTIONS.map(sec => {
      const responsesInSection = test.test_responses.filter(r => 
        r.question.section === sec.id && 
        (REVIEWABLE_TYPES.includes(r.question.type) || r.question.section === 'ELIGIBILITY')
      );
      
      return {
        sectionName: sec.label,
        evaluations: responsesInSection.map(r => {
          const ai = r.ai_evaluation as any; // Cast safely since we included it
          const isEligibility = r.question.section === 'ELIGIBILITY';
          const isAiReviewable = REVIEWABLE_TYPES.includes(r.question.type);

          let status: string;
          if (isEligibility) {
            status = 'ELIGIBILITY_ONLY';
          } else if (isAiReviewable) {
            if (ai?.evaluation_status) {
              status = ai.evaluation_status;
            } else if (r.evaluation_status === 'FAILED') {
              status = 'FAILED';
            } else if (r.evaluation_status === 'PROCESSING') {
              status = 'PROCESSING';
            } else {
              status = 'PENDING';
            }
          } else {
            status = r.points_earned !== null ? 'SCORED' : 'PENDING';
          }

          const isCompleted = status === 'COMPLETED';
          const isFailed = status === 'FAILED';

          let pointsEarned: number | null = null;
          if (isEligibility || isFailed) {
            pointsEarned = null;
          } else if (isAiReviewable) {
            if (ai && ai.obtained_marks !== null && ai.obtained_marks !== undefined && isCompleted) {
              pointsEarned = Number(ai.obtained_marks);
            } else {
              pointsEarned = null;
            }
          } else {
            pointsEarned = r.points_earned !== null ? Number(r.points_earned) : null;
          }

          return {
            questionId: r.question.id,
            question: r.question.question_text,
            type: r.question.type,
            section: r.question.section,
            studentAnswer: r.student_answer,
            pointsEarned,
            maxPoints: isEligibility ? null : (ai?.maximum_marks ?? r.question.points ?? 0),
            isCorrect: isFailed ? false : r.is_correct,
            status,
            feedback: ai?.feedback,
            strengths: ai?.strengths,
            improvements: ai?.improvements,
            mistakes: (ai?.raw_response as any)?.mistakes || [],
            suggestions: (ai?.raw_response as any)?.suggestions || [],
            modelUsed: ai?.model_used,
            rawResponse: ai?.raw_response || r.ai_evaluation_json || null,
            evaluatedAt: ai?.evaluated_at || (r.ai_evaluation_json as any)?.evaluatedAt || null
          };
        })
      };
    }).filter(sec => sec.evaluations.length > 0);

    return NextResponse.json({
      success: true,
      data: {
        id: test.id,
        studentName: test.student?.full_name || 'Unknown Student',
        status: test.status,
        startTime: test.start_time,
        endTime: test.end_time,
        submissionTime: test.end_time,
        totalDuration: test.total_duration,
        timeTaken: test.start_time && test.end_time ? Math.round((new Date(test.end_time).getTime() - new Date(test.start_time).getTime()) / 60000) : (test.analytics?.time_taken || null),
        scores,
        aiEvaluationsBySection
      }
    });

  } catch (error: any) {
    console.error('Fetch Admin Result Details Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch result details', details: error.message },
      { status: 500 }
    );
  }
}
