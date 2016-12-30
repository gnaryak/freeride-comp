"use strict";

const
  _ = require("lodash");

/**
 * Mutate the scalars parameter to convert strings like "1.5" into the
 * corresponding numbers.
 */
function makeScalarsNumeric(scalars) {
  _.forEach(scalars, function numericize(component, key) {
    if (_.isString(component)) {
      var
        num = parseFloat(component);
      if (!isNaN(num)) {
        console.log("changing string scalar to a number: %s", num);
        scalars[key] = num;
      }
    }
  });
}

/**
 * Recalculate the score using the parameter scalars.
 * Mutate the parameter scoreObj by updating its "score" property.
 * scoreObj has properties for the components of the score: line, control, etc.
 */
function recalculateScore(scoreObj, scalars) {
  var
    scalarSum = 0,
    score = 0,
    componentScore = 0,
    components = _.filter(_.keys(scoreObj), function omitScore(k) {
      return k !== "score";
    });
  makeScalarsNumeric(scalars);
  // console.log("components: %j", components);
  _.forEach(components, function scaleComponent(component) {
    if (scalars[component] === undefined) {
      componentScore = scoreObj[component];
      scalarSum += 1;
    } else {
      componentScore = scoreObj[component] * scalars[component];
      scalarSum += scalars[component];
    }
    score += componentScore;
  });
  // console.log("before scaling, score=%d", score);
  // Scale the score by (# of components) / (scalarSum).
  // As the scalars increase, the resulting score needs to be decreased so that
  // it is comparable to the original unscaled score.
  score = _.round(score * components.length / scalarSum, 3);
  scoreObj.score = score;
}

/**
 * @param scoreContainer {Object} It is structured like:
              // {
              // scores: [
              //   {line: 2, control: 2, technique: 2, fluidity: 2, style: 2, score: 8},
              //   {line: 2, control: 2, technique: 2, fluidity: 2, style: 2, score: 8},
              //   {line: 2, control: 2, technique: 2, fluidity: 2, style: 2, score: 8}
              // ],
              // score: 8
              // }
 * We iterate the scores array to recalculate the inner scores,
 * and we also keep track of the average for the outer score.
 * @param scalars {Object} It has one or more of the properties of the scores
 * subobjects (line, control, etc).
 */
module.exports = function recalculateScores(scoreContainer, scalars) {
  // console.log("b4 scaling: %j", scoreObj);
  var total = 0;
  _.forEach(scoreContainer.scores, function recalc(s) {
    recalculateScore(s, scalars);
    total += s.score;
  });
  if (!scoreContainer.scores.length) {
    scoreContainer.score = 0;
  } else {
    scoreContainer.score = _.round(total / scoreContainer.scores.length, 3);
  }
  // console.log("after scaling: %j", scoreObj);
};
