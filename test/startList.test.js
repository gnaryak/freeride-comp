var
  expect = require("expect.js"),
  startList = require("../lib/startList.js");

describe("startList", function () {
  it("should work", function (done) {
    this.timeout(10000);
    startList("tjfs", 2016, "sb", "2016-01-08", true, false,
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