FROM scratch as base
COPY ./package.json ./
COPY ./yarn.lock ./
COPY ./theia.config.json ./
COPY ./public ./public
COPY ./views ./views

FROM node:8.9-alpine as build
WORKDIR /var/www/current
RUN apk update && apk --no-cache add python make g++
COPY --from=base / ./
RUN yarn install
COPY ./tsconfig.json ./
COPY ./tslint.json ./
COPY ./src ./src
RUN yarn run lint
RUN yarn run test
RUN yarn run build
# this prunes dev deps
RUN yarn install --production

FROM node:8.9-alpine AS release
WORKDIR /var/www/current
RUN apk update && apk --no-cache add bash git openssh
COPY --from=base / ./
COPY --from=build /var/www/current/node_modules ./node_modules
COPY --from=build /var/www/current/dist ./dist
COPY ./deploy/secrets.sh ./secrets.sh
ARG node_env=development
ENV NODE_ENV=$node_env
CMD [ "/bin/bash", "-c", "source ./secrets.sh && PORT=80 yarn run start" ]
