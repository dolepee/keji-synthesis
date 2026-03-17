FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY dist/ dist/
COPY agent/ agent/
COPY runtime/ runtime/
COPY logs/ logs/
ENV NODE_ENV=production
EXPOSE 3402
CMD ["node", "dist/cli.js", "serve"]
