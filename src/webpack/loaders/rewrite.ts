import { resolve } from "path";
import { readdirSync, statSync } from "fs";
import constants from "../../constants";
import * as Utils from "../../utils";
import { get } from "lodash";

const getPluginDirs = (dataDir: string) =>
  readdirSync(dataDir)
    .filter((name) => !["node_modules", "dist"].includes(name))
    .filter((name) => !name.startsWith("."))
    .filter((name) => statSync(resolve(dataDir, name)).isDirectory());

async function rewriteLoader(code: string) {
  const callback = this.async();
  const dataDir = Utils.getDataDir();
  const names = getPluginDirs(dataDir);
  const resourcePath = this.resourcePath as string;
  let rewrite: string | undefined = undefined;

  names.forEach((name) => {
    const pathToRewrites = resolve(dataDir, name, constants.rewritesFileName);
    rewrite = get(
      (() => {
        try {
          return require(pathToRewrites);
        } catch (err) {
          console.log(err);
          throw new Error(`Could not require ${pathToRewrites}`);
        }
      })(),
      ["loader", "toCommit", resourcePath]
    );
  });

  try {
    return callback(null, typeof rewrite === "string" ? rewrite : code);
  } catch (err) {
    callback(err, code);
  }
}

export default rewriteLoader;
