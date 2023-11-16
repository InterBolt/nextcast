// import { JSCodeshift, Collection } from "jscodeshift";
import type MicroStore from "./classes/MicroStore";
import type SApp from "./classes/SApp";
import type SErrors from "./classes/SErrors";
import type STraversals from "./classes/STraversals";
import parser from "@babel/parser";

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

export type SharedContext<Config extends Record<string, any> = any> = {
  config: Config;
  project: ProjectInfo;
  parse: MicroStore["parse"];
  traverse: STraversals["traverse"];
  codemod: STraversals["codemod"];
  getDetailedImports: STraversals["getDetailedImports"];
  getRoutes: SApp["getRoutes"];
  getErrors: SErrors["getErrors"];
  reportError: SErrors["reportError"];
  getWarnings: SErrors["getWarnings"];
  reportWarning: SErrors["reportWarning"];
  collect: SApp["collect"];
};

export type CollectorContext<Config extends Record<string, any> = any> = {
  getCollection: SApp["getCollection"];
} & SharedContext<Config>;

export type ReducerContext<Config extends Record<string, any> = any> = {
  collection: JSONValue;
} & SharedContext<Config>;

export type RewriterContext<
  Config extends Record<string, any> = any,
  Reduced extends JSONValue = JSONValue
> = {
  collection: JSONValue;
  data: Reduced;
} & SharedContext<Config>;

export type Route = {
  name: string;
  entries: Array<string>;
  files: Array<string>;
};

export type Collector<Config extends Record<string, any> = any> = (
  ctx: CollectorContext<Config>
) => Promise<void>;

export type Rewriter<Config extends Record<string, any> = any> = (
  ctx: RewriterContext<Config>
) => Promise<void>;

export type Reducer<Config extends Record<string, any> = any> = (
  ctx: ReducerContext<Config>
) => Promise<JSONValue>;

export interface MicroPackBase<Config extends Record<string, any>> {
  name: string;
  config: Config;
  collector?: Collector<Config>;
  reducer?: Reducer<Config>;
  rewriter?: Rewriter<Config>;
}

export class Pack<Config extends Record<string, any> = any>
  implements MicroPackBase<Config>
{
  public name: string;
  public config: Config;

  public collector?: Collector<Config>;
  public reducer?: Reducer<Config>;
  public rewriter?: Rewriter<Config>;
}

export type PackCoreOptions = {
  inputDir?: string;
  rewrite?: boolean;
  dataDir?: string;
};
