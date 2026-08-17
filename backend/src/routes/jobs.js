const express = require("express");
const { jobQueue } = require("../queue/queues");
const Job = require("../models/Job");

const router = express.Router();

// POST /api/jobs - submit a new job to the queue
router.post("/", async (req, res) => {
  try {
    const { name = "generic-task", payload = {}, maxAttempts = 3 } = req.body;

    const bullJob = await jobQueue.add(name, { payload }, {
      attempts: maxAttempts,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: false,
      removeOnFail: false,
    });

    const record = await Job.create({
      bullJobId: bullJob.id,
      name,
      payload,
      maxAttempts,
      status: "waiting",
      history: [{ status: "waiting", note: "Job submitted" }],
    });

    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/jobs - list jobs, optionally filtered by status
router.get("/", async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    const jobs = await Job.find(filter).sort({ createdAt: -1 }).limit(200);
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/jobs/stats - counts by status, for the dashboard summary cards
router.get("/stats", async (req, res) => {
  try {
    const counts = await Job.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const stats = { waiting: 0, active: 0, completed: 0, failed: 0, "dead-letter": 0 };
    counts.forEach((c) => { stats[c._id] = c.count; });
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/jobs/:id - single job detail (full history)
router.get("/:id", async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: "Job not found" });
    res.json(job);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
