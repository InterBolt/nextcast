import jscodeshift from "jscodeshift";
import colors from "colors/safe";

const buildError = (
  macroName: string,
  path: string,
  astPath: jscodeshift.ASTPath<any>,
  message: string
): string => {
  const lineNumber = astPath.node.loc.start.line;
  const columnNumber = astPath.node.loc.start.column;
  const source =
    (astPath.node.loc as any)?.lines?.infos ||
    []
      .slice(astPath.node.loc.start.line - 1, astPath.node.loc.end.line)
      .map((d) => d.line)
      .join("\n");
  const errorFields = [
    `macro: ${macroName}`,
    `location: ${path}`,
    `line:${lineNumber}`,
    `column:${columnNumber}`,
    `source:\n${source}`,
  ];
  return `\n${colors.bgRed(message)}\n${colors.bold(errorFields.join("\n"))}\n`;
};

export default buildError;
