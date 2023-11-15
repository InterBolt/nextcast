import { eslintErrorRule, eslintWarningRule } from "./rules";

const eslintPlugin = {
  rules: {
    error: eslintErrorRule,
    warn: eslintWarningRule,
  },
};

export default eslintPlugin;

module.exports = eslintPlugin;
