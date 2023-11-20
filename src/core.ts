import { resolve } from "path";
import { mkdirSync, existsSync } from "fs";
import Store from "./classes/Store/index";
import SApp from "./classes/SApp";
import SErrors from "./classes/SErrors";
import STraversals from "./classes/STraversals";
import {
  CoreOptions,
  Plugin,
  PluginApi,
  ParsedBabel,
  SharedCtx,
} from "./types";
import * as Utils from "./utils";
import SCodemod from "./classes/SCodemod";

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

const core = async <PluginConfig extends any>(
  plugin: Plugin<PluginConfig>,
  coreOptions: CoreOptions = {},
  prevParseCache: Record<string, ParsedBabel> = {}
): Promise<any> => {
  try {
    const options = buildOptions(plugin.name, coreOptions);

    // setup cache and start the plugin
    const store = new Store();
    store._dangerouslyStartPlugin(plugin.name, prevParseCache);

    // setup setup errors, traversals, and pages
    const errors = new SErrors(store);
    const traversals = new STraversals(store);
    const app = new SApp(store, traversals);
    const codemod = new SCodemod(store);

    // will find and map all the files associated with each route
    // by following the nextjs conventions for app router files.
    await app.loadRoutes();
    const routes = app.getRoutes();
    const sourceFiles = app.getSourceFiles();

    const Api: PluginApi = {
      parse: store.parse,
      traverse: traversals.traverse,
      modify: codemod.modify,
      getCollected: app.getCollected,
      getErrors: errors.getErrors,
      getWarnings: errors.getWarnings,
      reportError: errors.reportError,
      reportWarning: errors.reportWarning,
      collect: app.collect,
      queueRewrite: app.queueRewrite,
      dangerouslyQueueRewrite: app.dangerouslyQueueRewrite,
      getRewrites: app.getRewrites,
      _: {
        getImports: traversals.getImports,
        getClientComponents: app.getClientComponents,
        getServerComponents: app.getServerComponents,
      },
    };

    const ContextShared: SharedCtx = {
      sourceFiles,
      routes,
      data: null,
    };

    // run the collector, a function that can "collect" information about
    // the files in the project. This is the first phase of the plugin.
    if (typeof plugin.collector === "function") {
      await plugin.collector(ContextShared, Api);
    }

    let data: any;
    if (typeof plugin.reducer === "function") {
      data = await plugin.reducer(ContextShared, Api);
    } else {
      data = app.getCollected();
    }

    if (typeof plugin.rewriter === "function") {
      await plugin.rewriter(
        {
          ...ContextShared,
          data: JSON.parse(JSON.stringify(data)),
        },
        Api
      );
    }

    app.stashCollection(options.nextcastDir);
    app.stashReducedCollection(options.nextcastDir, data);
    app.stashErrors(options.nextcastDir, errors.getErrors() as any);
    app.stashWarnings(options.nextcastDir, errors.getWarnings() as any);
    app.stashRewrites(options.nextcastDir);

    const foundErrors = errors.getErrors();
    if (foundErrors.length > 0) {
      errors.log();
    } else {
      app.executeDangerousRewrites();
    }

    const parsed = store.getParseCache();
    // end the plugin so that its included in the cache history and
    // so that we can't do anything stupid to our state after this.
    // this might not seem useful now, but the moment we want
    // some kind of behavior that is not "run once and forget",
    // this will be useful.
    store._dangerouslyEndPlugin();

    return parsed;
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

export default core;
