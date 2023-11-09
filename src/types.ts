import { JSCodeshift, Collection } from "jscodeshift";
import * as Classes from "./classes";

export type MacroConfigExtends = {
  [k in string]: any;
};

export type CollectorFile = {
  astCollection: Collection;
  sourceCode: string;
  filePath: string;
};

export type MacroContext<
  Config extends MacroConfigExtends = any,
  Options extends MacroOptions<any> = MacroOptions<Config>
> = {
  cache: Classes.cache;
  jscodeshift: JSCodeshift;
  options: Options;
};

export type CollectorSegment = {
  name: string;
  entries: Array<string>;
  files: Array<CollectorFile>;
};

export type Collector<Config extends MacroConfigExtends = any> = (
  ctx: MacroContext<Config>
) => Promise<void>;

export type Rewriter<Config extends MacroConfigExtends = any> = (
  ctx: MacroContext<Config>
) => Promise<void>;

export type Macro<Config extends MacroConfigExtends> = {
  collector: Collector<Config>;
  rewriter: Rewriter<Config>;
};

export type MacroOptions<Config extends MacroConfigExtends = any> = {
  macro: Macro<Config>;
  macroConfig: Config;
  name: string;
  dataPath?: string;
};
