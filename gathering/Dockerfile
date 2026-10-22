FROM node:24.22.1-alpine
WORKDIR /gathering
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY *.mjs ./
COPY start.sh ./start.sh
RUN mkdir /state && chown node:node /state
ENTRYPOINT ["sh","/gathering/start.sh"]
