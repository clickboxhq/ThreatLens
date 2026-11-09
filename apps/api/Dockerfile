FROM node:26-alpine AS dev
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
COPY prisma ./prisma
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start:dev"]
