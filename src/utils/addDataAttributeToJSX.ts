import jscodeshift from "jscodeshift";
import * as Types from "./types";

const addDataAttributeToJSX = (
  sourceCode: string,
  attributeName: `data-${string}`,
  jsonData: Types.JSONValue,
  htmlTag: string
) =>
  jscodeshift
    .withParser("tsx")(sourceCode)
    .find(jscodeshift.JSXElement)
    .filter(
      // @ts-ignore
      (path) => path.node.openingElement.name.name === htmlTag
    )
    .forEach((path) => {
      path.node.openingElement.attributes.push(
        jscodeshift.jsxAttribute(
          jscodeshift.jsxIdentifier(attributeName),
          jscodeshift.stringLiteral(encodeURI(JSON.stringify(jsonData)))
        )
      );
    })
    .toSource();

export default addDataAttributeToJSX;
