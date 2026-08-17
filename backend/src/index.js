require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const jobsRouter = require("./routes/jobs");

const app = express();
const PORT = process.env.PORT || 4000;
const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017/queueforge";

app.use(cors());
app.use(express.json());

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
