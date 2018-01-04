FROM node:carbon

COPY ./dist /var/www/current/dist
COPY ./src /var/www/current/src
COPY ./public /var/www/current/public
COPY ./views /var/www/current/views
COPY ./node_modules /var/www/current/node_modules
COPY ./theia.config.json /var/www/current/theia.config.json
COPY ./package.json /var/www/current/package.json

WORKDIR /var/www/current
CMD NODE_ENV=development PORT=80 yarn run start
