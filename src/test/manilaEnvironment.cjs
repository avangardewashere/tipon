const { TestEnvironment: NodeEnvironment } = require("jest-environment-node");
const { withManila } = require("./manilaTimeZone.cjs");

/** Node, at UTC+8. Used with `@jest-environment ./src/test/manilaEnvironment.cjs`. */
module.exports = withManila(NodeEnvironment);
