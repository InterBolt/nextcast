import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync, writeFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const name = "nextcast";
const pluginName = `eslint-plugin-${name}`;

function main() {
  const packageJSONMetaFields = {
    homepage: "https://github.com/InterBolt/nextcast#readme",
    repository: {
      type: "git",
      url: "https://github.com/InterBolt/nextcast.git",
    },
  };

  const eslintlintPluginPKG = {
    name: "eslint-plugin-nextcast",
    version: `${rootPkg.version}`,
    main: "./index.js",
    module: "./index.js",
    browser: "./index.js",
    engines: {
      yarn: "use npm!",
    },
    files: ["./index.js"],
    ...packageJSONMetaFields,
  };

  const nextcastPKG = {
    ...JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf-8")),
    devDependencies: {
      ...(rootPkg.devDependencies || {}),
      [pluginName]: rootPkg.version,
    },
    peerDependencies: {
      ...(rootPkg.peerDependencies || {}),
      [pluginName]: rootPkg.version,
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
    JSON.stringify(nextcastPKG, null, 2)
  );
}

main();
