"use strict";

var points = [
  500, 417, 369, 335, 308, 287, 268, 252, 238, 226, 215, 204, 195, 186, 178,
  170, 163, 156, 149, 143, 138, 132, 127, 122, 117, 112, 108, 103, 99, 95, 91,
  87, 84, 80, 77, 73, 70, 67, 64, 61, 58, 55, 52
];

/**
 * Get the points based on the place in the division.
 * 0-based index, i.e. first place is 0.
 */
module.exports = function getPoints(place) {
  var pts = points[place];
  if (!pts) {
    pts = 50;
  }
  return pts;
};
