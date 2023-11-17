import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync, writeFileSync } from "fs";
import semver from "semver";
import { execSync } from "child_process";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const currentPkg = JSON.parse(
  readFileSync(resolve(rootDir, "package.json"), "utf-8")
);
const pkgName = "nextcast";
const pkgOrg = pkgName.includes("/") ? pkgName.split("/")[0] : "";
const pkgTitle = pkgName.includes("/") ? pkgName.split("/")[1] : pkgName;
const pkgNextVersion = (() => {
  try {
    return semver.inc(
      execSync(`npm view ${pkgName} version`, {
        encoding: "utf-8",
        stdio: "ignore",
      }).trim(),
      "prerelease"
    );
  } catch (err) {
    return `0.1.0-alpha.1`;
  }
})();

if (semver.compare(pkgNextVersion, currentPkg.version) === -1) {
  const errorMessages = [
    `The current version of ${pkgName} is ${currentPkg.version}.`,
    `The next version of ${pkgName} cannot be a lower version: ${pkgNextVersion}.`,
    `It's possible the npm view version command failed. Check your network.`,
  ];
  throw new Error(errorMessages.join("\n"));
}

const pluginName = pkgOrg
  ? `${pkgOrg}/eslint-plugin-${pkgTitle}`
  : `eslint-plugin-${pkgName}`;

const pluginPrerelease = () => {
  return {
    name: "prerelease",
    buildEnd() {
      const sharedPKG = {
        homepage: `https://github.com/InterBolt/${pkgName}#readme`,
        repository: {
          type: `git`,
          url: `https://github.com/InterBolt/${pkgName}.git`,
        },
      };

      const eslintlintPluginPKG = {
        name: pluginName,
        version: `${pkgNextVersion}`,
        main: "./index.js",
        module: "./index.js",
        browser: "./index.js",
        engines: {
          yarn: "use npm!",
        },
        files: ["./index.js"],
        ...sharedPKG,
      };

      const pluginVersion =
        String(process.env.PUBLISH) === "true"
          ? pkgNextVersion
          : `file:./eslint-plugin`;
      const packagePKG = {
        ...currentPkg,
        version: `${pkgNextVersion}`,
        devDependencies: {
          ...(currentPkg.devDependencies || {}),
          [pluginName]: pluginVersion,
        },
        peerDependencies: {
          ...(currentPkg.peerDependencies || {}),
          [pluginName]: pluginVersion,
        },
        ...sharedPKG,
      };

      // create the eslint plugin package.json
      writeFileSync(
        resolve(rootDir, `eslint-plugin/package.json`),
        JSON.stringify(eslintlintPluginPKG, null, 2)
      );

      // IMPORTANT: this gets run AFTER the CD install step.
      // If you thought too hard and assumed the CD would fail because the packages
      // would be missing, congrats for the thoughtfulness. But in reality we add these
      // things after the installation takes place, more for the end user's sake.
      writeFileSync(
        resolve(rootDir, "package.json"),
        JSON.stringify(packagePKG, null, 2)
      );
    },
  };
};

export default pluginPrerelease;
