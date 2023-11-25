const colors = require("colors/safe.js");

const PREFIXES = {
  wait: colors.white(colors.bold("○")),
  error: colors.red(colors.bold("⨯")),
  warn: colors.yellow(colors.bold("⚠")),
  success: colors.green(colors.bold("✓")),
  info: colors.magenta(colors.bold("»")),
};

const info = (message) => console.log(` ${PREFIXES.info} ${message}`);
const success = (message) => console.log(` ${PREFIXES.success} ${message}`);
const warn = (message) => console.log(` ${PREFIXES.warn} ${message}`);
const error = (message) => console.log(` ${PREFIXES.error} ${message}`);
const wait = (message) => console.log(` ${PREFIXES.wait} ${message}`);

const log = {
  info,
  success,
  warn,
  error,
  wait,
};

module.exports = log;
