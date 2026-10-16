FROM node:23-alpine AS builder
WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install
COPY src/ ./src/
RUN npm run build

FROM node:23-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4001
ENV GRPC_PORT=50051
COPY package.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
COPY src/proto ./dist/proto 2>/dev/null || true
COPY migrations ./migrations 2>/dev/null || true
EXPOSE 4001
EXPOSE 50051
USER node
CMD ["node", "dist/server.js"]
