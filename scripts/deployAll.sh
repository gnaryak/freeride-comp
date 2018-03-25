#!/bin/bash

if [[ "$1" != "" ]]; then
    STAGE="$1"
else
    STAGE=production
fi

echo deploying to stage $STAGE
sls deploy -r us-west-2 -s $STAGE
