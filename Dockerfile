FROM node:22-alpine
WORKDIR /app
COPY . .
RUN cd frontend && npm install && npm run build
RUN cd backend && npm install
EXPOSE 3001
CMD ["node", "backend/src/index.js"]
