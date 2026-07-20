# Nyxwire streaming — immutable image
FROM node:20-alpine

LABEL org.opencontainers.image.title="nyxwire-streaming" \
      org.opencontainers.image.description="Nyxwire video streamer + AMQP publisher"

WORKDIR /app

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

COPY src ./src
COPY videos ./videos

USER node

EXPOSE 3000

ENV PORT=3000 \
    VIDEO_PATH=/app/videos/sample.mp4

CMD ["node", "src/index.js"]
