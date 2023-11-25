import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync, writeFileSync } from "fs";
import semver from "semver";
import { execSync } from "child_process";
import log from "../log/index.js";

const pluginPrerelease = () => {
  return {
    name: "prerelease",
    buildEnd: async () => {
      const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

      const currentPkg = JSON.parse(
        readFileSync(resolve(rootDir, "package.json"), "utf-8")
      );
      const pkgName = "nextcast";
      const pkgOrg = pkgName.includes("/") ? pkgName.split("/")[0] : "";
      const pkgTitle = pkgName.includes("/") ? pkgName.split("/")[1] : pkgName;
      const pkgNextVersion =
        process.env.BUILD === "ci"
          ? (() => {
              const npmVersionCmd = `npm view ${pkgName} version`;
              let currentVersion;
              let nextVersion;
              try {
                currentVersion = execSync(npmVersionCmd, {
                  encoding: "utf-8",
                }).trim();
                log.success(`Found latest version: ${currentVersion}`);
                nextVersion = semver.inc(currentVersion, "prerelease");
                log.info(`Incremented prerelease => ${nextVersion}`);
              } catch (err) {
                nextVersion = currentPkg.version;
                log.warn(
                  `Using local package.json version. Skipping increment.`
                );
              }

              return nextVersion;
            })()
          : currentPkg.version;

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
        resolve(rootDir, "eslint-plugin/package.json"),
        JSON.stringify(eslintlintPluginPKG, null, 2)
      );
      log.success(`created /eslint-plugin/package.json`);

      // IMPORTANT: this gets run AFTER the CD install step.
      // If you thought too hard and assumed the CD would fail because the packages
      // would be missing, congrats for the thoughtfulness. But in reality we add these
      // things after the installation takes place, more for the end user's sake.
      writeFileSync(
        resolve(rootDir, "package.json"),
        JSON.stringify(packagePKG, null, 2)
      );
      log.success(`created /package.json`);
    },
  };
};

export default pluginPrerelease;
