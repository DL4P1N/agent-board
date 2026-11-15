# Run the board on a small server instead of a laptop:
#   docker build -t agent-board .
#   docker run -d -p 4000:4000 -v agent-board-data:/data -e PUBLIC_URL=https://board.example.com agent-board
# Already have a board from before the rename to Agent Board? Keep its volume (-v claude-board-data:/data) so its data stays.
# The token is generated on first start and saved in the volume (docker exec <id> cat /data/token),
# or set it with -e BOARD_TOKEN=...
FROM node:24-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY public ./public
COPY templates ./templates
COPY hooks ./hooks
COPY scripts ./scripts
ENV HOST=:: PORT=4000 BOARD_DATA=/data BOARD_NO_JOIN=1
VOLUME /data
EXPOSE 4000
CMD ["node", "src/server.js"]
