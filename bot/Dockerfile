FROM node:24-alpine

WORKDIR /bot

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && pnpm install --prod --frozen-lockfile

COPY *.mjs ./
COPY data ./data

ENV NODE_ENV=production

CMD ["node", "bot.mjs"]
