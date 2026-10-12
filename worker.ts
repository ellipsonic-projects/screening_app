import { Worker, Job } from 'bullmq';
import * as dotenv from 'dotenv';
import { processBackgroundEvaluations } from './lib/services/evaluation-pipeline';
import { EvaluationJobPayload } from './lib/queue/evaluation-queue';
import prisma from './lib/prisma';

// Load environment variables
dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const QUEUE_NAME = 'AI_EVALUATION_QUEUE';

const worker = new Worker<EvaluationJobPayload>(
  QUEUE_NAME,
  async (job: Job<EvaluationJobPayload>) => {
    const { testId, evalPayloads } = job.data;
    
    try {
      const mappedPayloads = evalPayloads.map(p => ({
        testId,
        questionId: p.questionId,
        studentAnswer: p.studentAnswer
      }));
      await processBackgroundEvaluations(mappedPayloads, testId);
    } catch (error) {
      console.error(`[Worker] Job ${job.id} failed:`, error);
      
      // Update the DB to RETRYING or FAILED depending on attempts
      const isRetrying = job.attemptsMade < (job.opts.attempts || 1);
      const newStatus = isRetrying ? 'RETRYING' : 'FAILED';
      
      for (const payload of evalPayloads) {
        const existingResponse = await prisma.testResponse.findFirst({
          where: { test_id: testId, question_id: payload.questionId }
        });
        
        if (existingResponse) {
          await prisma.testResponse.update({
            where: { id: existingResponse.id },
            data: {
              ai_evaluation_json: { 
                evaluationStatus: newStatus, 
                evaluatedAt: new Date().toISOString(),
                error: (error as Error).message || 'Unknown queue error'
              }
            }
          });
        }
      }
      
      throw error; // Let BullMQ handle the backoff/retry mechanism
    }
  },
  {
    connection: {
      url: REDIS_URL,
    },
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
  }
);

worker.on('failed', (job, err) => {
  console.error(`[Worker Event] Job ${job?.id} failed with error:`, err.message);
});

worker.on('error', (err) => {
  // log error details in a structured way
  console.error(JSON.stringify({
    level: 'error',
    message: 'Worker encountered an error',
    error: err.message,
    timestamp: new Date().toISOString()
  }));
});

// Handle graceful shutdown
const gracefulShutdown = async () => {
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
