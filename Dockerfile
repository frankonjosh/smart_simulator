# Curis SMART Simulator — container image.
# Node 20 (engines requires >=20). better-sqlite3 is a native module, so the
# build deps (python3/make/g++) are present in case a prebuilt binary isn't
# available for this platform and npm has to compile it.
FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

# Install deps first for layer caching. No lockfile in the repo, so use
# `npm install` (not `npm ci`). Production deps only.
COPY package.json ./
RUN npm install --omit=dev

COPY . .

# The SQLite file lives on a mounted volume so data survives restarts.
ENV PORT=6021
ENV DB_FILE=/data/sim.db
RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 6021
CMD ["node", "src/server.js"]
