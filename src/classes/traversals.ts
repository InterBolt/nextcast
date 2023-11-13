import type * as Classes from "./index";
import * as parser from "@babel/parser";
import * as Types from "../types";
import * as Utils from "../utils/index";
import traverse, { TraverseOptions } from "@babel/traverse";

class Traversals {
  private cache: Classes.cache;

  constructor(cache: Classes.cache) {
    this.cache = cache;
    this.cache.register(["import_tree"], {});
  }

  public babel = (
    source: string | ReturnType<typeof parser.parse>,
    options: TraverseOptions
  ) => {
    let ast: ReturnType<typeof parser.parse>;
    if (typeof source === "string") {
      const parsed = this.cache.parseBabel(source);
      ast = parsed.ast;
    } else {
      ast = source;
    }
    traverse(ast, options);
  };

  public getResolvedImports = (filePath: string) => {
    const resolvedImports: Array<Types.ResolvedImport> = [];
    this.babel(filePath, {
      CallExpression: (path) => {
        if (path.node.callee.type !== "Import") {
          return;
        }
        const importArgumentString = path.node.arguments[0];
        if (importArgumentString.type !== "StringLiteral") {
          return;
        }
        const assignedVariable = path.findParent((parentNode) =>
          parentNode.isVariableDeclaration()
        );
        if (!assignedVariable.isVariableDeclaration()) {
          return;
        }
        const declarator = assignedVariable.node.declarations[0];
        if (declarator.id.type !== "Identifier") {
          return;
        }
        resolvedImports.push({
          filePath: Utils.nextjs.resolveImport(
            filePath,
            importArgumentString.value
          ),
          assignee: declarator.id.name,
          exportName: "unknown",
        });
      },
      ImportSpecifier: (path) => {
        const importDeclaration = path.findParent((parentNode) =>
          parentNode.isImportDeclaration()
        );
        if (!importDeclaration.isImportDeclaration()) {
          return;
        }
        if (path.node.imported.type !== "Identifier") {
          return;
        }
        resolvedImports.push({
          filePath: Utils.nextjs.resolveImport(
            filePath,
            importDeclaration.node.source.value
          ),
          assignee: path.node.local.name,
          exportName: path.node.imported.name,
        });
      },
      ImportDefaultSpecifier: (path) => {
        const importDeclaration = path.findParent((parentNode) =>
          parentNode.isImportDeclaration()
        );
        if (!importDeclaration.isImportDeclaration()) {
          return;
        }
        resolvedImports.push({
          filePath: Utils.nextjs.resolveImport(
            filePath,
            importDeclaration.node.source.value
          ),
          assignee: path.node.local.name,
          exportName: "default",
        });
      },
    });

    return resolvedImports;
  };

  public resolveAllImportsRecursively = (
    filePath: string,
    accum: Array<string>
  ) => {
    const resolvedImports = this.getResolvedImports(filePath);
    accum.push(filePath);
    const unwalkedFilePaths = resolvedImports
      .filter((resolvedImport) => !accum.includes(resolvedImport.filePath))
      .map((resolvedImport) => resolvedImport.filePath)
      .filter((unwalkedFilePath) =>
        Utils.nextjs.validExts.some((validExt) =>
          unwalkedFilePath.endsWith(validExt)
        )
      );
    if (unwalkedFilePaths.length === 0) {
      return;
    }
    unwalkedFilePaths.forEach((unwalkedFilePath) =>
      this.resolveAllImportsRecursively(unwalkedFilePath, accum)
    );
  };

  public walkImports = (filePath: string): Array<string> => {
    const importTree = this.cache.get<Record<string, Array<string>>>([
      "import_tree",
    ]);

    if (importTree[filePath]) {
      return importTree[filePath];
    }

    const resolvedImports = [];
    this.resolveAllImportsRecursively(filePath, resolvedImports);

    this.cache.merge<Array<string>>(["import_tree"], {
      [filePath]: resolvedImports,
    });

    return resolvedImports;
  };
}

export default Traversals;
