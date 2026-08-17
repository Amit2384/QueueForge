const mongoose = require("mongoose");

describe("Job model", () => {
  test("defaults status to waiting", () => {
    const Job = require("../models/Job");
    const job = new Job({ bullJobId: "test-1", name: "sample-task" });
    expect(job.status).toBe("waiting");
    expect(job.attemptsMade).toBe(0);
    expect(job.maxAttempts).toBe(3);
  });

  test("rejects invalid status enum values", () => {
    const Job = require("../models/Job");
    const job = new Job({ bullJobId: "test-2", name: "sample-task", status: "not-a-real-status" });
    const err = job.validateSync();
    expect(err.errors.status).toBeDefined();
  });
});
