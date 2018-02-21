#!/bin/bash

export THEIA_AUTH_SECRET=$(cat /run/secrets/api.authKey)
export THEIA_ROLLBAR_TOKEN=$(cat /run/secrets/theia.rollbar.token)
export THEIA_S3_BUCKET=$(cat /run/secrets/theia.s3.bucket)

if [ ! -f /root/.aws/credentials ]; then
  mkdir -p /root/.aws
  echo "[default]" >> /root/.aws/credentials
  echo -n "aws_access_key_id = " >> /root/.aws/credentials
  echo $(cat /run/secrets/aws.key) >> /root/.aws/credentials
  echo -n "aws_secret_access_key = " >> /root/.aws/credentials
  echo  $(cat /run/secrets/aws.secret) >> /root/.aws/credentials
fi

true
