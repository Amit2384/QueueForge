require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const jobsRouter = require("./routes/jobs");

const app = express();
const PORT = process.env.PORT || 4000;
const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017/queueforge";
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(__dirname, "../output");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

app.use(cors());
app.use(express.json());

// Resized images land here - served directly so the dashboard can show
// the real output thumbnail once a job completes.
app.use("/output", express.static(OUTPUT_DIR));

app.get("/health", (req, res) => {
  res.json({ status: "ok", mongoConnected: mongoose.connection.readyState === 1 });
});

app.use("/api/jobs", jobsRouter);

async function start() {
  await mongoose.connect(MONGO_URL);
  console.log("[api] connected to MongoDB");

  app.listen(PORT, () => {
    console.log(`[api] QueueForge API listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error("[api] failed to start", err);
  process.exit(1);
});

module.exports = app;
