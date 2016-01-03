var
  async = require("async"),
  _ = require("lodash"),
  csv = require("fast-csv"),
  debug = require("debug")("tjfs:results"),
  util = require("./util.js");

function componentScore(a, component, rawResults) {
  var score = _.reduce(rawResults,
    function accumulateResults(resultTotal, result) {
      if (!result[a.bib]) {
        return resultTotal;
      } else {
        return resultTotal + _.reduce(result[a.bib].scores, function accumulateScores(scoreTotal, score) {
          return scoreTotal + score[component];
        }, 0);
      }
    }, 0);
  // debug("[debug] %s score for %s=%d", component, a.bib, score);
  return score;
}

/**
 * Generate the results for the given comp and division.
 * format must be either "array" to respond with a sorted array of JS athlete
 * objects, or "csv" to respond with a csv formatted string with the same data.
 */
module.exports = function generateResults(
  seriesName, seriesYear, comp, division, format, callback) {

  var
    keyPrefix = seriesName + seriesYear + "/";
  if (format !== "array") {
    format = "csv";
  }
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
        util.retrieveFromS3(keyPrefix + comp + "/results/" + runGroup + ".json",
        function handleResults(rawErr, rawData) {
          if (rawErr) {
            if (rawErr.code === "NoSuchKey") {
              // The results don't exist. Continue without them.
              debug("[warn] no results for %s", runGroup);
              return cb(null, {});
            } else {
              // Some other error
              return cb(rawErr);
            }
          }
          return cb(null, rawData);
        });
      },
      function assembleResults(mapErr, mapResults) {
        if (mapErr) {
          done(mapErr);
        } else {
          done(null, _.zipObject(runGroups, mapResults));
        }
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
        var cnt = 0;
        _.each(runGroups, function appendScore(rg) {
          var scoreObj = results.rawResults[rg][a.bib];
          if (scoreObj) {
            a.scores[rg] = scoreObj.score;
            a.score += scoreObj.score;
            cnt += 1;
          }
        });
        if (cnt > 0) {
          a.score /= cnt;
        }
      });
      var ties = results.competitions[comp].ties;
      // ties = "ave";
      debug("[debug] ties->%s", ties);
      if (["ave", "max"].indexOf(ties) > -1) {
        // Don't break ties
        // Sort by score.
        athletes = _.sortByOrder(athletes, ["score"], ["desc"]);
        // Assign place
        var
          place,
          groupScore,
          athlete;
        for (var ix = 0, len = athletes.length; ix < len; ix += 1) {
          athlete = athletes[ix];
          if (groupScore !== athlete.score) {
            // New score group
            place = ix + 1;
            groupScore = athlete.score;
            debug("[debug] new groupScore=%d for %s", groupScore, athlete.bib);
          } else {
            debug("[debug] %s added to group", athlete.bib);
          }
          athletes[ix].place = place;
        }
      } else {
        // Break ties
        var
          sortByLine = function (a) {
            return componentScore(a, "line", results.rawResults);
          },
          sortByTechnique = function (a) {
            return componentScore(a, "technique", results.rawResults);
          },
          sortByControl = function (a) {
            return componentScore(a, "control", results.rawResults);
          },
          sortByFluidity = function (a) {
            return componentScore(a, "fluidity", results.rawResults);
          },
          sortByStyle = function (a) {
            return componentScore(a, "style", results.rawResults);
          },
          sortMap = {
            "line": sortByLine,
            "technique": sortByTechnique,
            "control": sortByControl,
            "fluidity": sortByFluidity,
            "style": sortByStyle
          },
          tbFields = ties.split(","),
          tbSorts = _.map(tbFields, function getTbFn(tbField) {
            return sortMap[tbField];
          });
        tbSorts.unshift("score");
        var descs = _.map(tbSorts, function createDesc(tbs) { return "desc"; });
        athletes = _.sortByOrder(athletes, tbSorts, descs);
        // Assign place. With tiebreakers, this is simple.
        _.each(athletes, function assignPlace(a, ix) {
          a.place = ix + 1;
        });
      }
      done(null, athletes);
    }],

    "csv": ["aggregatedResults",
    function createCSV(done, results) {
      debug("[info] createCSV");
      if (format === "csv") {
        var
          dates = _.keys(results.rawResults),
          output = _.map(results.aggregatedResults, function csvify(a) {
            var row =
              [a.place, a.bib, a.firstName + " " + a.lastName, a.division, a.team];
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
      } else {
        debug("[info] returning an array so skipping csv generation");
        done();
      }
    }]

  },
  function wrapup(wrapupErr, results) {
    debug("[info] wrapup");
    if (wrapupErr) {
      return callback(wrapupErr);
    }
    if (format === "csv") {
      callback(null, results.csv);
    } else {
      callback(null, results.aggregatedResults);
    }
  });
};