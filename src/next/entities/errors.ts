import { Node as BabelNode } from "@babel/traverse";
import type * as Classes from "./index";
import {
  ASTNode as JSCodeshiftNode,
  Node as JscodeshiftNode,
} from "jscodeshift";
import colors from "colors/safe";
import { existsSync, readFileSync } from "fs";
import { stripIndent } from "common-tags";
import { isEqual, omit } from "lodash";

type LocPosition = {
  start: {
    line: number;
    column: number;
  };
  end: {
    line: number;
    column: number;
  };
};

export interface IErrorOrWarning {
  info: {
    loc: LocPosition;
    micro: string;
    file: string;
    line: string;
    column: string;
    source: string;
    timestamp: number;
  };
  message: string;
}

class Errors {
  private store: Classes.store;

  constructor(store: Classes.store) {
    this.store = store;
    this.store.registerAccessPath(["errors"], []);
    this.store.registerAccessPath(["warnings"], []);
  }

  private parseNode = (node: BabelNode | JscodeshiftNode, filePath: string) => {
    const line = node.loc.start.line;
    const column = node.loc.start.column;
    const source = readFileSync(filePath, "utf-8")
      .split("\n")
      .slice(node.loc.start.line - 1, node.loc.end.line);
    return {
      loc: {
        start: {
          line: node.loc.start.line,
          column: node.loc.start.column,
        },
        end: {
          line: node.loc.end.line,
          column: node.loc.end.column,
        },
      },
      line,
      column,
      source,
    };
  };

  private buildMessage = (
    message: string,
    infoColumns: Array<[label: string, message: string]>,
    source: string
  ) =>
    ` \`\`\`${colors.bold("message")}\n ${message}\n \`\`\`` +
    "\n" +
    infoColumns
      .map(([infoLabel, infoMessage]) => ` ${infoLabel}: ${infoMessage}`)
      .concat([` \`\`\`${colors.bold("code")}\n ${source}\n \`\`\``])
      .join("\n") +
    "\n";

  public log = () => {
    return this.store.reads
      .get<Array<IErrorOrWarning>>(["errors"])
      .map(({ info, message }) => {
        console.log(
          this.buildMessage(
            message,
            [
              [colors.bold("micro"), info.micro],
              [colors.bold("file"), info.file.replace(process.cwd(), "")],
              [colors.bold("line"), info.line],
              [colors.bold("column"), info.column],
            ],
            colors.red(stripIndent`${info.source}`)
          )
        );
      });
  };

  public getErrors = () => {
    return this.store.reads.get<Array<IErrorOrWarning>>(["errors"]);
  };

  public getWarnings = () => {
    return this.store.reads.get<Array<IErrorOrWarning>>(["warnings"]);
  };

  public reportError = (
    message: string,
    filePath: string,
    node: BabelNode | JSCodeshiftNode = null
  ) => {
    if (!existsSync(filePath)) {
      throw new Error(
        `Must include a path that exists to report an error. Invalid: ${filePath}`
      );
    }
    const {
      line = "unknown",
      column = "unknown",
      source = "unknown",
      loc,
    } = this.parseNode(node, filePath) || {};
    const error = {
      info: {
        loc,
        micro: `${this.store.accessMicroName()}`,
        file: filePath,
        line: `${line}`,
        column: `${column}`,
        source: `${source}`,
        timestamp: Date.now(),
      },
      message: message.replaceAll(process.cwd(), ""),
    };
    try {
      JSON.stringify(error);
    } catch (err) {
      throw new Error(`Provided error message is not serializable: ${message}`);
    }
    const preexistingErrors = this.store.reads.get<Array<IErrorOrWarning>>([
      "errors",
    ]);
    const matchingError = preexistingErrors.find((preexistingError) =>
      isEqual(
        omit(preexistingError, ["info.timestamp"]),
        omit(error, ["info.timestamp"])
      )
    );
    if (matchingError) {
      return;
    }
    this.store.writes.unshift<IErrorOrWarning>(["errors"], error);
  };

  public reportWarning = (
    message: string,
    filePath: string,
    node: BabelNode | JSCodeshiftNode = null
  ) => {
    if (!existsSync(filePath)) {
      throw new Error(
        `Must include a path that exists to report an error. Invalid: ${filePath}`
      );
    }
    const {
      line = "unknown",
      column = "unknown",
      source = "unknown",
      loc,
    } = this.parseNode(node, filePath) || {};
    const warning = {
      info: {
        loc,
        micro: `${this.store.accessMicroName()}`,
        file: filePath,
        line: `${line}`,
        column: `${column}`,
        source: `${source}`,
        timestamp: Date.now(),
      },
      message: message.replaceAll(process.cwd(), ""),
    };
    try {
      JSON.stringify(warning);
    } catch (err) {
      throw new Error(
        `Provided warning message is not serializable: ${message}`
      );
    }
    const preexistingErrors = this.store.reads.get<Array<IErrorOrWarning>>([
      "warnings",
    ]);
    const matchingWarning = preexistingErrors.find((preexistingError) =>
      isEqual(
        omit(preexistingError, ["info.timestamp"]),
        omit(warning, ["info.timestamp"])
      )
    );
    if (matchingWarning) {
      return;
    }
    this.store.writes.unshift<IErrorOrWarning>(["warnings"], warning);
  };
}

export default Errors;
