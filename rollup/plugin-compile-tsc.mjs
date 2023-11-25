import { execSync } from "child_process";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import log from "../log/index.js";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const pluginCompileTSC = () => {
  return {
    name: "compile",
    buildStart() {
      execSync(`tsc`, {
        cwd: rootDir,
        encoding: "utf-8",
        stdio: "inherit",
      });
      log.success(`compiled with tsc`);
    },
  };
};

export default pluginCompileTSC;
