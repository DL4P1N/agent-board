# Run the board on a small server instead of a laptop:
#   docker build -t agent-board .
#   docker run -d -p 4000:4000 -v agent-board-data:/data -e PUBLIC_URL=https://board.example.com agent-board
# Already have a board from before the rename to Agent Board? Keep its volume (-v claude-board-data:/data) so its data stays.
# The token is generated on first start and saved in the volume (docker exec <id> cat /data/token),
# or set it with -e BOARD_TOKEN=...
# The base image is pinned by tag. For a build that can't change under you, pin its digest too:
#   FROM node:24-slim@sha256:<digest>   (docker buildx imagetools inspect node:24-slim shows it)
FROM node:24-slim
WORKDIR /app
COPY package.json package-lock.json ./
# No dependency's install script runs (none needs one).
RUN npm ci --omit=dev --ignore-scripts
COPY src ./src
COPY public ./public
COPY templates ./templates
COPY hooks ./hooks
COPY scripts ./scripts
ENV HOST=:: PORT=4000 BOARD_DATA=/data BOARD_NO_JOIN=1
# Runs as the image's unprivileged "node" user (uid 1000). /data is created owned by it before VOLUME, so a new named
# volume starts writable; a bind mount (-v ./data:/data) must be writable by uid 1000 (chown 1000:1000 ./data).
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 4000
# No curl in the slim image: ask /health with node itself.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://localhost:'+(process.env.PORT||4000)+'/health',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "src/server.js"]
