import { execSync } from "child_process";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

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
    },
  };
};

export default pluginCompileTSC;
