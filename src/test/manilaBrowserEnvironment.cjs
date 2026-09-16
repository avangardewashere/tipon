const { TestEnvironment: JsdomEnvironment } = require("jest-environment-jsdom");
const { withManila } = require("./manilaTimeZone.cjs");

/** A browser at UTC+8, for testing what a screen puts on the page there. */
module.exports = withManila(JsdomEnvironment);
