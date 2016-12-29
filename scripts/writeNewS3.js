"use strict";
// Run this with the env var AWS_PROFILE=serverlessTahoeFreeride
const
  AWS = require("aws-sdk"),
  s3 = new AWS.S3(),
  fs = require("fs"),
  async = require("async"),
  S3_BUCKET = "compdata",
  CONTENT_DIR = "s3content";

function writeToS3(key, content, cb) {
  var
    s3params = {
      Bucket: S3_BUCKET,
      Key: key,
      // ACL: "public-read",
      Body: content
    };
  AWS.config.update({region: "us-west-2"});
  console.log("[info] writing %s bytes to %s/%s",
    s3params.Body.length, s3params.Bucket, s3params.Key);
  s3.putObject(s3params, function handleS3Write(err, data) {
    if (err) {
      console.log("[error] writing %s:/%s from s3: %s. %j",
        S3_BUCKET, key, err.message, err);
      return cb(err);
    }
    console.log("[info] wrote %s: %j", key, data);
    cb();
  });
}

function readFromDisk(filename, callback) {
  fs.readFile(filename, (readErr, content) => {
    callback(readErr, content);
  });
}

function listFiles(callback) {
  fs.readdir(CONTENT_DIR, (dirErr, files) => {
    if (dirErr) {
      console.log("error reading %s: %s, %j", CONTENT_DIR, dirErr.message, dirErr);
    } else {
      console.log("files: %j", files);
    }
    return callback(dirErr, files);
  });
}

// Main execution path
async.waterfall([

  listFiles,

  (filenames, callback) => {
    async.each(filenames, (filename, cb) => {
      readFromDisk(CONTENT_DIR + "/" + filename, (readErr, content) => {
        if (readErr) {
          return cb(readErr);
        }
        const
          key = filename.replace(/__/gi, "/");
        writeToS3(key, content, cb);
      });
    }, callback);
  }

],
(waterfallErr) => {
  if (waterfallErr) {
    console.log("fail");
  } else {
    console.log("success");
  }
});
