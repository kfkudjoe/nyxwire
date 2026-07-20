# Nyxwire gateway — immutable image
FROM node:20-alpine

LABEL org.opencontainers.image.title="nyxwire-gateway" \
      org.opencontainers.image.description="Nyxwire edge gateway"

WORKDIR /app

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

COPY src ./src

USER node

EXPOSE 3000

ENV PORT=3000

CMD ["node", "src/index.js"]
