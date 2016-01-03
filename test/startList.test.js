var
  expect = require("expect.js"),
  startList = require("../lib/startList.js");

describe("startList", function () {
  it("should work", function (done) {
    this.timeout(10000);
    startList("tjfs", 2016, "sb", "day2", true, false,
    function handleStartList(err, response) {
      if (err) {
        throw err;
      }
      console.log("response: %j", response);
      expect(response).to.be.a("string");
      done();
    });
  });

  it.only("should support cutoffs", function (done) {
    this.timeout(10000);
    startList("tjfs", 2016, "sb", "finals", false, false,
    function handleStartList(err, response) {
      if (err) {
        throw err;
      }
      console.log("response: %j", response);
      expect(response).to.be.a("string");
      done();
    });
  });

});