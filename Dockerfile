# One image for both processes: the server (by default) and the vehicle counter (node counter/index.js).
# See docker-compose.yml, and Deploying in readme.md.

# The browser app, built
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
RUN npm run build

# What runs: production dependencies, the server, the counter, and the built app. The model is
# mounted at /app/models rather than built in; cache/, vehicle-counts/ and server-state/ are volumes,
# made here so they belong to the node user.
FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server server
COPY shared shared
COPY counter counter
COPY --from=build /app/dist dist
RUN mkdir cache vehicle-counts server-state models && chown node:node cache vehicle-counts server-state
USER node
EXPOSE 3000
CMD ["node", "server/index.js"]
