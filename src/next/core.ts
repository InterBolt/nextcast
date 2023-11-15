import { resolve } from "path";
import { mkdirSync, existsSync } from "fs";
import type * as Types from "./types";
import * as Utils from "./utils";
import * as Classes from "./entities/index";
import constants from "./constants";

export const buildOptions = <BuiltOptions extends Types.Options>(
  name: string,
  options: BuiltOptions
): BuiltOptions => {
  const baseDir = resolve(Utils.getProjectRoot(), `.${constants.name}`);
  if (!existsSync(baseDir)) {
    mkdirSync(baseDir);
  }

  const dataDir = resolve(baseDir, name);
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir);
  }

  options.dataDir = dataDir;
  options.rewrite = !!options.rewrite || false;
  options.inputDir = options.inputDir || "micropacks";

  return options;
};

const core = async <MicroConfig extends any>(
  micro: Types.Definition<MicroConfig>,
  suppliedOptions: Types.Options,
  prevParseCache: Record<string, Types.ParsedBabel> = {}
) => {
  try {
    // setup options with defaults
    buildOptions(micro.name, suppliedOptions);
    const options = suppliedOptions;

    // setup cache and start the micro
    const store = new Classes.store();
    store._dangerouslyStartMicro(micro.name, prevParseCache);

    // setup setup errors, traversals, and pages
    const errors = new Classes.errors(store);
    const traversals = new Classes.traversals(store);
    const nextjsApp = new Classes.nextjsApp(store, traversals);

    // will find and map all the files associated with each route (aka segment)
    // by following the nextjs conventions for app router files.
    await nextjsApp.loadRoutes();

    const root = Utils.getProjectRoot();
    const tsconfig = (() => {
      try {
        return require(resolve(root, "tsconfig.json"));
      } catch (err) {
        return undefined;
      }
    })();

    const ContextShared: Types.SharedContext = {
      project: {
        root,
        tsconfig,
      },
      config: micro.config,
      options,
      parse: store.parse,
      traverse: traversals.traverse,
      codemod: traversals.codemod,
      getDetailedImports: traversals.getDetailedImports,
      getRoutes: nextjsApp.getRoutes,
      getErrors: errors.getErrors,
      getWarnings: errors.getWarnings,
      reportError: errors.reportError,
      reportWarning: errors.reportWarning,
      collect: nextjsApp.collect,
    };

    // run the collector, a function that can "collect" information about
    // the files in the project. This is the first phase of the micro.
    await micro.collector?.({
      ...ContextShared,
      getCollection: nextjsApp.getCollection,
    });

    // run the reducer, a function that can "reduce" the information collected in
    // the previous step.
    const data = micro.reducer
      ? await micro.reducer({
          ...ContextShared,
          collection: JSON.parse(JSON.stringify(nextjsApp.getCollection())),
        })
      : JSON.parse(JSON.stringify(nextjsApp.getCollection()));

    await micro.rewriter?.({
      ...ContextShared,
      data: JSON.parse(JSON.stringify(data)),
      collection: JSON.parse(JSON.stringify(nextjsApp.getCollection())),
    });

    nextjsApp.stashCollection(options.dataDir);
    nextjsApp.stashReducedCollection(options.dataDir, data);
    nextjsApp.stashErrors(options.dataDir, errors.getErrors() as any);
    nextjsApp.stashWarnings(options.dataDir, errors.getWarnings() as any);
    nextjsApp.stashRewrites(options.dataDir);

    if (options.rewrite === true) {
      // we only throw if there are errors in the rewriter phase
      // otherwise, we just log and pass them to the potential next micro
      const foundErrors = errors.getErrors();
      if (foundErrors.length > 0) {
        errors.log();
        throw new Error(
          `Errors found in micro ${micro.name}. See above for details.`
        );
      }
      nextjsApp.executeRewrites(options.dataDir);
    }

    const parseCache = store.getParseCache();

    const resolveData = {
      parseCache,
      errors: errors.getErrors(),
      warnings: errors.getWarnings(),
      reduced: JSON.parse(JSON.stringify(data)),
      collection: JSON.parse(JSON.stringify(nextjsApp.getCollection())),
      pages: nextjsApp.getRoutes(),
      rewrites: nextjsApp.getRewrites(),
    };

    // end the micro so that its included in the cache history and
    // so that we can't do anything stupid to our state after this.
    store._dangerouslyEndMicro();

    return resolveData;
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

export default core;
