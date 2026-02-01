FROM oven/bun:1

WORKDIR /app

COPY . .

RUN mkdir -p /app/data \
  && chown -R bun:bun /app

USER bun

EXPOSE 3000

CMD ["bun", "server.js"]
