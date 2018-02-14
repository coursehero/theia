FROM node:carbon

COPY ./dist /var/www/current/dist
COPY ./src /var/www/current/src
COPY ./public /var/www/current/public
COPY ./views /var/www/current/views
COPY ./node_modules /var/www/current/node_modules
COPY ./theia.config.json /var/www/current/theia.config.json
COPY ./package.json /var/www/current/package.json
COPY ./deploy/secrets.sh /var/www/current/secrets.sh

ARG node_env=development
ENV NODE_ENV=$node_env

WORKDIR /var/www/current
CMD [ "/bin/bash", "-c", "source ./secrets.sh && PORT=80 yarn run start" ]
