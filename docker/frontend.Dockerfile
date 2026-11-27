FROM node:22-bookworm-slim
WORKDIR /workspace
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.ts tsconfig.json ./
COPY src src
COPY public public
CMD ["npm", "run", "dev"]
