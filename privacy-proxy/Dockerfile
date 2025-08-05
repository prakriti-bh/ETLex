FROM node:20-alpine3.18

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 8081

CMD ["node", "server.js"]