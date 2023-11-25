import commonjs from "@rollup/plugin-commonjs";
import pluginPrepareRelease from "./plugin-prepare-release.mjs";
import pluginCompileTSC from "./plugin-compile-tsc.mjs";
import { resolve } from "path";
import { glob } from "glob";
import { statSync } from "fs";
import log from "../log/index.js";

export default {
  watch: {
    include: [
      `${resolve(process.cwd(), "src")}/**`,
      `${resolve(process.cwd(), "log")}/**`,
    ],
  },
  input: "dist/src/eslint/index.js",
  output: {
    file: "eslint-plugin/index.js",
    format: "cjs",
  },
  plugins: [
    {
      name: "watch-external",
      buildStart() {
        if (process.env.BUILD === "ci") {
          return;
        }
        let watchCount = 0;
        const watchFile = (fileToWatch) => {
          watchCount++;
          this.addWatchFile(fileToWatch);
        };
        watchFile(resolve(process.cwd(), "tsconfig.json"));
        watchFile(resolve(process.cwd(), "package.json"));
        glob.sync(`${resolve(process.cwd(), "src")}/**`).forEach((file) => {
          !statSync(file).isDirectory() && watchFile(file);
        });
        glob.sync(`${resolve(process.cwd(), "log")}/**`).forEach((file) => {
          !statSync(file).isDirectory() && watchFile(file);
        });

        log.info(`watching ${watchCount} files...`);
      },
    },
    pluginCompileTSC(),
    commonjs(),
    pluginPrepareRelease(),
  ],
};
