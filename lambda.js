var debug = require("debug")("tjfs:lambda"),
  createStartList = require("./lib/startList.js"),
  createResults = require("./lib/results.js");

debug("[info] loading tjfs lambda handler");

function processStartList(evt, context) {
  debug("[info] processStartList");
  var
    rerandomize = (evt.rerandomize === "true"),
    lookup = (evt.lookup === "true");
  createStartList(
    evt.seriesId, evt.seriesYear, evt.compId, evt.dateString, lookup, rerandomize,
  function handleStartList(err, startList) {
    if (err) {
      debug("[error] %s, %j", err.message, err);
      return context.done({error: err.message, detail: err});
    }
    debug("[info] success: %s", startList);
    context.done(null, {csv: startList});
  });
}

function processResults(evt, context) {
  debug("[info] processResults");
  createResults(evt.seriesId, evt.seriesYear, evt.compId, evt.division,
  function handleResults(err, results) {
    if (err) {
      debug("[error] %s, %j", err.message, err);
      return context.done({error: err.message, detail: err});
    }
    debug("[info] success: %s", results);
    context.done(null, {csv: results});
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
  debug("[info] received event: %s", JSON.stringify(event, null, 2));
  var operation = event.operation;
  switch (operation) {
    case "startList":
      processStartList(event, context);
      break;
    case "results":
      processResults(event, context);
      break;
    case "ping":
      context.done(null, "pong");
      break;
    default:
      context.done(new Error("Unsupported operation \"" + operation + "\""));
  }
};