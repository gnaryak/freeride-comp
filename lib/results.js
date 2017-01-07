"use strict";

const
  async = require("async"),
  _ = require("lodash"),
  sortByOrder = require("lodash.sortbyorder"),
  csv = require("fast-csv"),
  debug = require("debug")("tjfs:results"),
  util = require("./util.js"),
  recalcScores = require("./recalculateScore.js");

function componentScore(a, component, rawResults) {
  var score = _.reduce(rawResults,
    function accumulateResults(resultTotal, result) {
      if (!result[a.bib]) {
        return resultTotal;
      } else {
        return resultTotal + _.reduce(result[a.bib].scores,
        function accumulateScores(scoreTotal, score) {
          return scoreTotal + score[component];
        }, 0);
      }
    }, 0);
  // debug("[debug] %s score for %s=%d", component, a.bib, score);
  return score;
}

/**
 * Break the ties in the athletes' scores using the ties property, and the results.
 * Mutate the athletes parameter.
 */
function breakTies(athletes, ties, results) {
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
    }),
    priorDivision,
    place;
  tbSorts.unshift("score");
  tbSorts.unshift("division");
  var descs = _.times(tbSorts.length, _.constant("desc"));
  athletes = sortByOrder(athletes, tbSorts, descs);
  // Assign place. With tiebreakers, this is simple.
  priorDivision = undefined;
  _.forEach(athletes, function assignPlace(a) {
    if (a.division !== priorDivision) {
      priorDivision = a.division;
      place = 1;
    }
    a.place = place;
    place += 1;
  });
}

/**
 * Tolerate ties in the athletes' scores.
 * Mutate the athletes parameter.
 */
function tolerateTies(athletes) {
  // Sort by score.
  athletes = sortByOrder(athletes, ["division", "score"], ["desc", "desc"]);
  // Assign place
  var
    groupScore,
    athlete,
    pureIx,
    priorDivision,
    place;
  for (var ix = 0, len = athletes.length; ix < len; ix += 1) {
    athlete = athletes[ix];
    if (athlete.division !== priorDivision) {
      groupScore = undefined;
      priorDivision = athlete.division;
      pureIx = 1;
    }
    if (groupScore !== athlete.score) {
      // New score group
      place = pureIx;
      groupScore = athlete.score;
      debug("[debug] new groupScore=%d for %s", groupScore, athlete.bib);
    } else {
      debug("[debug] %s added to group", athlete.bib);
    }
    athletes[ix].place = place;
    pureIx += 1;
  }
}

function conciseOutput(a, runGroups) {
  // debug("[debug] runGroups=%j", runGroups);
  var row =
    [a.place, a.bib, a.firstName + " " + a.lastName, a.team];
  /* eslint-disable lodash/prefer-map */
  _.forEach(runGroups, function runGroupScore(rg) {
  /* eslint-enable lodash/prefer-map */
    row.push(a.scores[rg]);
  });
  row.push(a.score);
  return row;
}

function conciseHeader(runGroups) {
  var header = ["Order", "Bib", "Name", "Team"];
  /* eslint-disable lodash/prefer-map */
  _.forEach(runGroups, function rgHeader(rg) {
  /* eslint-enable lodash/prefer-map */
    header.push(rg);
  });
  header.push("Score");
  return header;
}

function ifsaOutput(a, runGroups) {
  // debug("[debug] runGroups=%j", runGroups);
  var row =
    [a.place, a.bib, a.firstName, a.lastName, a.division, a.ifsaNumber, a.score];
  /* eslint-disable lodash/prefer-map */
  _.forEach(runGroups, function runGroupScore(rg) {
  /* eslint-enable lodash/prefer-map */
    row.push(a.scores[rg]);
  });
  return row;
}

function ifsaHeader(runGroups) {
  var header = ["Place", "Bib", "First Name", "Last Name", "Division", "IFSA Id", "Score"];
  /* eslint-disable lodash/prefer-map */
  _.forEach(runGroups, function rgHeader(rg) {
  /* eslint-enable lodash/prefer-map */
    header.push(rg);
  });
  return header;
}

/**
 * Generate the results for the given comp.
 *
 * The following options are supported:
 * division: If a division is provided, the results are provided just for that
 * division. Otherwise, they are provided for all divisions.
 * format: must be either "array" to respond with a sorted array of JS athlete
 * objects, or "csv" to respond with a csv formatted string with the same data.
 * divisionType: Use the specified type of division. If not provided, then
 * the standard divisions are used. This is used to match to the division.type
 * property to include a specific set of divisions. If this is omitted, then
 * we use the divisions with a blank division.type. This functionality allows
 * us to output IFSA results with different age groups.
 * content: "concise" (default) or "ifsa"
 * ties: "leave" or a comma-separated list of the tiebreaking criteria.
 * Defaults to the competition setting from the spreadsheet/json.
 * scalars: An object with with separate components to scale the components of
 * the score. Omitted components are the same as sending a component of 1.
 * An example scalars object would be: {control: 1.5, technique: 1.25}
 */
/* eslint-disable max-params */
module.exports = function generateResults(
  seriesName, seriesYear, comp, options, callback) {
/* eslint-enable max-params */

  options = options || {};
  options.format = options.format || "csv";
  options.content = options.content || "concise";
  var
    keyPrefix = seriesName + seriesYear + "/";
  async.auto({
    "divisions": function getDivisions(done) {
      util.retrieveFromS3(keyPrefix + "divisions.json",
      function filterDivisions(divErr, divData) {
        if (divErr){
          return done(divErr);
        }
        var selectedDivisions;
        if (options.divisionType) {
          selectedDivisions = _.filter(divData, {type: options.divisionType});
        } else {
          // We use filter instead of reject because we want every division where
          // type is falsy. This is equally awkward to express in "reject" syntax
          // as it is in "filter" syntax.
          /* eslint-disable lodash/prefer-reject */
          selectedDivisions = _.filter(divData, function defaultDivisions(d) {
            return !d.type;
          });
          /* eslint-enable lodash/prefer-reject */
        }
        console.log("selectedDivisions: %j", selectedDivisions);
        done(null, selectedDivisions);
      });
    },

    "competitions": function getCompetitions(done) {
      util.retrieveFromS3(keyPrefix + "competitions.json", done);
    },

    "compdivisions": function getCompDivisions(done) {
      util.retrieveFromS3(keyPrefix + "compdivisions.json", done);
    },

    "competitors": function getCompetitors(done) {
      util.retrieveFromS3(keyPrefix + "competitors.json",
      function handleCompetitors(competitorsErr, competitors) {
        if (competitorsErr) {
          return done(competitorsErr);
        } else if (competitors.length === 0) {
          console.log("no competitors for %s %s %s", seriesName, seriesYear, comp);
          return done(null, competitors);
        }
        // console.log("competitors: %j", competitors);
        var competitorsForComp = _.pickBy(competitors, function forComp(c) {
          var
            allKeys = _.keys(c),
            compKeys = _.filter(allKeys, function findKeysForComp(k) {
              return (_.startsWith(k, comp));
            });
          // console.log("allKeys=%j", allKeys);
          // console.log("compKeys=%j", compKeys);
          return _.some(compKeys, function (k) {
            return c[k] === "y";
          });
        });
        // console.log("competitors for comp: %j", competitorsForComp);
        done(null, competitorsForComp);
      });
    },

    "competitorDivisions": ["divisions", "competitors", "competitions",
      function assignCompetitorDivisions(results, done) {
        util.assignCompetitorDivisions(
          results.competitors, results.competitions, results.divisions, comp);
        done(null, results.competitors);
      }],

    "rawResults": ["compdivisions",
      function getRawResults(results, done) {
        debug("[info] getRawResults");
        var runGroups = _.uniq(_.map(results.compdivisions, "runGroup"));
        // Load the results json in parallel
        async.map(runGroups, function getResult(runGroup, cb) {
          util.retrieveFromS3(keyPrefix + comp + "/results/" + runGroup + ".json",
          function handleResults(rawErr, rawData) {
            if (rawErr) {
              // The error code differs depending on the AWS permissions.
              // Running locally, NoSuchKey is returned.
              // From Lambda, AccessDenied is returned.
              if ((rawErr.code === "NoSuchKey") || (rawErr.code === "AccessDenied")) {
                // The results don't exist. Continue without them.
                debug("[warn] no results for '%s'", runGroup);
                return cb(null, {});
              } else {
                // Some other error
                return cb(rawErr);
              }
            }
            // debug("[debug] rawResults: %j", rawData);
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
      function aggregateResults(results, done) {
        debug("[info] aggregateResults");
        var athletes;
        if (options.division) {
          // Get the athletes in the selected division
          athletes = _.filter(results.competitorDivisions, {division: options.division});
        } else {
          athletes = _.values(results.competitorDivisions);
        }
        // Append the individual scores to the athlete objects,
        // and calculate the total score.
        var
          runGroups = _.keys(results.rawResults),
          hasScalars = Boolean(options.scalars);
        console.log("hasScalars: %s", hasScalars);
        if (hasScalars) {
          console.log("scalars: %j", options.scalars);
        }
        _.forEach(athletes, function appendScores(a) {
          a.scores = {};
          a.score = 0;
          _.forEach(runGroups, function appendScore(rg) {
            var scoreObj = results.rawResults[rg][a.bib];
            if (scoreObj) {
              if (hasScalars) {
                // Recalculate scoreObj.score using the scalars.
                recalcScores(scoreObj, options.scalars);
              }
              a.scores[rg] = _.round(scoreObj.score, 3);
              a.score += scoreObj.score;
            }
          });
          a.score = _.round(a.score, 3);
        });
        var
          ties = options.ties || results.competitions[comp].ties;
        debug("[info] ties->%s", ties);
        if (ties === "leave") {
          // Don't break ties
          tolerateTies(athletes);
        } else {
          // Break ties
          breakTies(athletes, ties, results);
        }
        // Sort the athletes array by the place property
        athletes = _.sortBy(athletes, ["division", "place"]);
        // debug("[debug] json data: %j", athletes);
        done(null, athletes);
      }],

    "csv": ["aggregatedResults",
      function createCSV(results, done) {
        debug("[info] createCSV");
        if (options.format === "csv") {
          var
            runGroups = _.filter(_.keys(results.rawResults), function seekResults(rg) {
              return _.some(results.aggregatedResults, function hasResultForRG(a) {
                return a.scores[rg];
              });
            }),
            output = _.map(results.aggregatedResults, function outputRow(athlete) {
              if (options.content === "concise") {
                return conciseOutput(athlete, runGroups);
              } else if (options.content === "ifsa") {
                return ifsaOutput(athlete, runGroups);
              }
            }),
            header;
          if (options.content === "concise") {
            header = conciseHeader(runGroups);
          } else if (options.content === "ifsa") {
            header = ifsaHeader(runGroups);
          }
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
    if (options.format === "csv") {
      callback(null, results.csv);
    } else {
      callback(null, results.aggregatedResults);
    }
  });
};
