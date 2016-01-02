var
  async = require("async"),
  _ = require("lodash"),
  csv = require("fast-csv"),
  debug = require("debug")("tjfs:results"),
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
  debug("[info] retrieving %j", s3params);
  s3.getObject(s3params, function handleS3File(err, data) {
    if (err) {
      debug("[error] Error getting %s:/%s from s3: %s. %j",
        S3_BUCKET, key, err.message, err);
      return cb(err, null);
    }
    cb(null, JSON.parse(data.Body.toString()));
  });
}

/**
 * Generate the results for the given comp and division.
 */
module.exports = function generateResults(
  seriesName, seriesYear, comp, division, callback) {

  var
    keyPrefix = seriesName + seriesYear + "/";
  async.auto({
    "divisions": function getDivisions(done) {
      retrieveFromS3(keyPrefix + "divisions.json", done);
    },

    "competitions": function getCompetitions(done) {
      retrieveFromS3(keyPrefix + "competitions.json", done);
    },

    "compdivisions": function getCompDivisions(done) {
      retrieveFromS3(keyPrefix + "compdivisions.json", done);
    },

    "competitors": function getCompetitors(done) {
      retrieveFromS3(keyPrefix + "competitors.json", done);
    },

    "competitorDivisions": ["divisions", "competitors", "competitions",
    function assignCompetitorDivisions(done, results) {
      debug("[info] assignCompetitorDivisions");
      // Calculate the competition age of each competitor,
      // then look up their division.
      var
        asOf = new Date(results.competitions[comp].startDate.substr(0,4) + "-01-01");
      debug("[info] competition age as of %s", asOf);
      _.each(results.competitors,
      function assignAgeAndDivision(c) {
        var ageDifMs = asOf.getTime() - (new Date(c.dob)).getTime(),
          ageDate = new Date(ageDifMs); // miliseconds from epoch
        c.competitionAge = Math.abs(ageDate.getUTCFullYear() - 1970);
        debug("[debug] %s -> %s years old", c.dob, c.competitionAge);
        var dMatch = _.find(results.divisions, function findD(d) {
          return (
            d.gender === c.gender &&
            d.discipline === c.discipline &&
            d.minAge <= c.competitionAge &&
            d.maxAge >= c.competitionAge);
        });
        if (dMatch) {
          c.division = dMatch.id;
          debug("[debug] assigned division %s to %s %s",
            c.division, c.firstName, c.lastName);
        } else {
          debug("[warn] no division for %j", c);
        }
      });
      done(null, results.competitors);
    }],

    "rawResults": ["compdivisions",
    function getResults(done, results) {
      debug("[info] getResults");
      var runGroups = _.uniq(_.pluck(results.compdivisions, "runGroup"));
      // Load the results json in parallel
      async.map(runGroups, function getResult(runGroup, cb) {
        retrieveFromS3(keyPrefix + comp + "/results/" + runGroup + ".json", cb);
      },
      function assembleResults(mapErr, mapResults) {
        done(mapErr, _.zipObject(runGroups, mapResults));
      });
    }],

    "aggregatedResults": ["rawResults", "competitorDivisions",
    function aggregateResults(done, results) {
      debug("[info] aggregateResults");
      // Get the athletes in the selected division
      var athletes = _.filter(results.competitorDivisions, {division: division});
      // Append the individual scores to the athlete objects,
      // and calculate the total score.
      var runGroups = _.keys(results.rawResults);
      _.each(athletes, function appendScores(a) {
        a.scores = {};
        a.score = 0;
        _.each(runGroups, function appendScore(rg) {
          var scoreObj = results.rawResults[rg][a.bib];
          if (scoreObj) {
            a.scores[rg] = scoreObj.score;
            a.score += scoreObj.score;
          }
        });
      });
      // Sort
      athletes = _.sortByOrder(athletes, ["score"], ["desc"]);
      done(null, athletes);
    }],

    "csv": ["aggregatedResults",
    function createCSV(done, results) {
      debug("[info] createCSV");
      var
        dates = _.keys(results.rawResults),
        ix = 0,
        output = _.map(results.aggregatedResults, function csvify(a) {
          ix += 1;
          var row =
            [ix, a.bib, a.firstName + " " + a.lastName, a.division, a.team];
          _.each(dates, function dateScore(d) {
            row.push(a.scores[d]);
          });
          row.push(a.score);
          return row;
        }),
        header = ["Order", "Bib", "Name", "Division", "Team"];
      _.each(dates, function dateHeader(d) {
        header.push(d);
      });
      header.push("Score");
      output.unshift(header);
      csv.writeToString(output, {headers: true}, done);
    }]

  },
  function wrapup(wrapupErr, results) {
    debug("[info] wrapup");
    if (wrapupErr) {
      return callback(wrapupErr);
    }
    callback(null, results.csv);
  });
};