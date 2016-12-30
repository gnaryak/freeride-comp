"use strict";

const
  expect = require("expect.js"),
  _ = require("lodash"),
  validateResults = require("../lib/validateResults.js");

describe("validateResults", function () {

  it("format: array", function (done) {
    this.timeout(20000);
    validateResults("tjfs", 2016, "sb", "Sunday", {format: "array"},
    function handleStartList(err, errors) {
      if (err) {
        throw err;
      }
      console.log("Errors: %j", errors);
      expect(errors).to.be.an("array");
      _.forEach(errors, function (e) {
        console.log("bib: %d, division: %s, msg: %s", e.bib, e.division, e.message);
        expect(e).to.be.an(Error);
        expect(e.athlete).to.be.an("object");
        expect(e.name).to.be.a("string");
        expect(e.division).to.be.a("string");
        expect(e.bib).to.be.ok();
      });
      done();
    });
  });

  it("format: csv (default)", function (done) {
    this.timeout(20000);
    validateResults("tjfs", 2016, "sb", "Sunday", null,
    function handleStartList(err, csv) {
      if (err) {
        throw err;
      }
      console.log("Errors: %j", csv);
      expect(csv).to.be.a("string");
      done();
    });
  });

});
