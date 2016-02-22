var
  _ = require("lodash"),
  async = require("async"),
  csv = require("fast-csv"),
  util = require("./util.js"),
  generateResults = require("./results.js"),
  getPoints = require("./points.js");

/**
 * @param seriesName {String} The name of the series.
 * @param seriesYear {Number} The 4-digit year of the series.
 * @param options {Object}:
 * @param options.format: "csv" or "array"
 */
module.exports = function createOverallResults(
  seriesName, seriesYear, division, options, cb) {

  var
    keyPrefix = seriesName + seriesYear + "/";

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
    function assignCompetitorDivisions(done, results) {
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
    function getResults(done, results) {
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
    function assembleResults(done, results) {
      // console.log(results.compResults);
      _.forEach(results.selectedCompetitors, function aggregateResults(athlete) {
        // Add points to athlete objects
        athlete.totalPoints = 0;
        athlete.points = [];
        _.forEach(results.compResults, function aggregateCompResult(cr, crIx) {
          var pts = cr[athlete.bib];
          if (pts) {
            athlete.totalPoints += pts;
            athlete.points[crIx] = pts;
          } else {
            athlete.points[crIx] = 0;
          }
        });
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
    function createCSV(done, results) {
      // console.log("aggregatedResults: %j", results.aggregatedResults);
      var
        output = _.map(results.aggregatedResults,
        function outputRow(athlete, athleteIx) {
          var
            athleteRow = [(athleteIx + 1), athlete.bib, athlete.lastName,
              athlete.firstName, athlete.team];
          _.forEach(athlete.points, function outputPoints(pts) {
            athleteRow.push(pts);
          });
          athleteRow.push(athlete.totalPoints);
          return athleteRow;
        }),
        headerRow = ["Place", "Bib", "Last Name", "First Name", "Team"];
      _.forEach(results.competitions, function buildHeader(comp) {
        headerRow.push(comp.name);
      });
      headerRow.push("Total Points");
      output.unshift(headerRow);
      console.log("csv output: %j", output);
      csv
        .writeToPath("overallResults-" + division + ".csv", output, {headers: true})
        .on("finish", function written() {
          done();
        });
    }]

  },
  function finish(finishErr, results) {
    if (finishErr) {
      return cb(finishErr);
    }
    // console.log("compDiv: %j", results.selectedCompetitors);
    cb(null, results.selectedCompetitors);
  });
  // Get all the comps in the series
  // Sort the comps by date

  // For each comp:
  //   Get results into a map. Keys are bib numbers. Values are points.

  // Aggregate the comp results into the athlete objects

  // Add the comp results to get totals, in the athlete objects

  // Sort by totals, descending

  // Create CSV

};