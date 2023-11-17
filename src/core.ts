import { resolve } from "path";
import { mkdirSync, existsSync } from "fs";
import Store from "./classes/Store/index";
import SApp from "./classes/SApp";
import SErrors from "./classes/SErrors";
import STraversals from "./classes/STraversals";
import { CoreOptions, CustomPlugin, ParsedBabel, SharedCtx } from "./types";
import * as Utils from "./utils";

const buildOptions = (name: string, coreOptions: any): CoreOptions => {
  const dataDir = Utils.getDataDir();
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir);
  }

  const nextcastDir = resolve(dataDir, name);
  if (!existsSync(nextcastDir)) {
    mkdirSync(nextcastDir);
  }

  coreOptions.nextcastDir = nextcastDir;
  coreOptions.rewrite = !!coreOptions.rewrite || false;
  coreOptions.inputDir = coreOptions.inputDir || "nextcasts";

  return coreOptions;
};

const core = async <MicroConfig extends any>(
  plugin: CustomPlugin<MicroConfig>,
  coreOptions: CoreOptions = {},
  prevParseCache: Record<string, ParsedBabel> = {}
): Promise<{ parsed: any; errors: Array<any> }> => {
  try {
    const options = buildOptions(plugin.name, coreOptions);

    // setup cache and start the plugin
    const store = new Store();
    store._dangerouslyStartMicro(plugin.name, prevParseCache);

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

    const ContextShared: SharedCtx = {
      project: {
        root,
        tsconfig,
      },
      config: plugin.config,
      parse: store.parse,
      babelTraverse: traversals.babelTraverse,
      jscodeshift: traversals.jscodeshift,
      getDetailedImports: traversals.getDetailedImports,
      getSourceFiles: app.getSourceFiles,
      getRoutes: app.getRoutes,
      getServerComponents: app.getServerComponents,
      getClientComponents: app.getClientComponents,
      getErrors: errors.getErrors,
      getWarnings: errors.getWarnings,
      reportError: errors.reportError,
      reportWarning: errors.reportWarning,
      collect: app.collect,
    };

    // run the collector, a function that can "collect" information about
    // the files in the project. This is the first phase of the plugin.
    if (typeof plugin.collector === "function") {
      await plugin.collector({
        ...ContextShared,
        getCollection: app.getCollection,
      });
    }

    let data: any;
    if (typeof plugin.reducer === "function") {
      data = await plugin.reducer({
        ...ContextShared,
        collection: app.getCollection(),
      });
    } else {
      data = app.getCollection();
    }

    if (typeof plugin.rewriter === "function") {
      await plugin.rewriter({
        ...ContextShared,
        data: JSON.parse(JSON.stringify(data)),
        collection: app.getCollection(),
      });
    }

    app.stashCollection(options.nextcastDir);
    app.stashReducedCollection(options.nextcastDir, data);
    app.stashErrors(options.nextcastDir, errors.getErrors() as any);
    app.stashWarnings(options.nextcastDir, errors.getWarnings() as any);
    app.stashRewrites(options.nextcastDir);

    if (options.rewrite === true) {
      // we only throw if there are errors in the rewriter phase
      // otherwise, we just log and pass them to the potential next plugin
      const foundErrors = errors.getErrors();
      if (foundErrors.length > 0) {
        errors.log();
        throw new Error(
          `Errors found in plugin ${plugin.name}. See above for details.`
        );
      }
      app.executeRewrites(options.nextcastDir);
    }

    const parsed = store.getParseCache();
    const errorLogs = errors.getLogs();

    // end the plugin so that its included in the cache history and
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
