import traverse, { TraverseOptions } from "@babel/traverse";
import jscodeshift from "jscodeshift";
import { readFileSync, existsSync } from "fs";
import MicroStore from "./MicroStore/index";
import * as Utils from "../utils";

type ResolvedImport = {
  filePath: string;
  exportName?: "unknown" | "default" | string;
  assignee?: string;
};

class STraversals {
  private store: MicroStore;

  constructor(store: MicroStore) {
    this.store = store;
    this.store.registerAccessPath(["used_tree"], {});
    this.store.registerAccessPath(["detailed_imports"], {});
  }

  public codemod = (filePath: string) => {
    if (!existsSync(filePath)) {
      throw new Error(`Cannot parse ${filePath} because it does not exist.`);
    }

    const sourceCode = readFileSync(filePath, "utf8");
    return jscodeshift.withParser("tsx")(sourceCode);
  };

  public traverse = (filePath: string, options: TraverseOptions) => {
    return traverse(this.store.parse(filePath), options);
  };

  public getDetailedImports = (filePath: string): Array<ResolvedImport> => {
    const extractedImports = this.store.reads.get<
      Record<string, Array<ResolvedImport>>
    >(["detailed_imports"]);

    if (extractedImports[filePath]) {
      return extractedImports[filePath];
    }

    const detailedImports: Array<ResolvedImport> = [];
    this.traverse(filePath, {
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
          filePath: Utils.resolveImport(filePath, importArgumentString.value),
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
        detailedImports.push({
          filePath: Utils.resolveImport(
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
        detailedImports.push({
          filePath: Utils.resolveImport(
            filePath,
            importDeclaration.node.source.value
          ),
          assignee: path.node.local.name,
          exportName: "default",
        });
      },
    });

    this.store.writes.merge<Array<ResolvedImport>>(["detailed_imports"], {
      [filePath]: detailedImports,
    });

    return detailedImports;
  };

  public extractFilePaths = (filePath: string): Array<string> => {
    const usedTree = this.store.reads.get<Record<string, Array<string>>>([
      "used_tree",
    ]);

    if (usedTree[filePath]) {
      return usedTree[filePath];
    }

    const recursiveExtract = (
      entryPath: string,
      extractedImports: Array<string> = []
    ) => {
      const resolvedImports = this.getDetailedImports(entryPath);
      extractedImports.push(entryPath);
      const unwalkedFilePaths = resolvedImports
        .filter(
          (resolvedImport) =>
            !extractedImports.includes(resolvedImport.filePath)
        )
        .map((resolvedImport) => resolvedImport.filePath)
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
    recursiveExtract(filePath, extractedFilePaths);

    this.store.writes.merge<Array<string>>(["used_tree"], {
      [filePath]: extractedFilePaths,
    });

    return extractedFilePaths;
  };
}

export default STraversals;
