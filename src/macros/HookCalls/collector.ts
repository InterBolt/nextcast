import { existsSync } from "fs";
import { Collector, MacroContext } from "../../types";
import resolvers from "../../utils/resolvers";
import { get } from "lodash";
import {
  ASTPath,
  types,
  ImportDefaultSpecifier,
  ImportSpecifier,
  ImportNamespaceSpecifier,
} from "jscodeshift";
import { Config } from ".";

const findDefaultImportAssignmentName = (
  specifiers: Array<
    ImportDefaultSpecifier | ImportSpecifier | ImportNamespaceSpecifier
  >
) => {
  const v = specifiers.find((s) => {
    const isCleanDefaultImport = get(s, "type") === "ImportDefaultSpecifier";
    const isAsDefaultImport = get(s, ["imported", "name"]) === "default";
    return isAsDefaultImport || isCleanDefaultImport;
  });

  return v.local.name;
};

const findNamedImportAssignmentName = (
  specifiers: Array<
    ImportDefaultSpecifier | ImportSpecifier | ImportNamespaceSpecifier
  >
) => {
  const v = specifiers.find((s) => get(s, "type") === "ImportSpecifier");
  return v.local.name;
};

const collector: Collector<Config> = async (ctx: MacroContext<Config>) => {
  const {
    options: {
      macroConfig: {
        exportIdentifier = "default",
        path: fnPath,
        allowedArgTypes = null,
      },
    },
    cache,
    jscodeshift,
  } = ctx;

  if (!existsSync(fnPath)) {
    throw new Error(`Function path ${fnPath} does not exist`);
  }

  cache.getSegments().forEach((segment) => {
    const { files, name: segmentName } = segment;

    files.forEach((file) => {
      const { astCollection, filePath } = file;

      const found = resolvers
        .topLevelImports(filePath, astCollection)
        .find(([importPath]) => importPath === fnPath);

      if (!found) {
        return;
      }

      const [, astNodeRepresentingImport] = found;
      const fnName =
        exportIdentifier === "default"
          ? findDefaultImportAssignmentName(
              astNodeRepresentingImport.node.specifiers
            )
          : findNamedImportAssignmentName(
              astNodeRepresentingImport.node.specifiers
            );

      astCollection
        .find(jscodeshift.CallExpression)
        .forEach((astPath: ASTPath<any>) => {
          if (astPath.node.callee.name !== fnName) {
            return;
          }

          if (allowedArgTypes) {
            const foundArgTypes = astPath.node.arguments.map(
              (arg: any) => arg.type
            ) as Array<typeof types.namedTypes>;

            const notPassingArgRestrictions = foundArgTypes.some(
              (argType) => !allowedArgTypes.includes(argType)
            );

            if (notPassingArgRestrictions) {
              cache.pushError(
                `expected arg types: [${allowedArgTypes.join(
                  ", "
                )}]\nfound: [${foundArgTypes.join(", ")}]`,
                filePath,
                astPath
              );

              return;
            }
          }

          console.log(
            cache.pushSegmentData(
              segmentName,
              astPath.node.arguments.map(
                (arg: any) => arg.value || jscodeshift(arg).toSource()
              )
            )
          );
        });
    });
  });
};

export default collector;
