import jscodeshift from "jscodeshift";

export type Config = {
  path: string;
  exportIdentifier?: string;
  allowedArgTypes?: Array<typeof jscodeshift.types.namedTypes>;
};

export { default as collector } from "./collector";
export { default as rewriter } from "./rewriter";
