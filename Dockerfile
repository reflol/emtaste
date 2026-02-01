FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lockb* ./
RUN bun install --production

COPY . .

RUN chown -R bun:bun /app

USER bun

EXPOSE 3000

CMD ["bun", "server.js"]
