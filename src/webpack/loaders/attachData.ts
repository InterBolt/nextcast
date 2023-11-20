import { resolve } from "path";
import { readdirSync, statSync } from "fs";
import jscodeshift, { Collection } from "jscodeshift";
import constants from "../../constants";
import * as Utils from "../../utils";
import { JSONValue } from "../../types";

const getPluginDirs = (dataDir: string) =>
  readdirSync(dataDir)
    .filter((name) => !["node_modules", "dist"].includes(name))
    .filter((name) => !name.startsWith("."))
    .filter((name) => statSync(resolve(dataDir, name)).isDirectory());

const addDataToHTMLTag = (
  collection: Collection,
  attributeName: `data-${string}`,
  jsonData: JSONValue
) => {
  return collection
    .find(jscodeshift.JSXElement)
    .filter(
      // @ts-ignore
      (path) => path.node.openingElement.name.name === "html"
    )
    .forEach((path) => {
      path.node.openingElement.attributes.push(
        jscodeshift.jsxAttribute(
          jscodeshift.jsxIdentifier(attributeName.toLowerCase()),
          jscodeshift.stringLiteral(encodeURI(JSON.stringify(jsonData)))
        )
      );
    });
};

async function attachDataLoader(code: string) {
  const callback = this.async();
  const dataDir = Utils.getDataDir();
  const names = getPluginDirs(dataDir);
  const collection = jscodeshift.withParser("tsx")(code);

  names.forEach((name) => {
    const pathToData = resolve(
      Utils.getDataDir(),
      name,
      constants.dataFileName
    );
    const data = require(pathToData);
    addDataToHTMLTag(collection, `data-${constants.name}-${name}`, data);
  });

  try {
    return callback(null, collection.toSource());
  } catch (err) {
    callback(err, code);
  }
}

export default attachDataLoader;
