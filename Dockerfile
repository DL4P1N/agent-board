# Run the board on a small server instead of a laptop:
#   docker build -t claude-board .
#   docker run -d -p 4000:4000 -v claude-board-data:/data -e PUBLIC_URL=https://board.example.com claude-board
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
