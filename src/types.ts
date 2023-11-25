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
  save: SApp["save"];
  queueRewrite: SApp["queueRewrite"];
  dangerouslyQueueRewrite: SApp["dangerouslyQueueRewrite"];
  reportError: SErrors["reportError"];
  reportWarning: SErrors["reportWarning"];
  getRewrites: SApp["getRewrites"];
  getCollected: SApp["getCollected"];
  getSaved: SApp["getSaved"];
  getSavedHistory: SApp["getSavedHistory"];
  getErrors: SErrors["getErrors"];
  getWarnings: SErrors["getWarnings"];
  _: {
    getImports: STraversals["getImports"];
    getClientComponents: SApp["getClientComponents"];
    getServerComponents: SApp["getServerComponents"];
  };
};

export type PluginCtx = {
  sourceFiles: ReturnType<SApp["getSourceFiles"]>;
  routes: ReturnType<SApp["getRoutes"]>;
  data?: JSONValue;
};

export type Route = {
  name: string;
  entries: Array<string>;
  files: Array<string>;
  serverComponents: Array<string>;
  clientComponents: Array<string>;
};

export type Collector = (ctx: PluginCtx, api: PluginApi) => undefined;

export type Builder = (ctx: PluginCtx, api: PluginApi) => Promise<undefined>;

export type Rewriter = <T>(ctx: PluginCtx, api: PluginApi) => undefined;

export class Plugin<Config extends Record<string, any>> {
  public name: string;
  public config: Config;

  public collector: Collector;
  public builder?: Builder;
  public rewriter?: Rewriter;
}

export type NextCtx = {
  routes: Array<{
    name: string;
    entries: Array<string>;
    files: Array<string>;
    clientComponents: Array<string>;
    serverComponents: Array<string>;
  }>;
};

export type CoreOptions = {
  inputDir?: string;
  rewrite?: boolean;
  nextcastDir?: string;
};

export type WithNextCastOptions = {
  plugins?:
    | ((userPlugins: Array<Plugin<any>>) => Array<string | Plugin<any>>)
    | Array<string | Plugin<any>>;
};
