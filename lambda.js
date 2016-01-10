var
  _ = require("lodash"),
  createStartList = require("./lib/startList.js"),
  createResults = require("./lib/results.js"),
  createResultDetails = require("./lib/resultDetails.js"),
  validateResults = require("./lib/validateResults.js");

console.log("[info] loading tjfs lambda handler");

function processStartList(evt, context) {
  console.log("[info] processStartList");
  var
    rerandomize = (evt.rerandomize === "true"),
    lookup = (evt.lookup === "true"),
    options = {lookup: lookup, rerandomize: rerandomize};
  createStartList(
    evt.seriesId, evt.seriesYear, evt.compId, evt.runGroup, options,
  function handleStartList(err, startList) {
    if (err) {
      console.log("[error] %s, %j", err.message, err);
      return context.done({error: err.message, detail: err});
    }
    console.log("[info] success: %s", startList);
    context.done(null, {csv: startList});
  });
}

function processResults(evt, context) {
  console.log("[info] processResults");
  var options = {format: "csv"};
  if (evt.division) {
    options.division = evt.division;
  }
  if (evt.divisionType) {
    options.divisionType = evt.divisionType;
  }
  if (evt.content) {
    options.content = evt.content;
  }
  if (evt.ties) {
    options.ties = evt.ties;
  }
  createResults(evt.seriesId, evt.seriesYear, evt.compId, options,
  function handleResults(err, results) {
    if (err) {
      console.log("[error] %s, %j", err.message, err);
      return context.done({error: err.message, detail: err});
    }
    console.log("[info] success: %s", results);
    context.done(null, {csv: results});
  });
}

function processResultDetails(evt, context) {
  console.log("[info] processResultDetails");
  createResultDetails(evt.seriesId, evt.seriesYear, evt.compId, evt.runGroup, {},
  function handleResultDetails(err, resultDetails) {
    if (err) {
      console.log("[error] %s, %j", err.message, err);
      return context.done({error: err.message, detail: err});
    }
    console.log("[info] success: %s", resultDetails);
    context.done(null, {csv: resultDetails});
  });
}

function processValidateResults(evt, context) {
  console.log("[info] processValidateResults");
  validateResults(evt.seriesId, evt.seriesYear, evt.compId, evt.runGroup,
  function handleValidateResults(err, errors) {
    if (err) {
      console.log("[error] %s, %j", err.message, err);
      return context.done({error: err.message, detail: err});
    }
    console.log("[info] successful validation: %d errors found", errors.length);
    var output = _.map(errors, function mapError(e) {
      var
        noDetail = (JSON.stringify(e) === "{}"),
        outE = {message: e.message};
      if (!noDetail) {
        outE.detail = e;
      }
      if (e.source) {
        outE.sourceMessage = e.source.message;
        outE.sourceDetail = e.source;
      }
      return outE;
    });
    context.done(null, output);
  });
}

/**
 * This is a lambda function that provides access to the other functionality
 * of this module.
 * Provide an event that contains the following keys:
 *
 *   - operation: one of the operations in the switch statement below
 *   - payload: a parameter to pass to the operation being performed
 */
exports.handler = function(event, context) {
  console.log("[info] received event: %s", JSON.stringify(event, null, 2));
  var operation = event.operation;
  switch (operation) {
    case "startList":
      processStartList(event, context);
      break;
    case "results":
      processResults(event, context);
      break;
    case "resultDetails":
      processResultDetails(event, context);
      break;
    case "validateResults":
      processValidateResults(event, context);
      break;
    case "ping":
      context.done(null, "pong");
      break;
    default:
      context.done(new Error("Unsupported operation \"" + operation + "\""));
  }
};