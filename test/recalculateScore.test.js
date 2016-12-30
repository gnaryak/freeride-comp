"use strict";

const
  expect = require("expect.js"),
  _ = require("lodash"),
  recalculateScores = require("../lib/recalculateScore.js");

describe("recalculateScore", function () {

  it("should work without scalars", function () {
    var
      scalars = {},
      scoreContainer = {
        scores: [
          {
            line: 5,
            control: 6,
            fluidity: 6,
            technique: 6,
            style: 7,
            score: 30
          },
          {
            line: 5,
            control: 6,
            fluidity: 6,
            technique: 6,
            style: 7,
            score: 30
          },
          {
            line: 5,
            control: 6,
            fluidity: 6,
            technique: 6,
            style: 7,
            score: 30
          }
        ],
        score: 30
      };
    recalculateScores(scoreContainer, scalars);
    console.log("unscaled scoreContainer=%j", scoreContainer);
    expect(scoreContainer.score).to.be(30);
  });

  it("should work with one scalar", function () {
    var
      scalars = {
        control: 2
      },
      scoreContainer = {
        scores: [
          {
            line: 5,
            control: 8,
            fluidity: 6,
            technique: 6,
            style: 7,
            score: 32
          },
          {
            line: 5,
            control: 8,
            fluidity: 6,
            technique: 6,
            style: 7,
            score: 32
          },
          {
            line: 5,
            control: 8,
            fluidity: 6,
            technique: 6,
            style: 7,
            score: 32
          }
        ],
        score: 32
      };
    recalculateScores(scoreContainer, scalars);
    console.log("scaled scoreContainer=%j", scoreContainer);
    expect(scoreContainer.score).to.be(_.round(40*5/6, 3));
  });

  it("should work with 2 scalars", function () {
    var
      scalars = {
        control: 2,
        style: 0.75
      },
      scoreContainer = {
        scores: [
          {
            line: 5,
            control: 8,
            fluidity: 6,
            technique: 6,
            style: 5,
            score: 30
          },
          {
            line: 5,
            control: 8,
            fluidity: 6,
            technique: 6,
            style: 5,
            score: 30
          },
          {
            line: 5,
            control: 8,
            fluidity: 6,
            technique: 6,
            style: 5,
            score: 30
          }
        ],
        score: 30
      };
    recalculateScores(scoreContainer, scalars);
    console.log("double scaled scoreContainer=%j", scoreContainer);
    expect(scoreContainer.score).to.be(_.round((5 + 16 + 12 + (5 * 0.75)) * 5 / 5.75, 3));
  });

});
