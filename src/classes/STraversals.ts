import traverse, { TraverseOptions } from "@babel/traverse";
import Store from "./Store/index";
import * as Utils from "../utils";

type ResolvedImport = {
  file: string;
  exportName?: "dynamic" | "default" | string;
  assignee?: string;
};

class STraversals {
  private store: Store;

  constructor(store: Store) {
    this.store = store;
    this.store.registerAccessPath(["used_tree"], {});
    this.store.registerAccessPath(["detailed_imports"], {});
  }

  public traverse = (file: string, options: TraverseOptions) => {
    return traverse(this.store.parse(file), options);
  };

  public getImports = (file: string): Array<ResolvedImport> => {
    const extractedImports = this.store.reads.get<
      Record<string, Array<ResolvedImport>>
    >(["detailed_imports"]);

    if (extractedImports[file]) {
      return extractedImports[file];
    }

    const detailedImports: Array<ResolvedImport> = [];
    this.traverse(file, {
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
        detailedImports.push({
          file: Utils.resolveImport(file, importArgumentString.value),
          assignee: declarator.id.name,
          exportName: "dynamic",
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
        detailedImports.push({
          file: Utils.resolveImport(file, importDeclaration.node.source.value),
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
        detailedImports.push({
          file: Utils.resolveImport(file, importDeclaration.node.source.value),
          assignee: path.node.local.name,
          exportName: "default",
        });
      },
    });

    this.store.writes.merge<Array<ResolvedImport>>(["detailed_imports"], {
      [file]: detailedImports,
    });

    return detailedImports;
  };

  public extractFilePaths = (file: string): Array<string> => {
    const usedTree = this.store.reads.get<Record<string, Array<string>>>([
      "used_tree",
    ]);

    if (usedTree[file]) {
      return usedTree[file];
    }

    const recursiveExtract = (
      entryPath: string,
      extractedImports: Array<string> = []
    ) => {
      const resolvedImports = this.getImports(entryPath);
      extractedImports.push(entryPath);
      const unwalkedFilePaths = resolvedImports
        .filter(
          (resolvedImport) => !extractedImports.includes(resolvedImport.file)
        )
        .map((resolvedImport) => resolvedImport.file)
        .filter((unwalkedFilePath) =>
          Utils.validExts.some((validExt) =>
            unwalkedFilePath.endsWith(validExt)
          )
        );
      if (unwalkedFilePaths.length === 0) {
        return;
      }
      unwalkedFilePaths.forEach((unwalkedFilePath) =>
        recursiveExtract(unwalkedFilePath, extractedImports)
      );
    };

    const extractedFilePaths: Array<string> = [];
    recursiveExtract(file, extractedFilePaths);

    this.store.writes.merge<Array<string>>(["used_tree"], {
      [file]: extractedFilePaths,
    });

    return extractedFilePaths;
  };
}

export default STraversals;
