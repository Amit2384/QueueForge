const IORedis = require("ioredis");

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// BullMQ requires maxRetriesPerRequest: null on the connection it manages
const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

module.exports = { connection, REDIS_URL };
