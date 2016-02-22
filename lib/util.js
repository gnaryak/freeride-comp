var
  _ = require("lodash"),
  AWS = require("aws-sdk"),
  S3_BUCKET = "tjfs";

function retrieveFromS3(key, cb) {
  var
    s3 = new AWS.S3(),
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
    cb(null, JSON.parse(data.Body.toString()));
  });
}

function writeToS3(key, content, cb) {
  var
    s3 = new AWS.S3(),
    s3params = {
      Bucket: S3_BUCKET,
      Key: key,
      // ACL: "public-read",
      Body: content
    };
  AWS.config.update({region: "us-east-1"});
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

/**
 * Assign the competitionAge and division to each competitor.
 * The competitors collection will be modified in place, and also returned.
 * This runs synchronously. There is no callback.
 */
function assignCompetitorDivisions(competitors, competitions, divisions, comp, nowarn) {
  console.log("[info] assignCompetitorDivisions");
  // Calculate the competition age of each competitor,
  // then look up their division.
  var
    asOf = new Date(competitions[comp].startDate.substr(0,4) + "-01-01");
  console.log("[info] competition age as of %s", asOf);
  _.each(competitors,
  function assignAgeAndDivision(c) {
    var ageDifMs = asOf.getTime() - (new Date(c.dob)).getTime(),
      ageDate = new Date(ageDifMs); // miliseconds from epoch
    c.competitionAge = Math.abs(ageDate.getUTCFullYear() - 1970);
    // console.log("[debug] %s -> %s years old", c.dob, c.competitionAge);
    var dMatch = _.find(divisions, function findD(d) {
      return (
        (d.gender === "any" || d.gender === c.gender) &&
        d.discipline === c.discipline &&
        d.minAge <= c.competitionAge &&
        d.maxAge >= c.competitionAge);
    });
    if (dMatch) {
      c.division = dMatch.id;
      // console.log("[debug] assigned division %s to %s %s",
      //   c.division, c.firstName, c.lastName);
    } else if (!nowarn) {
      console.log("[warn] no division for %j", c);
    }
  });
  return competitors;
}

module.exports = {
  retrieveFromS3: retrieveFromS3,
  writeToS3: writeToS3,
  assignCompetitorDivisions: assignCompetitorDivisions
};