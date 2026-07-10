FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 3000

# Dev server, so the reviewer gets hot reload and readable stack traces.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
