import commonjs from "@rollup/plugin-commonjs";
import pluginPrepareRelease from "./plugin-prepare-release.mjs";
import pluginCompileTSC from "./plugin-compile-tsc.mjs";

export default {
  input: "dist/eslint/index.js",
  output: {
    file: "eslint-plugin/index.js",
    format: "cjs",
  },
  plugins: [pluginCompileTSC(), commonjs(), pluginPrepareRelease()],
};
