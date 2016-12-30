"use strict";

const
  async = require("async"),
  _ = require("lodash"),
  sortByOrder = require("lodash.sortbyorder"),
  csv = require("fast-csv"),
  debug = require("debug")("tjfs:results"),
  util = require("./util.js"),
  recalcScores = require("./recalculateScore.js");

/**
 * Generate the detailed results for the given rungroup.
 * @param options Supported options are:
 * writeToFile: {Boolean} True to write to a file; false (default) to send a csv
 * string to the callback.
 * scalars: {Object} An object with with separate components to scale the components of
 * the score. Omitted components are the same as sending a component of 1.
 * An example scalars object would be: {control: 1.5, technique: 1.25}
 */
/* eslint-disable max-params */
module.exports = function generateDetailedResults(
  seriesName, seriesYear, comp, runGroup, options, callback) {
/* eslint-enable max-params */

  options = options || {};
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
      function assignCompetitorDivisions(results, done) {
        util.assignCompetitorDivisions(
          results.competitors, results.competitions, results.divisions, comp);
        done(null, results.competitors);
      }],

    "rawResults": ["compdivisions",
      function getRawResults(results, done) {
        debug("[info] getRawResults");
        util.retrieveFromS3(keyPrefix + comp + "/results/" + runGroup + ".json", done);
      }],

    "csv": ["rawResults", "competitorDivisions",
      function sortResults(results, done) {
        var
          elements = ["score", "line", "control", "fluidity", "technique", "style"],
          as = results.competitorDivisions,
          anR,
          hasScalars = (options.scalars),
          output = _.map(results.rawResults, function mapResult(r, bib) {
            if (!anR) {
              anR = r;
            }
            // console.log("bib=", bib);
            var
              a = as[bib];
            if (!a) {
              return [];
            }
            if (hasScalars) {
              // Recalculate scoreObj.score using the scalars.
              recalcScores(r, options.scalars);
            }
            var row = [a.division, bib, a.firstName + " " + a.lastName, a.team, _.round(r.score, 3)];
            _.forEach(r.scores, function judgeScore(score) {
              /* eslint-disable lodash/prefer-map */
              _.forEach(elements, function elementScore(element) {
              /* eslint-enable lodash/prefer-map */
                row.push(score[element]);
              });
            });
            return row;
          }),
          header = ["Division", "Bib", "Name", "Team", "Score"];
        _.forEach(anR.scores, function judgeHeader(score, judgeIx) {
          /* eslint-disable lodash/prefer-map */
          _.forEach(elements, function elementHeader(element) {
          /* eslint-enable lodash/prefer-map */
            header.push("judge" + (judgeIx + 1) + " " + element);
          });
        });
        output = sortByOrder(output, [0, 4], ["asc", "desc"]);
        output.unshift(header);
        if (options.writeToFile) {
          csv.writeToPath("details.csv", output, {headers: true})
            .on("finish", function () {
              csv.writeToString(output, {headers: true}, done);
            });
        } else {
          csv.writeToString(output, {headers: true}, done);
        }
      }]

  },
  function wrapup(wrapupErr, results) {
    debug("[info] wrapup");
    if (wrapupErr) {
      return callback(wrapupErr);
    }
    return callback(null, results.csv);
  });
};
