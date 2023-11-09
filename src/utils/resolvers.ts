import { ASTPath, Collection, default as jscodeshift } from "jscodeshift";
import { existsSync } from "fs";
import { resolve } from "path";
import * as Utils from ".";

const basePath = resolve(Utils.nextjs.getAppDir(), "..");
const tsConfigPaths = existsSync(resolve(basePath, "tsconfig.json"))
  ? require(resolve(basePath, "tsconfig.json"))?.compilerOptions?.paths || {}
  : {};

const topLevelAndDynamic = (
  entry: string,
  astCollection: Collection
): Array<string> => {
  const imports = [];

  astCollection
    .find(jscodeshift.CallExpression, { callee: { type: "Import" } })
    .forEach((astPath) => {
      const importPath = Utils.resolveAliasedImport(
        basePath,
        entry,
        (astPath.value.arguments[0] as any)?.value as string,
        {
          ...tsConfigPaths,
          ["*"]: ["node_modules/*"],
        }
      );
      if (!importPath.startsWith(resolve(basePath, "node_modules"))) {
        imports.push(importPath);
      }
    });

  astCollection.find(jscodeshift.ImportDeclaration).forEach((astPath) => {
    const importPath = Utils.resolveAliasedImport(
      basePath,
      entry,
      astPath.node.source.value as string,
      {
        ...tsConfigPaths,
        ["*"]: ["node_modules/*"],
      }
    );
    if (!importPath.startsWith(resolve(basePath, "node_modules"))) {
      imports.push(importPath);
    }
  });

  return imports;
};

const topLevelImports = (
  entry: string,
  astCollection: Collection
): Array<[string, ASTPath<jscodeshift.ImportDeclaration>]> => {
  const imports = [];

  astCollection.find(jscodeshift.ImportDeclaration).forEach((astPath) => {
    const importPath = Utils.resolveAliasedImport(
      basePath,
      entry,
      astPath.node.source.value as string,
      {
        ...tsConfigPaths,
        ["*"]: ["node_modules/*"],
      }
    );
    if (!importPath.startsWith(resolve(basePath, "node_modules"))) {
      imports.push([importPath, astPath]);
    }
  });

  return imports;
};

export default {
  topLevelImports,
  topLevelAndDynamic,
};
