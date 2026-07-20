FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi
COPY src ./src
# Seed lives in image; runtime volume may mount over /data — copy on boot in index.js
COPY data/sample.mp4 /app/seed/sample.mp4
# Run as root so empty named volumes are writable; prod would use init chown + non-root
EXPOSE 3000
ENV PORT=3000 STORAGE_DIR=/data SERVICE_NAME=nyxwire-storage-local
CMD ["node", "src/index.js"]
