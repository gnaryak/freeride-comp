var
  async = require("async"),
  _ = require("lodash"),
  csv = require("fast-csv"),
  debug = require("debug")("tjfs:results"),
  util = require("./util.js");

/**
 * Generate the results for the given comp and division.
 */
module.exports = function generateResults(
  seriesName, seriesYear, comp, division, callback) {

  var
    keyPrefix = seriesName + seriesYear + "/";
  async.auto({
    "divisions": function getDivisions(done) {
      util.retrieveFromS3(keyPrefix + "divisions.json", done);
    },

    "competitions": function getCompetitions(done) {
      util.retrieveFromS3(keyPrefix + "competitions.json", done);
    },

    "compdivisions": function getCompDivisions(done) {
      util.retrieveFromS3(keyPrefix + "compdivisions.json", done);
    },

    "competitors": function getCompetitors(done) {
      util.retrieveFromS3(keyPrefix + "competitors.json", done);
    },

    "competitorDivisions": ["divisions", "competitors", "competitions",
    function assignCompetitorDivisions(done, results) {
      util.assignCompetitorDivisions(
        results.competitors, results.competitions, results.divisions, comp);
      done(null, results.competitors);
    }],

    "rawResults": ["compdivisions",
    function getResults(done, results) {
      debug("[info] getResults");
      var runGroups = _.uniq(_.pluck(results.compdivisions, "runGroup"));
      // Load the results json in parallel
      async.map(runGroups, function getResult(runGroup, cb) {
        util.retrieveFromS3(keyPrefix + comp + "/results/" + runGroup + ".json", cb);
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
        a.score /= runGroups.length;
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