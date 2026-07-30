# syntax=docker/dockerfile:1
#
# Single image: PocketBase + Vite SPA in pb_public
# Pattern inspired by https://github.com/kdpuvvadi/pocketbase

ARG VERSION=0.39.10
ARG TARGETPLATFORM

# ---------------------------------------------------------------------------
# Build React (Vite) frontend
# ---------------------------------------------------------------------------
FROM node:22-alpine AS frontend

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ .

# Empty = browser talks to same origin (PocketBase serves API + UI)
ARG VITE_POCKETBASE_URL=
ENV VITE_POCKETBASE_URL=$VITE_POCKETBASE_URL

RUN npm run build

# ---------------------------------------------------------------------------
# PocketBase runtime with static UI in pb_public
# ---------------------------------------------------------------------------
FROM alpine:3.21

LABEL org.opencontainers.image.title="inventory"
LABEL org.opencontainers.image.description="Inventory Management — PocketBase with embedded Vite UI"
LABEL org.opencontainers.image.licenses="MIT"

ARG VERSION=0.28.4
ARG TARGETPLATFORM

RUN apk add --no-cache ca-certificates tzdata curl unzip wget nodejs npm \
  && mkdir -p /usr/src/app/pb_data /usr/src/app/pb_public /usr/src/app/pb_hooks /usr/src/app/scripts

WORKDIR /usr/src/app

RUN case "$TARGETPLATFORM" in \
      "linux/arm/v7") ARCH=armv7 ;; \
      "linux/arm64"|"linux/arm64/v8") ARCH=arm64 ;; \
      *) ARCH=amd64 ;; \
    esac \
  && curl -fsSL \
      "https://github.com/pocketbase/pocketbase/releases/download/v${VERSION}/pocketbase_${VERSION}_linux_${ARCH}.zip" \
      -o /tmp/pb.zip \
  && unzip /tmp/pb.zip -d /usr/src/app \
  && rm /tmp/pb.zip \
  && chmod +x /usr/src/app/pocketbase

COPY pocketbase/entrypoint.sh /usr/src/app/entrypoint.sh
COPY pocketbase/pb_schema.json /usr/src/app/pb_schema.json
COPY pocketbase/package.json pocketbase/package-lock.json /usr/src/app/scripts/
COPY pocketbase/import-schema.js pocketbase/seed.js /usr/src/app/scripts/
COPY --from=frontend /app/dist /usr/src/app/pb_public

RUN cd /usr/src/app/scripts \
  && npm ci --omit=dev \
  && chmod +x /usr/src/app/entrypoint.sh /usr/src/app/pocketbase \
  && adduser -D -u 1000 -h /usr/src/app pbuser \
  && chown -R pbuser:pbuser /usr/src/app

USER pbuser

EXPOSE 8090
VOLUME ["/usr/src/app/pb_data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8090/api/health || exit 1

ENV PB_HTTP_ADDR=0.0.0.0:8090 \
    PB_DATA_DIR=/usr/src/app/pb_data \
    PB_PUBLIC_DIR=/usr/src/app/pb_public \
    PB_HOOKS_DIR=/usr/src/app/pb_hooks \
    PB_SCHEMA_PATH=/usr/src/app/pb_schema.json \
    PB_AUTO_IMPORT_SCHEMA=true \
    PB_AUTO_SEED=false \
    PB_URL=http://127.0.0.1:8090

LABEL org.opencontainers.image.version=${VERSION}

ENTRYPOINT ["/usr/src/app/entrypoint.sh"]
CMD ["serve"]
