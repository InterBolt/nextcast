// import { JSCodeshift, Collection } from "jscodeshift";
import type * as Classes from "./entities/types";
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

export type SharedContext<
  Config extends Record<string, any> = any,
  ProvidedOptions extends Options = Options
> = {
  options: ProvidedOptions;
  config: Config;
  project: ProjectInfo;
  parse: Classes.Store["parse"];
  traverse: Classes.Traversals["traverse"];
  codemod: Classes.Traversals["codemod"];
  getDetailedImports: Classes.Traversals["getDetailedImports"];
  getRoutes: Classes.NextJsApp["getRoutes"];
  getErrors: Classes.Errors["getErrors"];
  reportError: Classes.Errors["reportError"];
  getWarnings: Classes.Errors["getWarnings"];
  reportWarning: Classes.Errors["reportWarning"];
  collect: Classes.NextJsApp["collect"];
};

export type CollectorContext<
  Config extends Record<string, any> = any,
  ProvidedOptions extends Options = Options
> = {
  getCollection: Classes.NextJsApp["getCollection"];
} & SharedContext<Config, ProvidedOptions>;

export type ReducerContext<
  Config extends Record<string, any> = any,
  ProvidedOptions extends Options = Options
> = {
  collection: JSONValue;
} & SharedContext<Config, ProvidedOptions>;

export type RewriterContext<
  Config extends Record<string, any> = any,
  Reduced extends JSONValue = JSONValue,
  ProvidedOptions extends Options = Options
> = {
  collection: JSONValue;
  data: Reduced;
} & SharedContext<Config, ProvidedOptions>;

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

export interface DefinitionConstructor<
  Config extends Record<string, any> = any
> {
  new (config: Config, name: string): Definition<Config>;
}

export interface Definition<Config extends Record<string, any>> {
  name: string;
  config: Config;
  collector?: Collector<Config>;
  reducer?: Reducer<Config>;
  rewriter?: Rewriter<Config>;
}

export type Options = {
  inputDir?: string;
  rewrite?: boolean;
  dataDir?: string;
};

export type WithMicropackOptions = Array<Options>;
