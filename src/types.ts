import parser from "@babel/parser";
import type Store from "./classes/Store";
import type SApp from "./classes/SApp";
import type SErrors from "./classes/SErrors";
import type STraversals from "./classes/STraversals";
import SCodemod from "./classes/SCodemod";

interface JSONArray extends Array<JSONValue> {}

export type JSONValue =
  | string
  | number
  | boolean
  | null
  | { [member: string]: JSONValue }
  | JSONArray;

export type ParsedBabel = ReturnType<typeof parser.parse>;

export type PluginApi = {
  parse: Store["parse"];
  traverse: STraversals["traverse"];
  modify: SCodemod["modify"];
  collect: SApp["collect"];
  queueRewrite: SApp["queueRewrite"];
  dangerouslyQueueRewrite: SApp["dangerouslyQueueRewrite"];
  reportError: SErrors["reportError"];
  reportWarning: SErrors["reportWarning"];
  getRewrites: SApp["getRewrites"];
  getCollected: SApp["getCollected"];
  getErrors: SErrors["getErrors"];
  getWarnings: SErrors["getWarnings"];
  _: {
    getImports: STraversals["getImports"];
    getClientComponents: SApp["getClientComponents"];
    getServerComponents: SApp["getServerComponents"];
  };
};

export type SharedCtx<Reduced extends JSONValue = JSONValue> = {
  sourceFiles: ReturnType<SApp["getSourceFiles"]>;
  routes: ReturnType<SApp["getRoutes"]>;
  data: Reduced | null;
};

export type CollectorCtx = SharedCtx;

export type ReducerCtx = SharedCtx;

export type RewriterCtx<Reduced extends JSONValue = JSONValue> =
  SharedCtx<Reduced>;

export type Route = {
  name: string;
  entries: Array<string>;
  files: Array<string>;
  serverComponents: Array<string>;
  clientComponents: Array<string>;
};

export type Collector = (ctx: CollectorCtx, api: PluginApi) => Promise<void>;

export type Rewriter = (ctx: RewriterCtx, api: PluginApi) => Promise<void>;

export type Reducer = (ctx: ReducerCtx, api: PluginApi) => Promise<JSONValue>;

export class Plugin<Config extends Record<string, any>> {
  public name: string;
  public config: Config;

  public collector: Collector;
  public reducer?: Reducer;
  public rewriter?: Rewriter;
}

export type CoreOptions = {
  inputDir?: string;
  rewrite?: boolean;
  nextcastDir?: string;
};
