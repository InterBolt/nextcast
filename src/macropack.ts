import * as fs from "fs";
import { dirname, resolve } from "path";
import { default as jscodeshift } from "jscodeshift";
import * as Utils from "./utils";
import type * as Types from "./types";
import * as Classes from "./classes";
import appRootPath from "app-root-path";

const withDefaultOptions = (options: Types.MacroOptions) => {
  if (!options.dataPath) {
    options.dataPath = resolve(
      appRootPath.path,
      ".macropack",
      `${options.name}.json`
    );
  }
  if (!options.dataPath.endsWith(".json")) {
    throw new Error(`outFile must be a .json file`);
  }

  const outDir = dirname(options.dataPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir);
  }
};

const build = async <MacroConfig extends any>(
  options: Types.MacroOptions<MacroConfig>,
  suppliedFs: Utils.Types.InputFileSystem = fs
) => {
  withDefaultOptions(options);

  const segments = await Utils.nextjs.getSegments();
  const cache = new Classes.cache();
  const ctx: Types.MacroContext = { cache, jscodeshift, options };

  cache.open(options.name, segments);

  Utils.parse(ctx.cache);

  await ctx.options.macro.collector?.(ctx);
  await ctx.options.macro.rewriter?.(ctx);

  const rewrites = cache.getRewrites();
  const errors = cache.getErrors();
  const data = {
    segments: cache.getSegmentData(),
    shared: cache.getData(),
  };

  const frozenCache = cache.close();

  if (errors.length) {
    throw new Error(errors.join("\n"));
  }

  // Utils.rewrite(rewrites, suppliedFs);
  fs.writeFileSync(options.dataPath, JSON.stringify(data, null, 2));

  return {
    cache: frozenCache,
    data,
  };
};

export default build;
