FROM node:16-alpine AS build
WORKDIR /server
COPY package.json .
COPY package-lock.json .
RUN npm install
COPY . .
RUN npm run build

FROM node:16-alpine AS production
EXPOSE 3010
WORKDIR /app
COPY package.json .
COPY migrations ./migrations
COPY --from=build /server/build ./build
COPY --from=build /server/node_modules ./node_modules
ENTRYPOINT npm run start