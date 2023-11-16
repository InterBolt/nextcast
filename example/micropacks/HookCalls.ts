import { Micro } from "@interbolt/micropack";

type Config = {
  path: string;
  exportIdentifier?: string;
  allowedArgTypes?: Array<string>;
};

class HookCalls extends Micro.Pack {
  declare config: Config;
  declare name: string;

  constructor(config: Config, name: string) {
    super()
    this.config = config;
    this.name = name;
  }

  public collector: Micro.Collector = async (ctx) => {
    const { getRoutes, traverse, collect, reportError, getDetailedImports } =
      ctx;
    const { allowedArgTypes, exportIdentifier, path: fnPath } = this.config;

    const formattedAllowedArgTypes = (
      Array.isArray(allowedArgTypes) ? allowedArgTypes : [allowedArgTypes]
    ).filter((t) => typeof t === "string");

    getRoutes().forEach(({ files, name: routeName }) => {
      files.forEach((filePath) => {
        const foundHookImport = getDetailedImports(filePath).find(
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

        traverse(filePath, {
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
                  filePath,
                  path.node
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

  public reducer: Micro.Reducer = async (ctx) => {
    const { collection } = ctx;

    return collection;
  };

  public rewriter: Micro.Rewriter = async (ctx) => {
    return;
  };
}

export default HookCalls;
