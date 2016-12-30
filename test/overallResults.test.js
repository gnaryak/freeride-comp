"use strict";

const
  expect = require("expect.js"),
  _ = require("lodash"),
  createOverallResults = require("../lib/overallResults.js");

describe("overallResults", function () {

  it("format: array", function (done) {
    this.timeout(10000);
    createOverallResults("tjfs", 2016, "F11-14", {format: "array"},
    function handleResults(err, results) {
      if (err) {
        throw err;
      }
      console.log("handleResults: %j", results);
      // Format should be:
      // [
      // [order, bib, name, team, pts from comp1, ..., pts from compN, total pts]
      // ]
      expect(results).to.be.an("array");
      _.forEach(results, function validateResult(r) {
        expect(r).to.be.an("object");
        // expect(r.place).to.be.a("number");
        // bib can be either a string or a number
        expect(r.firstName).to.be.a("string");
        expect(r.lastName).to.be.a("string");
        expect(r.team).to.be.a("string");
        // for (var ix = 4; ix <= r.length; ix += 1) {
        //   expect(r[ix]).to.be.a("number");
        // }
      });
      done();
    });
  });

  it("format: file", function (done) {
    this.timeout(10000);
    createOverallResults("tjfs", 2016, "M11-14", {format: "file"},
    function handleResults(err, results) {
      if (err) {
        throw err;
      }
      console.log("handleResults: %j", results);
      // Format should be:
      // [
      // [order, bib, name, team, pts from comp1, ..., pts from compN, total pts]
      // ]
      expect(results).to.be("overallResults-M11-14.csv");
      done();
    });
  });

  it("format: csv (default)", function (done) {
    this.timeout(10000);
    createOverallResults("tjfs", 2016, "BOARD11-14", {},
    function handleResults(err, results) {
      if (err) {
        throw err;
      }
      console.log("handleResults: %j", results);
      // Format should be:
      // [
      // [order, bib, name, team, pts from comp1, ..., pts from compN, total pts]
      // ]
      expect(results).to.be.a("string");
      expect(results.length).to.be.above(500);
      done();
    });
  });

});
