require("dotenv").config();
const mongoose = require("mongoose");
const { Worker } = require("bullmq");
const { connection } = require("./connection");
const { deadLetterQueue } = require("./queues");
const Job = require("../models/Job");

const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017/queueforge";

async function connectMongo() {
  await mongoose.connect(MONGO_URL);
  console.log("[worker] connected to MongoDB");
}

/**
 * Simulated job processor. Real job "types" would branch on job.name here
 * (e.g. send-email, resize-image, generate-report). To keep this a
 * self-contained demo, every job has a random chance of failure so the
 * retry + dead-letter path is actually exercised.
 */
async function processJob(job) {
  const { failureRate = 0.35, durationMs = 800 } = job.data.payload || {};

  await new Promise((resolve) => setTimeout(resolve, durationMs));

  if (Math.random() < failureRate) {
    throw new Error(`Simulated failure processing job "${job.name}"`);
  }

  return { processedAt: new Date().toISOString(), jobName: job.name };
}

async function updateAuditRecord(bullJobId, update, historyNote) {
  const record = await Job.findOne({ bullJobId });
  if (!record) return;

  Object.assign(record, update);
  record.history.push({ status: update.status, note: historyNote });
  await record.save();
}

async function main() {
  await connectMongo();

  const worker = new Worker(
    "jobs",
    async (job) => {
      await updateAuditRecord(job.id, { status: "active", attemptsMade: job.attemptsMade + 1 }, "Picked up by worker");
      const result = await processJob(job);
      return result;
    },
    {
      connection,
      concurrency: 5,
    }
  );

  worker.on("completed", async (job, result) => {
    await updateAuditRecord(job.id, { status: "completed", result }, "Completed successfully");
    console.log(`[worker] job ${job.id} (${job.name}) completed`);
  });

  worker.on("failed", async (job, err) => {
    const exhausted = job.attemptsMade >= job.opts.attempts;
    console.log(
      `[worker] job ${job.id} (${job.name}) failed on attempt ${job.attemptsMade}/${job.opts.attempts}: ${err.message}`
    );

    if (exhausted) {
      // All retries used up - route to dead-letter queue for manual inspection/replay
      await deadLetterQueue.add(job.name, job.data, { removeOnComplete: false });
      await updateAuditRecord(
        job.id,
        { status: "dead-letter", error: err.message },
        `Exhausted ${job.opts.attempts} attempts, moved to dead-letter queue`
      );
    } else {
      await updateAuditRecord(
        job.id,
        { status: "waiting", error: err.message },
        `Attempt ${job.attemptsMade} failed, will retry`
      );
    }
  });

  console.log("[worker] listening for jobs on queue 'jobs'");
}

main().catch((err) => {
  console.error("[worker] fatal error", err);
  process.exit(1);
});
