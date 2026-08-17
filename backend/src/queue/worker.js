require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { Worker } = require("bullmq");
const { connection } = require("./connection");
const { deadLetterQueue } = require("./queues");
const Job = require("../models/Job");
const sharp = require("sharp");

const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017/queueforge";
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(__dirname, "../../output");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function connectMongo() {
  await mongoose.connect(MONGO_URL);
  console.log("[worker] connected to MongoDB");
}

/**
 * Real job processor: downloads an image from a URL and resizes it with
 * sharp. This is a genuine background-job use case (thumbnail generation,
 * avatar processing, etc.) - failures here are real, not simulated:
 * a bad URL, a non-image response, or a network timeout will legitimately
 * throw and trigger the retry/dead-letter path.
 */
async function processResizeImageJob(job) {
  const { imageUrl, width = 300 } = job.data.payload || {};

  if (!imageUrl) {
    throw new Error("payload.imageUrl is required for a resize-image job");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  let response;
  try {
    response = await fetch(imageUrl, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`Failed to download image: HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) {
    throw new Error(`URL did not return an image (content-type: ${contentType || "unknown"})`);
  }

  const inputBuffer = Buffer.from(await response.arrayBuffer());

  const outputFilename = `${job.id}.jpg`;
  const outputPath = path.join(OUTPUT_DIR, outputFilename);

  const info = await sharp(inputBuffer)
    .resize({ width: Number(width) })
    .jpeg({ quality: 82 })
    .toFile(outputPath);

  return {
    outputFile: outputFilename,
    outputWidth: info.width,
    outputHeight: info.height,
    originalBytes: inputBuffer.length,
    outputBytes: info.size,
  };
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
      const result = await processResizeImageJob(job);
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

