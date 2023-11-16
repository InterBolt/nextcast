import colors from "colors/safe";

const prefixes = {
  wait: colors.white(colors.bold("○")),
  error: colors.red(colors.bold("⨯")),
  warn: colors.yellow(colors.bold("⚠")),
  success: colors.green(colors.bold("✓")),
  info: colors.magenta(colors.bold("»")),
};

const info = (message: string) => console.log(` ${prefixes.info} ${message}`);
const success = (message: string) =>
  console.log(` ${prefixes.success} ${message}`);
const warn = (message: string) => console.log(` ${prefixes.warn} ${message}`);
const error = (message: string) => console.log(` ${prefixes.error} ${message}`);
const wait = (message: string) => console.log(` ${prefixes.wait} ${message}`);

const logger = {
  info,
  success,
  warn,
  error,
  wait,
};

export default logger;
