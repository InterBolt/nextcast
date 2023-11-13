import { NextJSCollector } from "../../types";
import { Config } from "./index";

const collector: NextJSCollector<Config> = async (ctx) => {
  const {
    macroConfig: {
      exportIdentifier = "default",
      path: fnPath,
      allowedArgTypes = null,
    },
    getRoutes,
    traverseBabel,
    getResolvedImports,
    collect,
    reportError,
  } = ctx;

  const formattedAllowedArgTypes = (
    Array.isArray(allowedArgTypes) ? allowedArgTypes : [allowedArgTypes]
  ).filter((t) => typeof t === "string");

  getRoutes().forEach(({ files, name: routeName }) => {
    files.forEach((filePath) => {
      const foundHookImport = getResolvedImports(filePath).find(
        (resolvedImport) =>
          resolvedImport.filePath === fnPath &&
          resolvedImport.exportName === exportIdentifier
      );

      if (!foundHookImport) {
        return;
      }

      const { assignee } = foundHookImport;
      if (!assignee) {
        return;
      }

      traverseBabel(filePath, {
        CallExpression: (path) => {
          const isAssignee =
            path.node.callee.type === "Identifier" &&
            path.node.callee.name === assignee;
          if (!isAssignee) {
            return;
          }
          path.node.arguments.forEach((arg) => {
            const isAllowed = formattedAllowedArgTypes.some(
              (allowedArgType) => arg.type === allowedArgType
            );
            if (!isAllowed) {
              reportError(
                `arg type "${arg.type}" is not allowed for uses of: ${fnPath}[${exportIdentifier}]`,
                path.node,
                filePath
              );
            }
          });

          const argStrings: Array<string> = path.node.arguments
            .map((arg: any) => arg?.value || "")
            .filter((arg: any) => typeof arg === "string");

          collect({
            args: argStrings,
            routeName,
          });
        },
      });
    });
  });
};

export default collector;
