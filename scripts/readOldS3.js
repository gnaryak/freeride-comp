"use strict";

const
  AWS = require("aws-sdk"),
  s3 = new AWS.S3(),
  fs = require("fs"),
  _ = require("lodash"),
  async = require("async"),
  S3_BUCKET = "tjfs";

// Run this with the env var AWS_PROFILE=gnaryakAdmin
function retrieveFromS3(key, cb) {
  const
    s3params = {
      Bucket: S3_BUCKET,
      Key: key
    };
  AWS.config.update({region: "us-east-1"});
  console.log("[info] retrieving %j", s3params);
  s3.getObject(s3params, function handleS3File(err, data) {
    if (err) {
      console.log("[error] Error getting %s:/%s from s3: %s. %j",
        S3_BUCKET, key, err.message, err);
      return cb(err, null);
    }
    var content = JSON.parse(data.Body.toString());
    console.log("content=%s", JSON.stringify(content));
    cb(null, content);
  });
}

function writeToDisk(options, cb) {
  const
    filename = "s3content/" + options.key.replace(/\//gi, "__");
  options.content = JSON.stringify(options.content);
  // console.log("%s\n%s", options.key, options.content);
  fs.writeFile(filename, options.content, (writeErr) => {
    if (writeErr) {
      console.log("error writing %s: %s, %j", options.key, writeErr.message, writeErr);
    } else {
      console.log("wrote %s", filename);
    }
    cb(writeErr);
  });
}

function getAllKeysInBucket(cb) {
  const
    s3params = {
      Bucket: S3_BUCKET
    };
  AWS.config.update({region: "us-east-1"});
  s3.listObjectsV2(s3params, (listErr, response) => {
    if (listErr) {
      console.log("error listing objects: %s, %j", listErr.message, listErr);
      return cb(listErr);
    }
    // console.log("response: %s", JSON.stringify(response, null, 2));
    var keys = _.map(response.Contents, "Key");
    keys = _.filter(keys, (key) => {return _.endsWith(key, ".json")});
    console.log("keys=%j", keys);
    return cb(null, keys);
  });
}

// Main body of the file
async.waterfall([

  getAllKeysInBucket,

  (keys, callback) => {
    async.each(keys, (key, cb) => {
      retrieveFromS3(key, (retrieveErr, content) => {
        if (retrieveErr) {
          console.log("error retrieving key %s: %s, %j", key, retrieveErr.message, retrieveErr);
          return cb(retrieveErr);
        }
        writeToDisk({key: key, content: content}, cb);
      });
    },
    (keyErr) => {
      if (keyErr) {
        console.log("error: %s, %j", keyErr.message, keyErr);
      }
      callback(keyErr);
    }
  );
  }

], (doneErr) => {
  if (doneErr) {
    console.log("error: %s, %j", doneErr.message, doneErr);
  }
  console.log("all done");
});
