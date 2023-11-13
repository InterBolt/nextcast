import { resolve } from "path";
import { mkdirSync, existsSync } from "fs";
import type * as Types from "./types";
import * as Classes from "./classes";
import * as Utils from "./utils/index";
import { Collection, default as jscodeshift } from "jscodeshift";

export const buildOptions = <BuiltOptions extends Types.MacroOptions>(
  options: BuiltOptions
): BuiltOptions => {
  const baseDir = resolve(Utils.nextjs.getProjectRoot(), ".macropack");
  if (!existsSync(baseDir)) {
    mkdirSync(baseDir);
  }

  const macroDir = resolve(baseDir, options.name);
  if (!existsSync(macroDir)) {
    mkdirSync(macroDir);
  }

  options.dataDir = macroDir;
  options.rewrite = !!options.rewrite || false;

  return options;
};

export const macropackNextjs = async <MacroConfig extends any>(
  suppliedOptions: Types.MacroOptions<MacroConfig>
) => {
  try {
    // setup options with defaults
    buildOptions(suppliedOptions);
    const options = suppliedOptions;

    // setup cache and start the macro
    const cache = new Classes.cache();
    cache._dangerouslyStartMacro(options.name);

    // setup setup errors, traversals, and pages
    const errors = new Classes.errors(cache);
    const _unstable_traversals = new Classes.traversals(cache);
    const app = new Classes.app(cache, { _unstable_traversals });

    // will find and map all the files associated with each route (aka segment)
    // by following the nextjs conventions for app router files.
    await app.load();

    const projectRoot = Utils.nextjs.getProjectRoot();
    const tsconfig = (() => {
      try {
        return require(resolve(projectRoot, "tsconfig.json"));
      } catch (err) {
        return undefined;
      }
    })();

    // context that will remain the same between macro phases
    const ContextShared = {
      _unstable_traversals,
      tsconfig,
      projectRoot,
      getCacheHistory: cache.getHistory,
      nextjsUtils: Utils.nextjs,
      getCollection: app.getCollection,
      getRoutes: app.getRoutes,
      getErrors: errors.get,
      traverseBabel: _unstable_traversals.babel,
      collect: app.collect,
      macroConfig: options.macroConfig,
      options,
    };

    // run the collector, a function that can "collect" information about
    // the files in the project. This is the first phase of the macro.
    await options.macro.collector?.({
      ...ContextShared,
      resolveImport: Utils.nextjs.resolveImport,
      getResolvedImports: _unstable_traversals.getResolvedImports,
      parse: cache.parseBabel,
      reportError: errors.createBabelReporter("collector"),
    });

    // run the reducer, a function that can "reduce" the information collected in
    // the previous step.
    const reduced = options.macro.reducer ? (await options.macro.reducer({
      ...ContextShared,
      collection: JSON.parse(JSON.stringify(app.getCollection())),
      parse: cache.parseBabel,
      reportError: errors.createBabelReporter("reducer"),
    })) : JSON.parse(JSON.stringify(app.getCollection()));

    await options.macro.rewriter?.({
      ...ContextShared,
      _unstable_getCodemods: (collection: Collection) =>
        new Classes.codemods(collection),
      jscodeshift,
      reduced: JSON.parse(JSON.stringify(reduced)),
      collection: JSON.parse(JSON.stringify(app.getCollection())),
      parse: cache.parseJscodeshift,
      reportError: errors.createJscodeshiftReporter("rewriter"),
    });

    const rewriterErrors = errors.get();
    if (rewriterErrors.length > 0) {
      errors.log();
      throw new Error(
        `Errors found in macro ${options.name}. See above for details.`
      );
    }

    app.stashCollection(options.dataDir);
    app.stashReducedCollection(options.dataDir, reduced);
    app.stashErrors(options.dataDir, errors.get() as any); // so only when no errors exist, can we commit rewrites, for safety reasons
    app.stashRewrites(options.dataDir);

    if (options.rewrite === true) {
      // we only throw if there are errors in the rewriter phase
      // otherwise, we just log and pass them to the potential next macro
      const foundErrors = errors.get();
      if (foundErrors.length > 0) {
        errors.log();
        throw new Error(
          `Errors found in macro ${options.name}. See above for details.`
        );
      }
      app.executeRewrites(options.dataDir);
    }

    const resolveData = {
      cacheHistory: cache.getHistory(),
      errors: errors.get(),
      reduced: JSON.parse(JSON.stringify(reduced)),
      collection: JSON.parse(JSON.stringify(app.getCollection())),
      pages: app.getRoutes(),
      rewrites: app.getRewrites(),
    };

    // end the macro so that its included in the cache history and
    // so that we can't do anything stupid to our state after this.
    cache._dangerouslyEndMacro();

    return resolveData;
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
};
