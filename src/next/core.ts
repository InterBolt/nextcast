import { resolve } from "path";
import { mkdirSync, existsSync } from "fs";
import type * as Types from "./types";
import * as Utils from "./utils";
import * as Classes from "./entities/index";

export const buildOptions = <BuiltOptions extends Types.Options>(
  options: BuiltOptions
): BuiltOptions => {
  const baseDir = resolve(Utils.getProjectRoot(), ".micropack");
  if (!existsSync(baseDir)) {
    mkdirSync(baseDir);
  }

  const microDir = resolve(baseDir, options.micro.name);
  if (!existsSync(microDir)) {
    mkdirSync(microDir);
  }

  options.dataDir = microDir;
  options.rewrite = !!options.rewrite || false;

  return options;
};

const core = async <MicroConfig extends any>(
  suppliedOptions: Types.Options<MicroConfig>,
  prevParseCache: Record<string, Types.ParsedBabel> = {}
) => {
  try {
    // setup options with defaults
    buildOptions(suppliedOptions);
    const options = suppliedOptions;

    // setup cache and start the micro
    const store = new Classes.store();
    store._dangerouslyStartMicro(options.micro.name, prevParseCache);

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
      config: options.micro.config,
      options,
      parse: store.parse,
      traverse: traversals.traverse,
      codemod: traversals.codemod,
      getDetailedImports: traversals.getDetailedImports,
      getRoutes: nextjsApp.getRoutes,
      getErrors: errors.get,
      reportError: errors.report,
      collect: nextjsApp.collect,
    };

    // run the collector, a function that can "collect" information about
    // the files in the project. This is the first phase of the micro.
    await options.micro.collector?.({
      ...ContextShared,
      getCollection: nextjsApp.getCollection,
    });

    // run the reducer, a function that can "reduce" the information collected in
    // the previous step.
    const data = options.micro.reducer
      ? await options.micro.reducer({
          ...ContextShared,
          collection: JSON.parse(JSON.stringify(nextjsApp.getCollection())),
        })
      : JSON.parse(JSON.stringify(nextjsApp.getCollection()));

    await options.micro.rewriter?.({
      ...ContextShared,
      data: JSON.parse(JSON.stringify(data)),
      collection: JSON.parse(JSON.stringify(nextjsApp.getCollection())),
    });

    nextjsApp.stashCollection(options.dataDir);
    nextjsApp.stashReducedCollection(options.dataDir, data);
    nextjsApp.stashErrors(options.dataDir, errors.get() as any); // so only when no errors exist, can we commit rewrites, for safety reasons
    nextjsApp.stashRewrites(options.dataDir);

    if (options.rewrite === true) {
      // we only throw if there are errors in the rewriter phase
      // otherwise, we just log and pass them to the potential next micro
      const foundErrors = errors.get();
      if (foundErrors.length > 0) {
        errors.log();
        throw new Error(
          `Errors found in micro ${options.micro.name}. See above for details.`
        );
      }
      nextjsApp.executeRewrites(options.dataDir);
    }

    const parseCache = store.getParseCache();

    const resolveData = {
      parseCache,
      errors: errors.get(),
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
