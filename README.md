# QueueForge

A distributed job scheduler with automatic retries and a dead-letter queue,
built to demonstrate a full DevOps pipeline on top of a MERN-style stack.

## What it does

- Submit jobs through a REST API or the React dashboard
- Jobs are processed asynchronously by a pool of workers (BullMQ + Redis)
- Failed jobs are retried automatically with exponential backoff
- Jobs that exhaust all retry attempts are moved to a **dead-letter queue**
  instead of disappearing, so they can be inspected or replayed
- Every job's full lifecycle (submitted → active → completed/failed/dead-letter)
  is persisted to MongoDB for history and auditing
- The dashboard polls live job counts and statuses

## Architecture

```
┌─────────────┐      ┌─────────────┐      ┌──────────────┐
│   Frontend   │─────▶│   API        │─────▶│   MongoDB     │
│  (React/     │      │  (Express)   │      │  (job history)│
│   Nginx)     │      └──────┬───────┘      └──────────────┘
└─────────────┘             │
                             ▼
                      ┌─────────────┐
                      │    Redis     │◀──────┐
                      │  (BullMQ)    │        │
                      └──────┬───────┘        │
                             ▼                │
                      ┌─────────────┐         │
                      │   Worker     │─────────┘
                      │  (retries +  │  (on exhaustion)
                      │  dead-letter)│
                      └─────────────┘
```

## Running locally with Docker

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- API: http://localhost:4000
- API health check: http://localhost:4000/health

This spins up 5 containers: `frontend`, `api`, `worker`, `mongo`, `redis` —
each service isolated, wired together, and independently restartable.

## Running without Docker (local dev)

```bash
# Terminal 1 - Mongo & Redis need to be running locally, then:
cd backend
cp .env.example .env
npm install
npm run start      # API

# Terminal 2
cd backend
npm run worker      # Worker process

# Terminal 3
cd frontend
npm install
npm run dev          # http://localhost:5173
```

## CI/CD

`.github/workflows/ci.yml` runs on every push/PR to `main`:

1. Spins up ephemeral MongoDB + Redis service containers
2. Installs backend dependencies and runs the test suite
3. On successful push to `main`, builds the backend and frontend Docker
   images (ready to be pushed to a registry and deployed — see comments
   in the workflow file for the extra steps needed to go fully live)

## Tech stack

**Backend:** Node.js, Express, BullMQ, Redis, MongoDB/Mongoose
**Frontend:** React, Vite
**Infra:** Docker, Docker Compose, GitHub Actions, Nginx
