FROM node:23-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm install -f

COPY . .

RUN npm run build

FROM nginx:alpine AS production

RUN rm -rf /usr/share/nginx/html/*

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

CMD ["nginx", "-g", "daemon off;"]