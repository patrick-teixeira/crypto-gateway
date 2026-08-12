FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS web-build
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
COPY . .
RUN npm run build

FROM node:22-alpine AS web
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000
WORKDIR /app
COPY --from=web-build --chown=node:node /app/public ./public
COPY --from=web-build --chown=node:node /app/.next/standalone ./
COPY --from=web-build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]

FROM node:22-alpine AS backend-dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine AS backend
ENV NODE_ENV=production \
    PORT=8021
WORKDIR /app
COPY --from=backend-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json app.js rpcs.json ./
COPY --chown=node:node api ./api
COPY --chown=node:node config ./config
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node workers ./workers
USER node
EXPOSE 8021
CMD ["npm", "run", "backend"]
