var
  async = require("async"),
  _ = require("lodash"),
  csv = require("fast-csv"),
  debug = require("debug")("tjfs:results"),
  util = require("./util.js");

/**
 * Generate the detailed results for the given rungroup.
 */
module.exports = function generateDetailedResults(
  seriesName, seriesYear, comp, runGroup, options, callback) {

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
    function assignCompetitorDivisions(done, results) {
      util.assignCompetitorDivisions(
        results.competitors, results.competitions, results.divisions, comp);
      done(null, results.competitors);
    }],

    "rawResults": ["compdivisions",
    function getRawResults(done, results) {
      debug("[info] getRawResults");
      util.retrieveFromS3(keyPrefix + comp + "/results/" + runGroup + ".json", done);
    }],

    "csv": ["rawResults", "competitorDivisions",
    function sortResults(done, results) {
      var
        elements = ["score", "line", "control", "fluidity", "technique", "style"],
        as = results.competitorDivisions,
        anR,
        output = _.map(results.rawResults, function mapResult(r, bib) {
          if (!anR) {
            anR = r;
          }
          var
            a = as[bib],
            row = [a.division, bib, a.firstName + " " + a.lastName, a.team, r.score];
          _.each(r.scores, function judgeScore(score) {
            _.each(elements, function elementScore(element) {
              row.push(score[element]);
            });
          });
          return row;
        }),
        header = ["Division", "Bib", "Name", "Team", "Score"];
      _.each(anR.scores, function judgeHeader(score, judgeIx) {
        _.each(elements, function elementHeader(element) {
          header.push("judge" + (judgeIx + 1) + " " + element);
        });
      });
      output = _.sortByOrder(output, [0, 4], ["asc", "desc"]);
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