import jscodeshift, { Collection } from "jscodeshift";
import { JSONValue } from "../types";

class HCodemods {
  public collection: Collection;

  constructor(collection: Collection) {
    this.collection = collection;
  }

  public addDataToHTMLTag = (
    jsonData: JSONValue,
    attributeName: `data-${string}`,
    htmlTag: "html" | "body"
  ) => {
    return this.collection
      .find(jscodeshift.JSXElement)
      .filter(
        // @ts-ignore
        (path) => path.node.openingElement.name.name === htmlTag
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
}

export default HCodemods;
