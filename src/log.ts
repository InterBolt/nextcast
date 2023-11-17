import colors from "colors/safe";

const PREFIXES = {
  wait: colors.white(colors.bold("○")),
  error: colors.red(colors.bold("⨯")),
  warn: colors.yellow(colors.bold("⚠")),
  success: colors.green(colors.bold("✓")),
  info: colors.magenta(colors.bold("»")),
};

const info = (message: string) => console.log(` ${PREFIXES.info} ${message}`);

const success = (message: string) =>
  console.log(` ${PREFIXES.success} ${message}`);

const warn = (message: string) => console.log(` ${PREFIXES.warn} ${message}`);

const error = (message: string) => console.log(` ${PREFIXES.error} ${message}`);

const wait = (message: string) => console.log(` ${PREFIXES.wait} ${message}`);

const log = {
  info,
  success,
  warn,
  error,
  wait,
};

export default log;
