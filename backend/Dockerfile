FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

FROM base AS development
RUN npm install
COPY . .
EXPOSE 4000
CMD ["npm", "run", "dev"]

FROM base AS production
COPY src ./src
COPY migrations ./migrations
EXPOSE 4000
CMD ["npm", "start"]
