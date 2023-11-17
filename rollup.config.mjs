import commonjs from "@rollup/plugin-commonjs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync, writeFileSync } from "fs";
import semverInc from "semver/functions/inc";

const __dirname = dirname(fileURLToPath(import.meta.url));

const currentPkg = JSON.parse(
  readFileSync(resolve(__dirname, "package.json"), "utf-8")
);
const pkgName = "@interbolt/micropack";
const pkgPreleaseVesion = semverInc(
  execSync(`npm view ${pkgName} version`, {
    encoding: "utf-8",
  }).trim(),
  "prerelease"
);

function prepEslintPlugin() {
  return {
    name: "prepublish",
    buildEnd() {
      const packageJSONMetaFields = {
        homepage: `https://github.com/InterBolt/${pkgName}#readme`,
        repository: {
          type: `git`,
          url: `https://github.com/InterBolt/${pkgName}.git`,
        },
      };

      const eslintlintPluginPKG = {
        name: `eslint-plugin-${pkgName}`,
        version: `${pkgPreleaseVesion}`,
        main: "./index.js",
        module: "./index.js",
        browser: "./index.js",
        engines: {
          yarn: "use npm!",
        },
        files: ["./index.js"],
        ...packageJSONMetaFields,
      };

      const packagePKG = {
        ...currentPkg,
        devDependencies: {
          ...(currentPkg.devDependencies || {}),
          [pluginName]: pkgPreleaseVesion,
        },
        peerDependencies: {
          ...(currentPkg.peerDependencies || {}),
          [pluginName]: pkgPreleaseVesion,
        },
        ...packageJSONMetaFields,
      };

      // create the eslint plugin package.json
      writeFileSync(
        resolve(__dirname, `${pluginName}/package.json`),
        JSON.stringify(eslintlintPluginPKG, null, 2)
      );

      // IMPORTANT: this gets run AFTER the CD install step.
      // If you thought too hard and assumed the CD would fail because the packages
      // would be missing, congrats for the thoughtfulness. But in reality we add these
      // things after the installation takes place, more for the end user's sake.
      writeFileSync(
        resolve(__dirname, "package.json"),
        JSON.stringify(packagePKG, null, 2)
      );
    },
  };
}

export default {
  input: "dist/next/eslint/index.js",
  output: {
    file: "eslint-plugin-nextcast/index.js",
    format: "cjs",
  },
  plugins: [commonjs(), prepEslintPlugin()],
};
