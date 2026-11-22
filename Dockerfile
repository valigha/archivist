FROM node:22-alpine

RUN apk add --no-cache su-exec tzdata wget \
  && mkdir -p /app/config /app/library /app/log

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY VERSION ./
COPY gateway ./gateway
COPY apps ./apps
COPY entrypoint.sh ./
RUN chmod +x /app/entrypoint.sh

ENV LIBRARY_PATH=/app/library/ \
    CONFIG_DIR=/app/config \
    LOG_ROOT=/app/log \
    PORT=8090 \
    NODE_ENV=production

EXPOSE 8090
VOLUME ["/app/config", "/app/library", "/app/log"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8090/health || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
