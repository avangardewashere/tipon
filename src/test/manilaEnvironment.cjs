const { TestEnvironment: NodeEnvironment } = require("jest-environment-node");

/**
 * A Jest environment that runs a test file at UTC+8 (Asia/Manila).
 *
 * Why a whole environment for one line: inside a test file, `process.env` is a copy Jest
 * made, so assigning `TZ` there never reaches Node and the clock stays put. An environment
 * is constructed in the worker itself, before the test file is loaded, where the
 * assignment is the real thing and V8 picks the new zone up.
 *
 * Used with `@jest-environment ./src/test/manilaEnvironment.cjs` at the top of a test file.
 */
class ManilaEnvironment extends NodeEnvironment {
  constructor(config, context) {
    super(config, context);
    this.realTimeZone = process.env.TZ;
    process.env.TZ = "Asia/Manila";
  }

  async teardown() {
    // Workers are reused, so the next file must not inherit Manila by accident.
    if (this.realTimeZone === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = this.realTimeZone;
    }
    await super.teardown();
  }
}

module.exports = ManilaEnvironment;
