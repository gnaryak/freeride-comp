"use strict";

const
  _ = require("lodash"),
  createStartList = require("./lib/startList.js"),
  createResults = require("./lib/results.js"),
  createResultDetails = require("./lib/resultDetails.js"),
  validateResults = require("./lib/validateResults.js"),
  createOverallResults = require("./lib/overallResults.js");

console.log("[info] loading tahoe freeride lambda handler");

/**
 * Test "hello" function.
 */
const sayHello = (event, context, callback) => {
  console.log("event=%j", event);
  console.log("context=%j", context);
  const response = {
    statusCode: 200,
    body: JSON.stringify({
      message: "Go Serverless v1.4! Your function executed successfully!",
      input: event
    })
  };
  callback(null, response);
};

/**
 * Create a start list.
 */
const processStartList = (evt, context, callback) => {
  console.log("[info] processStartList: evt=%j", evt);
  var
    rerandomize = (evt.query.rerandomize === "true"),
    lookup = (evt.query.lookup === "true"),
    options = {lookup: lookup, rerandomize: rerandomize};
  createStartList(
    evt.query.seriesId, evt.query.seriesYear, evt.query.compId, evt.query.runGroup, options,
  function handleStartList(err, startList) {
    if (err) {
      console.log("[error] %s, %j", err.message, err);
      return callback({error: err.message, detail: err});
    }
    console.log("[info] success: %s", startList);
    callback(null, {csv: startList});
  });
}

/**
 * Create a component scalar object from the event.
 * If there are no component scalars, return undefined.
 */
function createComponentScalars(evtQuery) {
  var
    has = false,
    scalars = {},
    props = ["line", "control", "technique", "fluidity", "style"];
  _.forEach(props, function checkProp(prop) {
    var scalarName = prop + "Scalar";
    if (evtQuery[scalarName]) {
      has = true;
      scalars[prop] = evtQuery[scalarName];
    }
  });
  return has ? scalars : undefined;
}

/**
 * Process a results request.
 */
function processResults(evt, context, callback) {
  console.log("[info] processResults");
  var
    options = {format: "csv"},
    scalars = createComponentScalars(evt.query);
  if (scalars) {
    options.scalars = scalars;
  }
  if (evt.query.division) {
    options.division = evt.query.division;
  }
  if (evt.query.divisionType) {
    options.divisionType = evt.query.divisionType;
  }
  if (evt.query.content) {
    options.content = evt.query.content;
  }
  if (evt.query.ties) {
    options.ties = evt.query.ties;
  }
  createResults(evt.query.seriesId, evt.query.seriesYear, evt.query.compId, options,
  function handleResults(err, results) {
    if (err) {
      console.log("[error] %s, %j", err.message, err);
      callback({error: err.message, detail: err});
    }
    console.log("[info] success: %s", results);
    callback(null, {csv: results});
  });
}

/**
 * Generate result details.
 */
function processResultDetails(evt, context, callback) {
  console.log("[info] processResultDetails");
  var
    options = {},
    scalars = createComponentScalars(evt.query);
  if (scalars) {
    options.scalars = scalars;
  }
  createResultDetails(evt.query.seriesId, evt.query.seriesYear, evt.query.compId, evt.query.runGroup, options,
  function handleResultDetails(err, resultDetails) {
    if (err) {
      console.log("[error] %s, %j", err.message, err);
      return callback({error: err.message, detail: err});
    }
    console.log("[info] success: %s", resultDetails);
    callback(null, {csv: resultDetails});
  });
}

/**
 * Validate results.
 */
function processValidateResults(evt, context, callback) {
  console.log("[info] processValidateResults");
  validateResults(evt.query.seriesId, evt.query.seriesYear, evt.query.compId, evt.query.runGroup, {},
  function handleValidateResults(err, valResults) {
    if (err) {
      console.log("[error] %s, %j", err.message, err);
      return callback({error: err.message, detail: err});
    }
    console.log("[info] successful validation: %j", valResults);
    callback(null, {csv: valResults});
  });
}

/**
 * Process overall results.
 */
function processOverallResults(evt, context, callback) {
  console.log("[info] processOverallResults");
  createOverallResults(evt.query.seriesId, evt.query.seriesYear, evt.query.division, {},
  function handleOverallResults(err, overallResults) {
    if (err) {
      console.log("[error] %s, %j", err.message, err);
      return callback({error: err.message, detail: err});
    }
    console.log("[info] successful overall results: %j", overallResults);
    callback(null, {csv: overallResults});
  });
}

module.exports = {
  hello: sayHello,
  startList: processStartList,
  results: processResults,
  resultDetails: processResultDetails,
  validateResults: processValidateResults,
  overallResults: processOverallResults
}
