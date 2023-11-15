import commonjs from "@rollup/plugin-commonjs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync, writeFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

function prepEslintPlugin() {
  return {
    name: "eslint-plugin-prep",
    buildEnd() {
      const pathToEslintPluginPackageJSON = resolve(
        __dirname,
        "eslint-plugin-micropack/package.json"
      );
      const pathToRootPackageJSON = resolve(__dirname, "package.json");
      const rootPkg = JSON.parse(readFileSync(pathToRootPackageJSON, "utf-8"));
      const version = rootPkg.version;
      const name = rootPkg.name;
      const eslintPluginPkg = JSON.parse(
        readFileSync(pathToEslintPluginPackageJSON, "utf8")
      );

      eslintPluginPkg.version = version;
      eslintPluginPkg.name = name.replace(
        "@interbolt/",
        "@interbolt/eslint-plugin-"
      );

      writeFileSync(
        pathToEslintPluginPackageJSON,
        JSON.stringify(eslintPluginPkg, null, 2)
      );
    },
  };
}

export default {
  input: "dist/next/eslint/index.js",
  output: {
    file: "eslint-plugin-micropack/index.js",
    format: "cjs",
  },
  plugins: [commonjs(), prepEslintPlugin()],
};
