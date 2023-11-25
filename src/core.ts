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
  PluginCtx,
  NextCtx,
} from "./types";
import SCodemod from "./classes/SCodemod";
import nextSpec from "./next/nextSpec";
import SNextCtx from "./classes/SNextCtx";
import log from "./log";

const NEXT_CTX_PLUGIN_NAME = "__NEXT_CTX";

const buildOptions = (name: string, coreOptions: any): CoreOptions => {
  const dataDir = nextSpec.getDataDir();
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

export const prepluginPhaseRunner = async () => {
  const store = new Store();
  store._dangerouslyStartPlugin(NEXT_CTX_PLUGIN_NAME);

  const nextCtx = new SNextCtx(store);
  const ctx = await nextCtx.load();
  const parseCache = store.getParseCache();
  store._dangerouslyEndPlugin();

  return { ctx, parseCache };
};

// will run collector, then return builder, then return rewriter
// this way we can choose a different run strategy for each phase
export const pluginPhaseRunner = <PluginConfig extends any>(
  plugin: Plugin<PluginConfig>,
  nextCtx: NextCtx,
  coreOptions: CoreOptions = {},
  prevParseCache: Record<string, ParsedBabel> = {}
): {
  builder: () => Promise<() => Promise<void>>;
  parseCache: any;
} => {
  let builderError: Error | null = null;
  let collectorError: Error | null = null;

  try {
    const { Api, pluginCtx, options, store, errors, app } = (() => {
      const options = buildOptions(plugin.name, coreOptions);

      // setup cache and start the plugin
      const store = new Store();
      store._dangerouslyStartPlugin(plugin.name, prevParseCache);

      // setup setup errors, traversals, and pages
      const errors = new SErrors(store);
      const traversals = new STraversals(store);
      const app = new SApp(store, traversals);
      const codemod = new SCodemod(store);

      // load next ctx data into the cache
      app.loadNextCtx(nextCtx);
      const routes = app.getRoutes();
      const sourceFiles = app.getSourceFiles();

      const Api: PluginApi = {
        parse: store.parse,
        traverse: traversals.traverse,
        modify: codemod.modify,
        getCollected: app.getCollected,
        getSaved: app.getSaved,
        getSavedHistory: app.getSavedHistory,
        getErrors: errors.getErrors,
        getWarnings: errors.getWarnings,
        reportError: errors.reportError,
        reportWarning: errors.reportWarning,
        collect: app.collect,
        save: app.save,
        queueRewrite: app.queueRewrite,
        dangerouslyQueueRewrite: app.dangerouslyQueueRewrite,
        getRewrites: app.getRewrites,
        _: {
          getImports: traversals.getImports,
          getClientComponents: app.getClientComponents,
          getServerComponents: app.getServerComponents,
        },
      };

      const pluginCtx: PluginCtx = {
        sourceFiles,
        routes,
        data: null,
      };

      try {
        // run the collector, a function that can "collect" information about
        // the files in the project. This is the first phase of the plugin.
        if (typeof plugin.collector === "function") {
          plugin.collector(pluginCtx, Api);
        }
      } catch (err) {
        log.error(
          `Failed during the collection phase of the plugin: ${plugin.name}`
        );
        collectorError = new Error(err);
        console.error(collectorError);
      }

      return {
        Api,
        pluginCtx,
        options,
        store,
        errors,
        app,
      };
    })();

    const builder = async () => {
      try {
        if (typeof plugin.builder === "function") {
          await plugin.builder(pluginCtx, Api);
        }
      } catch (err) {
        log.error(
          `Failed during the builder phase of the plugin: ${plugin.name}`
        );
        builderError = new Error(err);
        console.error(builderError);
      }

      const rewriter = async () => {
        if (collectorError || builderError) {
          log.error(
            `Phase ${plugin.name} failed during the collection or builder phase.`
          );

          return;
        }
        if (typeof plugin.rewriter === "function") {
          plugin.rewriter(pluginCtx, Api);
        }

        await app.stashCollection(options.nextcastDir);
        await app.stashSavedBuild(options.nextcastDir);
        await app.stashErrors(options.nextcastDir, errors.getErrors() as any);
        await app.stashWarnings(
          options.nextcastDir,
          errors.getWarnings() as any
        );
        await app.stashRewrites(options.nextcastDir);

        const foundErrors = errors.getErrors();
        if (foundErrors.length > 0) {
          errors.log();
        } else {
          await app.executeDangerousRewrites();
        }

        store._dangerouslyEndPlugin();
      };

      return rewriter;
    };

    return { builder, parseCache: store.getParseCache() };
  } catch (err) {
    // only log if we didn't already log the error in the builder or collector
    if (!builderError && !collectorError) {
      console.error(err);
    }
    process.exit(1);
  }
};
