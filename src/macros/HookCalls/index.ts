export type Config = {
  path: string;
  exportIdentifier?: string;
  allowedArgTypes?: Array<string>;
};

export { default as reducer } from "./reducer";
export { default as collector } from "./collector";
export { default as rewriter } from "./rewriter";
