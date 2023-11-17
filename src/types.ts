import parser from "@babel/parser";
import type Store from "./classes/Store";
import type SApp from "./classes/SApp";
import type SErrors from "./classes/SErrors";
import type STraversals from "./classes/STraversals";

interface JSONArray extends Array<JSONValue> {}

export type JSONValue =
  | string
  | number
  | boolean
  | null
  | { [member: string]: JSONValue }
  | JSONArray;

export type ParsedBabel = ReturnType<typeof parser.parse>;

export type ProjectInfo = {
  root: string;
  tsconfig?: any;
};

export type SharedCtx<Config extends Record<string, any> = any> = {
  config: Config;
  project: ProjectInfo;
  parse: Store["parse"];
  babelTraverse: STraversals["babelTraverse"];
  jscodeshift: STraversals["jscodeshift"];
  getDetailedImports: STraversals["getDetailedImports"];
  getSourceFiles: SApp["getSourceFiles"];
  getRoutes: SApp["getRoutes"];
  getClientComponents: SApp["getClientComponents"];
  getServerComponents: SApp["getServerComponents"];
  getErrors: SErrors["getErrors"];
  reportError: SErrors["reportError"];
  getWarnings: SErrors["getWarnings"];
  reportWarning: SErrors["reportWarning"];
  collect: SApp["collect"];
};

export type CollectorCtx<Config extends Record<string, any> = any> = {
  getCollection: SApp["getCollection"];
} & SharedCtx<Config>;

export type ReducerCtx<Config extends Record<string, any> = any> = {
  collection: JSONValue;
} & SharedCtx<Config>;

export type RewriterCtx<
  Config extends Record<string, any> = any,
  Reduced extends JSONValue = JSONValue
> = {
  collection: JSONValue;
  data: Reduced;
} & SharedCtx<Config>;

export type Route = {
  name: string;
  entries: Array<string>;
  files: Array<string>;
  serverComponents: Array<string>;
  clientComponents: Array<string>;
};

export type Collector<Config extends Record<string, any> = any> = (
  ctx: CollectorCtx<Config>
) => Promise<void>;

export type Rewriter<Config extends Record<string, any> = any> = (
  ctx: RewriterCtx<Config>
) => Promise<void>;

export type Reducer<Config extends Record<string, any> = any> = (
  ctx: ReducerCtx<Config>
) => Promise<JSONValue>;

export interface PluginBase<Config extends Record<string, any>> {
  name: string;
  config: Config;
  collector?: Collector<Config>;
  reducer?: Reducer<Config>;
  rewriter?: Rewriter<Config>;
}

export class CustomPlugin<Config extends Record<string, any> = any>
  implements PluginBase<Config>
{
  public name: string;
  public config: Config;

  public collector?: Collector<Config>;
  public reducer?: Reducer<Config>;
  public rewriter?: Rewriter<Config>;
}

export type CoreOptions = {
  inputDir?: string;
  rewrite?: boolean;
  nextcastDir?: string;
};
