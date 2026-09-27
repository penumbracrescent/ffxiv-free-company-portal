FROM node:24-alpine

WORKDIR /worker

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --prod --frozen-lockfile

COPY worker.mjs achievement-collections.mjs fc-verification.mjs ./

ENV NODE_ENV=production

CMD ["node", "worker.mjs"]
