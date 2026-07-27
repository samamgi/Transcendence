FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine

RUN apk add --no-cache openssl \
	&& mkdir -p /etc/nginx/certs \
	&& openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
	-keyout /etc/nginx/certs/localhost.key \
	-out /etc/nginx/certs/localhost.crt \
	-subj "/CN=localhost"

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80 443
