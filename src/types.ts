import { JSCodeshift, Collection } from "jscodeshift";
import type * as Classes from "./classes/types";
import type * as Utils from "./utils/index";
import parser from "@babel/parser";

interface JSONArray extends Array<JSONValue> {}

export type JSONValue =
  | string
  | number
  | boolean
  | null
  | { [member: string]: JSONValue }
  | JSONArray;

export type ResolvedImport = {
  filePath: string;
  exportName?: "unknown" | "default" | string;
  assignee?: string;
};

export type ParsedBabel = {
  ast: ReturnType<typeof parser.parse>;
  sourceCode: string;
  filePath: string;
};

export type ParsedJscodeshift = {
  collection: Collection<any>;
  sourceCode: string;
  filePath: string;
};

export type NextJSUtils = typeof Utils.nextjs;

export type NextJSCollectorContext<
  Config extends Record<string, any> = any,
  Options extends MacroOptions<any> = MacroOptions<Config>
> = {
  _unstable_traversals: Classes.Traversals;
  tsconfig?: any;
  projectRoot: string;
  getResolvedImports: Classes.Traversals["getResolvedImports"];
  resolveImport: (filePath: string, importPath: string) => string;
  traverseBabel: Classes.Traversals["babel"];
  getCacheHistory: Classes.Cache["getHistory"];
  parse: Classes.Cache["parseBabel"];
  nextjsUtils: NextJSUtils;
  getCollection: Classes.App["getCollection"];
  getRoutes: Classes.App["getRoutes"];
  getErrors: ReturnType<Classes.Errors["createErrorGetter"]>;
  reportError: ReturnType<Classes.Errors["createBabelReporter"]>;
  collect: Classes.App["collect"];
  options: Options;
  macroConfig: Config;
};

export type NextJSRewriterContext<
  Config extends Record<string, any> = any,
  Options extends MacroOptions<any> = MacroOptions<Config>,
  Reduced extends JSONValue = JSONValue
> = {
  _unstable_traversals: Classes.Traversals;
  _unstable_getCodemods: (collection: Collection) => Classes.Codemods;
  traverseBabel: Classes.Traversals["babel"];
  tsconfig?: any;
  projectRoot: string;
  jscodeshift: JSCodeshift;
  getCacheHistory: Classes.Cache["getHistory"];
  parse: Classes.Cache["parseJscodeshift"];
  nextjsUtils: NextJSUtils;
  reduced: Reduced;
  collection: JSONValue;
  getCollection: Classes.App["getCollection"];
  getRoutes: Classes.App["getRoutes"];
  getErrors: ReturnType<Classes.Errors["createErrorGetter"]>;
  reportError: ReturnType<Classes.Errors["createJscodeshiftReporter"]>;
  collect: Classes.App["collect"];
  options: Options;
  macroConfig: Config;
};

export type NextJSReducerContext<
  Config extends Record<string, any> = any,
  Options extends MacroOptions<any> = MacroOptions<Config>
> = {
  _unstable_traversals: Classes.Traversals;
  traverseBabel: Classes.Traversals["babel"];
  tsconfig?: any;
  projectRoot: string;
  getCacheHistory: Classes.Cache["getHistory"];
  nextjsUtils: NextJSUtils;
  parse: Classes.Cache["parseBabel"];
  getCollection: Classes.App["getCollection"];
  getRoutes: Classes.App["getRoutes"];
  reportError: ReturnType<Classes.Errors["createBabelReporter"]>;
  collection: JSONValue;
  options: Options;
  macroConfig: Config;
};

export type Segment = {
  name: string;
  entries: Array<string>;
  files: Array<string>;
};

export type NextJSCollector<Config extends Record<string, any> = any> = (
  ctx: NextJSCollectorContext<Config>
) => Promise<void>;

export type NextJSRewriter<Config extends Record<string, any> = any> = (
  ctx: NextJSRewriterContext<Config>
) => Promise<void>;

export type NextJSReducer<Config extends Record<string, any> = any> = (
  ctx: NextJSReducerContext<Config>
) => Promise<JSONValue>;

export type NextJSMacro<Config extends Record<string, any>> = {
  collector: NextJSCollector<Config>;
  rewriter: NextJSRewriter<Config>;
  reducer: NextJSReducer<Config>;
};

export type MacroOptions<Config extends Record<string, any> = any> = {
  macro: NextJSMacro<Config>;
  macroConfig: Config;
  name: string;
  rewrite?: boolean;
  dataDir?: string;
};

export type WithMacropackOptions = Array<MacroOptions>;
