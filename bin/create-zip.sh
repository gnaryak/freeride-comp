#!/bin/bash

rm tjfs.zip
zip -r tjfs.zip holamundo.js lambda.js lib package.json \
node_modules/.bin node_modules/async node_modules/aws-sdk node_modules/debug \
node_modules/express node_modules/fast-csv node_modules/lodash \
node_modules/lodash.sortbyorder