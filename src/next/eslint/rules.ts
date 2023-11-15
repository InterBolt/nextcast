import { resolve } from "path";
import { existsSync, readFileSync, readdirSync } from "fs";
import type { Rule } from "eslint";
import type { IErrorOrWarning } from "../entities/errors";
import constants from "../constants";

const reportErrorsOrWarnings = (
  context: Rule.RuleContext,
  level: "warning" | "error"
) => {
  const dataDir = resolve(context.cwd, `.${constants.name}`);
  if (!existsSync(dataDir)) {
    return;
  }

  const errorPaths = readdirSync(dataDir)
    .map((name) =>
      resolve(
        dataDir,
        name,
        level === "warning"
          ? constants.warningsFileName
          : constants.errorsFileName
      )
    )
    .filter((path) => existsSync(path));

  errorPaths.forEach((errorPath) => {
    const errors = JSON.parse(readFileSync(errorPath, "utf-8"));
    const relevantErrors = errors.filter(
      (e: IErrorOrWarning) => e.info.file === context.filename
    );

    relevantErrors.forEach((relevantError: IErrorOrWarning) => {
      context.report({
        message: relevantError.message,
        loc: {
          start: {
            line: relevantError.info.loc.start.line,
            column: relevantError.info.loc.start.column,
          },
          end: {
            line: relevantError.info.loc.end.line,
            column: relevantError.info.loc.end.column,
          },
        },
      });
    });
  });
};

export const eslintErrorRule = {
  create(context: Rule.RuleContext) {
    return {
      Program() {
        reportErrorsOrWarnings(context, "error");
      },
    };
  },
};

export const eslintWarningRule = {
  create(context: Rule.RuleContext) {
    return {
      Program() {
        reportErrorsOrWarnings(context, "warning");
      },
    };
  },
};
