const mongoose = require("mongoose");

/**
 * Job is the audit/history record for every job submitted to the queue.
 * BullMQ owns the live queue state in Redis; this collection is the
 * durable record used for the dashboard, history, and reporting -
 * it survives even after BullMQ cleans up completed jobs from Redis.
 */
const jobSchema = new mongoose.Schema(
  {
    bullJobId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ["waiting", "active", "completed", "failed", "dead-letter"],
      default: "waiting",
      index: true,
    },
    attemptsMade: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 },
    result: { type: mongoose.Schema.Types.Mixed },
    error: { type: String },
    history: [
      {
        status: String,
        timestamp: { type: Date, default: Date.now },
        note: String,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Job", jobSchema);
