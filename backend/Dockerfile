FROM node:20-alpine AS base

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY src ./src

# Default command runs the API. The worker container overrides this
# via docker-compose's `command:` directive, so one image serves both roles.
EXPOSE 4000
CMD ["node", "src/index.js"]
