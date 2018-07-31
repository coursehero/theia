# temporary Dockerfile. Don't care about minimizing the size.

FROM node:10.7-alpine
WORKDIR /theia

RUN apk update && apk --no-cache add python make g++ git bash openssh

COPY ./package.json ./
COPY ./yarn.lock ./
COPY ./public ./public
COPY ./views ./views

RUN yarn install
COPY ./tsconfig.json ./
COPY ./tslint.json ./
COPY ./src ./src
RUN yarn lint
RUN yarn test
RUN yarn build
# this prunes dev deps
RUN yarn install --production

COPY ./deploy/secrets.sh ./secrets.sh
ARG theia_env=development
ENV THEIA_ENV=$theia_env
ENV AWS_SDK_LOAD_CONFIG=true
CMD [ "/bin/bash", "-c", "source ./secrets.sh && PORT=80 yarn start" ]

# Use the following when docker on Jenkins has been upgraded.

# FROM scratch as base
# RUN mkdir ./theia
# COPY ./package.json ./
# COPY ./yarn.lock ./
# COPY ./public ./public
# COPY ./views ./views

# FROM node:10.7-alpine as build
# WORKDIR /build-theia
# RUN apk update && apk --no-cache add python make g++ git
# COPY --from=base / ./
# RUN yarn install
# COPY ./tsconfig.json ./
# COPY ./tslint.json ./
# COPY ./src ./src
# RUN yarn lint
# RUN yarn test
# RUN yarn build
# # this prunes dev deps
# RUN yarn install --production

# FROM node:10.7-alpine AS release
# WORKDIR /theia
# RUN apk update && apk --no-cache add bash git openssh
# COPY --from=base / ./
# COPY --from=build /build-theia/node_modules ./node_modules
# COPY --from=build /build-theia/dist ./dist
# COPY ./deploy/secrets.sh ./secrets.sh
# ARG theia_env=development
# ENV THEIA_ENV=$theia_env
# CMD [ "/bin/bash", "-c", "source ./secrets.sh && PORT=80 yarn start" ]
