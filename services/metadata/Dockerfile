FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi
COPY src ./src
EXPOSE 3000
ENV PORT=3000 SERVICE_NAME=nyxwire-metadata
CMD ["node", "src/index.js"]
