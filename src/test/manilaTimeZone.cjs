/**
 * Wraps a Jest environment so the test file runs at UTC+8 (Asia/Manila).
 *
 * Why an environment and not a line in the test: inside a test file, `process.env` is a
 * copy Jest made, so assigning `TZ` there never reaches Node and the clock stays put. An
 * environment is constructed in the worker itself, before the test file is loaded, where
 * the assignment is the real thing and V8 picks the new zone up.
 */
function withManila(BaseEnvironment) {
  return class ManilaEnvironment extends BaseEnvironment {
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
  };
}

module.exports = { withManila };
