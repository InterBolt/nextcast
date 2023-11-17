import { resolve } from "path";
import { readdirSync, statSync } from "fs";
import jscodeshift from "jscodeshift";
import Codemods from "../../classes/HCodemods";
import constants from "../../constants";
import * as Utils from "../../utils";

const getPluginDirs = (dataDir: string) =>
  readdirSync(dataDir)
    .filter((name) => !["node_modules", "dist"].includes(name))
    .filter((name) => !name.startsWith("."))
    .filter((name) => statSync(resolve(dataDir, name)).isDirectory());

export async function attachDataLoader(code: string) {
  const callback = this.async();
  const dataDir = Utils.getDataDir();
  const codemods = new Codemods(jscodeshift.withParser("tsx")(code));
  const names = getPluginDirs(dataDir);

  names.forEach((name) => {
    const pathToData = resolve(
      Utils.getDataDir(),
      name,
      constants.dataFileName
    );
    const data = require(pathToData);
    codemods.addDataToHTMLTag(data, `data-${constants.name}-${name}`, "html");
  });

  try {
    return callback(null, codemods.collection.toSource());
  } catch (err) {
    callback(err, code);
  }
}
