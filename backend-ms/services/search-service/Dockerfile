FROM node:23-alpine AS builder
WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install
COPY . .
RUN npm run build
RUN mkdir -p /app/dist/proto && if [ -d /app/src/proto ]; then cp -r /app/src/proto/* /app/dist/proto/ 2>/dev/null || true; fi
RUN mkdir -p /app/migrations_stage && if [ -d /app/migrations ]; then cp -r /app/migrations/* /app/migrations_stage/ 2>/dev/null || true; fi

FROM node:23-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4008

COPY package.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/migrations_stage ./migrations
EXPOSE 4008

USER node
CMD ["node", "dist/server.js"]
