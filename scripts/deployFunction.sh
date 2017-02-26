#!/bin/bash

if [ -z "$1" ]
  then
    echo "The name of the function is a required argument (stage is optional)"
    exit 1
fi

if [[ "$2" != "" ]]; then
    STAGE="$2"
else
    STAGE=production
fi

echo deploying function $1 to stage $STAGE
sls deploy function -f $1 -r us-west-2 -s $STAGE
