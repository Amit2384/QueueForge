const { Queue } = require("bullmq");
const { connection } = require("./connection");

// Main job queue - jobs land here first
const jobQueue = new Queue("jobs", { connection });

// Dead-letter queue - jobs that exhausted all retries land here for
// manual inspection/replay instead of silently disappearing
const deadLetterQueue = new Queue("jobs-dead-letter", { connection });

module.exports = { jobQueue, deadLetterQueue };
