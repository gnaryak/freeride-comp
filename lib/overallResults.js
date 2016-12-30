"use strict";

var
  _ = require("lodash"),
  async = require("async"),
  csv = require("fast-csv"),
  util = require("./util.js"),
  generateResults = require("./results.js"),
  getPoints = require("./points.js");

/**
 * Validate the options.
 */
function validateOptions(options) {
  const
    LEGAL_FORMATS = ["csv", "array", "file"];
  if (!_.includes(LEGAL_FORMATS, options.format)) {
    throw new Error("Illegal format: '" + options.format + "'");
  }
}

/**
 * @param seriesName {String} The name of the series.
 * @param seriesYear {Number} The 4-digit year of the series.
 * @param options {Object}:
 * @param options.format: {String} One of:
 * "csv" (default): Send a CSV string to the callback
 * "array": Send an array of athletes with scores to the callback
 * "file": Write the CSV content to a file and send the filename to the callback
 */
/* eslint-disable max-params */
module.exports = function createOverallResults(
  seriesName, seriesYear, division, options, cb) {
/* eslint-enable max-params */

  var
    keyPrefix = seriesName + seriesYear + "/";

  // Set up default options
  options = options || {};
  options.format = options.format || "csv";
  validateOptions(options);

  async.auto({

    "division": function getDivisions(done) {
      util.retrieveFromS3(keyPrefix + "divisions.json",
      function findDivision(divErr, divData) {
        if (divErr){
          return done(divErr);
        }
        // console.log("divData: %j", divData);
        var theDiv = divData[division];
        if (!theDiv) {
          return done(
            new Error("The division '" + division + "' could not be found"));
        }
        done(null, [theDiv]);
      });
    },

    "competitions": function getCompetitions(done) {
      util.retrieveFromS3(keyPrefix + "competitions.json",
      function sortComps(compErr, comps) {
        var sortedComps = _.sortBy(comps, "startDate");
        // console.log("comps: %j", sortedComps);
        done(compErr, sortedComps);
      });
    },

    "compdivisions": function getCompDivisions(done) {
      util.retrieveFromS3(keyPrefix + "compdivisions.json", done);
    },

    "competitors": function getCompetitors(done) {
      util.retrieveFromS3(keyPrefix + "competitors.json", done);
    },

    "selectedCompetitors": ["division", "competitors", "competitions",
      function assignCompetitorDivisions(results, done) {
        // console.log("competitions: %j", results.competitions);
        var
          comp = _.keys(results.competitions)[0];
        util.assignCompetitorDivisions(
          results.competitors, results.competitions, results.division, comp, true);
        var selectedCompetitors =
          _.filter(results.competitors, {division: division});
        done(null, selectedCompetitors);
      }],

    "compResults": ["competitions",
      function getResults(results, done) {
        async.map(results.competitions,
        function resultsForComp(comp, resultDone) {
          // Get the results
          generateResults(seriesName, seriesYear, comp.id,
          {format: "array", division: division},
          function handleResults(compResultErr, compResult) {
            if (compResultErr) {
              return resultDone(compResultErr);
            }
            // Create a map from bib # to points
            var compPoints = {};
            _.forEach(compResult,
            function getCompPoints(athleteResult, athleteIx) {
              // console.log("athleteResult=%j", athleteResult);
              if (athleteResult.score > 0) {
                compPoints[athleteResult.bib] = getPoints(athleteIx);
              }
            });
            // console.log("compPoints for %s: %j", comp.id, compPoints);
            resultDone(null, compPoints);
          });
        }, done);
      }],

    "aggregatedResults": ["compResults", "selectedCompetitors",
      function assembleResults(results, done) {
        // console.log(results.compResults);
        _.forEach(results.selectedCompetitors, function aggregateResults(athlete) {
          // Add points to athlete objects
          athlete.points = [];
          _.forEach(results.compResults, function aggregateCompResult(cr, crIx) {
            var pts = cr[athlete.bib];
            if (pts) {
              athlete.points[crIx] = pts;
            } else {
              athlete.points[crIx] = 0;
            }
          });
          // Calculate totals from the 3 highest scores
          var sortedPoints = _.clone(athlete.points);
          sortedPoints.sort(function descNumeric(a, b) {
            return b - a;
          });
          athlete.totalPoints = 0;
          for (var ix = 0; ix < 3; ix += 1) {
            if (sortedPoints[ix]) {
              athlete.totalPoints += sortedPoints[ix];
            }
          }
        });
        // Sort
        var sortedResults = _.sortBy(results.selectedCompetitors,
        function sortDescByTotal(athlete) {
          return -athlete.totalPoints;
        });
        // console.log(sortedResults);
        done(null, sortedResults);
      }],

    "csv": ["aggregatedResults",
      function createCSV(results, done) {
        // console.log("aggregatedResults: %j", results.aggregatedResults);
        if (options.format === "array") {
          // We want the data in an array. Do nothing.
          return done(null);
        }
        var
          output = _.map(results.aggregatedResults,
          function outputRow(athlete, athleteIx) {
            var
              athleteRow = [(athleteIx + 1), athlete.bib, athlete.lastName,
                athlete.firstName, athlete.team];
            /* eslint-disable lodash/prefer-map */
            _.forEach(athlete.points, function outputPoints(pts) {
            /* eslint-enable lodash/prefer-map */
              athleteRow.push(pts);
            });
            athleteRow.push(athlete.totalPoints);
            return athleteRow;
          }),
          headerRow = ["Place", "Bib", "Last Name", "First Name", "Team"];
        /* eslint-disable lodash/prefer-map */
        _.forEach(results.competitions, function buildHeader(comp) {
        /* eslint-enable lodash/prefer-map */
          headerRow.push(comp.name);
        });
        headerRow.push("Total Points");
        output.unshift(headerRow);
        console.log("csv output: %j", output);
        if (options.format === "file") {
          var filename = "overallResults-" + division + ".csv";
          csv
            .writeToPath(filename, output, {headers: true})
            .on("finish", function written() {
              done(null, filename);
            });
        } else if (options.format === "csv") {
          csv.writeToString(output, {headers: true}, done);
        }
      }]

  },
  function finish(finishErr, results) {
    if (finishErr) {
      return cb(finishErr);
    } else if (options.format === "array") {
      return cb(null, results.aggregatedResults);
    } else {
      return cb(null, results.csv);
    }
  });
};
