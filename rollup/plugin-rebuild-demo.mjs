import { execSync } from "child_process";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import log from "../log/index.js";
import { existsSync } from "fs";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const pluginRebuildDemo = () => {
  return {
    name: "compile",
    buildStart() {
      if (process.env.BUILD === "ci") {
        return;
      }
      if (process.env.REBUILD !== "true") {
        return;
      }
      const potentialDemoDir = resolve(rootDir, "../nextcast-demo");
      if (!existsSync(potentialDemoDir)) {
        log.warn(`Skipping demo build. Nothing found at ${potentialDemoDir}`);
        return;
      }
      log.wait(`resintalling at ${potentialDemoDir}`);
      execSync(
        `npm uninstall nextcast eslint-plugin-nextcast && npm i nextcast@file:../nextcast/ eslint-plugin-nextcast@file:../nextcast/eslint-plugin/`,
        {
          cwd: potentialDemoDir,
          encoding: "utf-8",
          stdio: "inherit",
        }
      );
      log.wait(`rebuilding demo at ${potentialDemoDir}`);
      execSync(`npm run build`, {
        cwd: potentialDemoDir,
        encoding: "utf-8",
        stdio: "inherit",
      });
      log.success(`built ${potentialDemoDir}`);
      log.wait(`resintalling latest at ${potentialDemoDir}`);
      execSync(
        `npm uninstall nextcast eslint-plugin-nextcast && npm i nextcast@latest eslint-plugin-nextcast@latest`,
        {
          cwd: potentialDemoDir,
          encoding: "utf-8",
          stdio: "inherit",
        }
      );
    },
  };
};

export default pluginRebuildDemo;
