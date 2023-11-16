import { resolve } from "path";
import { mkdirSync, existsSync } from "fs";
import type * as Types from "./types";
import * as Utils from "./utils";
import constants from "./constants";
import MicroStore from "./classes/MicroStore/index";
import SApp from "./classes/SApp";
import SErrors, { IErrorOrWarning } from "./classes/SErrors";
import STraversals from "./classes/STraversals";

const buildOptions = (
  name: string,
  coreOptions: any
): Types.PackCoreOptions => {
  const baseDir = resolve(Utils.getProjectRoot(), `.${constants.name}`);
  if (!existsSync(baseDir)) {
    mkdirSync(baseDir);
  }

  const dataDir = resolve(baseDir, name);
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir);
  }

  coreOptions.dataDir = dataDir;
  coreOptions.rewrite = !!coreOptions.rewrite || false;
  coreOptions.inputDir = coreOptions.inputDir || "micropacks";

  return coreOptions;
};

const core = async <MicroConfig extends any>(
  micro: Types.Pack<MicroConfig>,
  coreOptions: Types.PackCoreOptions = {},
  prevParseCache: Record<string, Types.ParsedBabel> = {}
): Promise<{ parsed: any; errors: Array<any> }> => {
  try {
    const options = buildOptions(micro.name, coreOptions);

    // setup cache and start the micro
    const store = new MicroStore();
    store._dangerouslyStartMicro(micro.name, prevParseCache);

    // setup setup errors, traversals, and pages
    const errors = new SErrors(store);
    const traversals = new STraversals(store);
    const app = new SApp(store, traversals);

    // will find and map all the files associated with each route
    // by following the nextjs conventions for app router files.
    await app.loadRoutes();

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
      parse: store.parse,
      traverse: traversals.traverse,
      codemod: traversals.codemod,
      getDetailedImports: traversals.getDetailedImports,
      getRoutes: app.getRoutes,
      getErrors: errors.getErrors,
      getWarnings: errors.getWarnings,
      reportError: errors.reportError,
      reportWarning: errors.reportWarning,
      collect: app.collect,
    };

    // run the collector, a function that can "collect" information about
    // the files in the project. This is the first phase of the micro.
    if (typeof micro.collector === "function") {
      await micro.collector({
        ...ContextShared,
        getCollection: app.getCollection,
      });
    }

    let data: any;
    if (typeof micro.reducer === "function") {
      data = await micro.reducer({
        ...ContextShared,
        collection: app.getCollection(),
      });
    } else {
      data = app.getCollection();
    }

    if (typeof micro.rewriter === "function") {
      await micro.rewriter({
        ...ContextShared,
        data: JSON.parse(JSON.stringify(data)),
        collection: app.getCollection(),
      });
    }

    app.stashCollection(options.dataDir);
    app.stashReducedCollection(options.dataDir, data);
    app.stashErrors(options.dataDir, errors.getErrors() as any);
    app.stashWarnings(options.dataDir, errors.getWarnings() as any);
    app.stashRewrites(options.dataDir);

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
      app.executeRewrites(options.dataDir);
    }

    const parsed = store.getParseCache();
    const errorLogs = errors.getLogs();

    // end the micro so that its included in the cache history and
    // so that we can't do anything stupid to our state after this.
    // this might not seem useful now, but the moment we want
    // some kind of behavior that is not "run once and forget",
    // this will be useful.
    store._dangerouslyEndMicro();

    return {
      errors: errorLogs,
      parsed,
    };
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

export default core;
