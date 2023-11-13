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

export interface IError {
  info: {
    loc: LocPosition;
    phase: string;
    macro: string;
    parser: string;
    file: string;
    line: string;
    column: string;
    source: string;
    timestamp: number;
  };
  message: string;
}

class Errors {
  private cache: Classes.cache;

  constructor(cache: Classes.cache) {
    this.cache = cache;
    this.cache.register(["errors"], []);
  }

  private parseBabelNode = (node: BabelNode, filePath: string) => {
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

  private parseJscodeshiftPath = (node: JscodeshiftNode, filePath: string) => {
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
    return this.cache
      .get<Array<IError>>(["errors"])
      .map(({ info, message }) => {
        console.log(
          this.buildMessage(
            message,
            [
              [colors.bold("phase"), info.phase],
              [colors.bold("macro"), info.macro],
              [colors.bold("parser"), info.parser],
              [colors.bold("file"), info.file.replace(process.cwd(), "")],
              [colors.bold("line"), info.line],
              [colors.bold("column"), info.column],
            ],
            colors.red(stripIndent`${info.source}`)
          )
        );
      });
  };

  public createErrorGetter = (fallbackPhase: string) => {
    return (phase: string = fallbackPhase) => {
      return this.cache
        .get<Array<IError>>(["errors"])
        .filter((error) => error.info.phase === phase);
    };
  };

  public get = () => {
    return this.cache.get<Array<IError>>(["errors"]);
  };

  public createJscodeshiftReporter = (phase: string) => {
    return (
      message: string,
      node: JSCodeshiftNode = null,
      filePath: string
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
      } = this.parseJscodeshiftPath(node, filePath) || {};
      const error = {
        info: {
          loc,
          phase,
          macro: `${this.cache.getMacroName()}`,
          parser: "jscodeshift",
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
        throw new Error(
          `Provided error message is not serializable: ${message}`
        );
      }
      const preexistingErrors = this.cache.get<Array<IError>>(["errors"]);
      const matchingError = preexistingErrors.find((preexistingError) =>
        isEqual(
          omit(preexistingError, ["info.timestamp"]),
          omit(error, ["info.timestamp"])
        )
      );
      if (matchingError) {
        return;
      }
      this.cache.unshift<IError>(["errors"], error);
    };
  };

  public createBabelReporter = (phase: string) => {
    return (message: string, node: BabelNode = null, filePath: string) => {
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
      } = this.parseBabelNode(node, filePath) || {};
      const error = {
        info: {
          loc,
          phase,
          macro: `${this.cache.getMacroName()}`,
          parser: "babel",
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
        throw new Error(
          `Provided error message is not serializable: ${message}`
        );
      }
      const preexistingErrors = this.cache.get<Array<IError>>(["errors"]);
      const matchingError = preexistingErrors.find((preexistingError) =>
        isEqual(
          omit(preexistingError, ["info.timestamp"]),
          omit(error, ["info.timestamp"])
        )
      );
      if (matchingError) {
        return;
      }
      this.cache.unshift<IError>(["errors"], error);
    };
  };
}

export default Errors;
