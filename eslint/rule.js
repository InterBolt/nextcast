const { resolve } = require("path");
const { existsSync, readFileSync, readdirSync } = require("fs");

module.exports = {
  create(context) {
    return {
      Program() {
        const dataDir = resolve(context.cwd, ".micropack");
        if (!existsSync(dataDir)) {
          return;
        }

        const errorPaths = readdirSync(dataDir)
          .map((name) => resolve(dataDir, name, "errors.json"))
          .filter((path) => existsSync(path));

        errorPaths.forEach((errorPath) => {
          const errors = JSON.parse(readFileSync(errorPath, "utf-8"));
          const relevantErrors = errors.filter(
            (e) => e.info.file === context.filename
          );

          relevantErrors.forEach((relevantError) => {
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
      },
    };
  },
};
