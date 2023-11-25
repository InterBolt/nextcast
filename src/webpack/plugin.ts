import { isAbsolute, resolve } from "path";
import { existsSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { execSync } from "child_process";
import { pluginPhaseRunner, prepluginPhaseRunner } from "@src/core";
import constants from "@src/constants";
import type * as Types from "@src/types";
import log from "@log";
import HHasher from "@src/classes/HHasher";
import nextSpec from "@src/next/nextSpec";
import compilerHookRewrite from "./compilerHookRewrite";

// This will run the preplugin phase first which parses and loads some context
// that all plugins might need.
// Then, it runs each plugin's collection phase syncronously, and each
// of those phases will return a builder function that will be run asyncronously parallel to each other.
// Then, each builder returns an async rewriter function that will run in series.
const runNextcasts = async (plugins: Array<Types.Plugin<any>>) => {
  const startTime = Date.now();

  let lastParseCache: Record<string, Types.ParsedBabel> = null;
  const { parseCache: initialParseCache, ctx } = await prepluginPhaseRunner();
  const builders = plugins.map((plugin) => {
    const { parseCache, builder } = pluginPhaseRunner(
      plugin,
      ctx,
      lastParseCache || initialParseCache
    );
    lastParseCache = parseCache;
    return builder;
  });

  const rewriters = await Promise.all(builders.map((builder) => builder()));

  const stashers: Array<Awaited<ReturnType<(typeof rewriters)[0]>>> = [];
  for (const rewriter of rewriters) {
    stashers.push(await rewriter());
  }

  const errorFound = stashers.some((stasher) => !!stasher.error);
  if (errorFound) {
    log.error(`Did not commit NextCast filesystem changes due to error(s)`);
    return;
  }

  const transforms = await Promise.all(
    stashers.map((stasher) => stasher.stash())
  );

  let currentRewrites: Record<string, string> = {};
  for (const transform of transforms) {
    currentRewrites = await transform(currentRewrites);
  }
  await writeFile(
    resolve(nextSpec.getProjectRoot(), constants.transformsPath),
    JSON.stringify(currentRewrites)
  );

  log.success(
    `Committed nextcasts: [${plugins.map((p) => p.name).join(", ")}] in ${(
      (Date.now() - startTime) /
      1000
    ).toFixed(2)}s`
  );

  return currentRewrites;
};

const mapInputDir = (inputDir: string) => {
  return isAbsolute(inputDir)
    ? inputDir
    : resolve(nextSpec.getProjectRoot(), inputDir);
};

const createTsConfigIfNotExists = async (inputDirPath: string) => {
  const tsConfigPath = resolve(inputDirPath, "tsconfig.json");
  if (!existsSync(tsConfigPath)) {
    const tsConfig = {
      compilerOptions: {
        outDir: `../${constants.compiledUserPluginsDir}`,
        target: "ESNext",
        module: "commonjs",
        moduleResolution: "node",
        allowJs: true,
        esModuleInterop: true,
      },
      include: ["./**/*.ts", "./**/*.js"],
      exclude: ["node_modules", "dist"],
    };
    await writeFile(tsConfigPath, JSON.stringify(tsConfig, null, 2));
  }

  const foundTsConfig = JSON.parse(await readFile(tsConfigPath, "utf8"));
  if (!foundTsConfig.compilerOptions.outDir) {
    throw new Error(
      `${constants.name} error: ${inputDirPath}/tsconfig.json must have an outDir specified in compilerOptions.`
    );
  }

  return foundTsConfig;
};

const compileUserPlugins = (inputDirPath: string) => {
  const startTime = Date.now();
  log.wait(`One sec, gotta compile your nextcasts...`);

  execSync(`npx tsc -p ${resolve(inputDirPath, "tsconfig.json")}`, {
    cwd: nextSpec.getProjectRoot(),
    stdio: "inherit",
    encoding: "utf8",
  });

  log.success(
    `Compiled your plugins in ${((Date.now() - startTime) / 1000).toFixed(2)}s`
  );
};

interface Options {
  inputDir: string;
  getPlugins: (
    userPlugins: Array<Types.Plugin<any>>
  ) => Array<Types.Plugin<any>>;
}

class RunnerPlugin {
  public webpackPluginName =
    constants.name[0].toUpperCase() + constants.name.slice(1);
  public rewrites: Record<string, string> = {};
  public hasher: HHasher;
  public inputDir: string;
  public plugins: Array<Types.Plugin<any>>;
  public options: Options;

  constructor(options: Options) {
    this.inputDir = options.inputDir;
    this.hasher = new HHasher();
    this.hasher.init();
    this.options = options;
  }

  public loadUserPlugins = async (inputDir: string) => {
    const inputDirPath = mapInputDir(inputDir);
    if (!existsSync(inputDirPath)) {
      log.info(`${constants.name}: no user plugins exist`);
      return this.options.getPlugins([]);
    }

    const tsEntryPath = resolve(inputDirPath, "index.ts");
    if (!existsSync(tsEntryPath)) {
      throw new Error(`${constants.name} error: could not find ${tsEntryPath}`);
    }

    const foundTsConfig = await createTsConfigIfNotExists(inputDirPath);
    await this.hasher.runWhenChanged(() => compileUserPlugins(inputDirPath), {
      namespace: "compile_nextcasts",
      watchDir: inputDirPath,
    });

    const plugins = require(resolve(
      inputDirPath,
      foundTsConfig.compilerOptions.outDir,
      "index.js"
    )).default;
    if (typeof plugins === "undefined" || !Array.isArray(plugins)) {
      throw new Error(
        `${constants.name} error: ${inputDirPath}/index.{ts,js} must include a default export that is an array of plugins.`
      );
    }

    const userPlugins = plugins as Array<Types.Plugin<any>>;

    return this.options.getPlugins(userPlugins);
  };

  async apply(compiler: any) {
    compiler.hooks.beforeCompile.tapPromise(
      this.webpackPluginName,
      async () => {
        this.plugins = await this.loadUserPlugins(this.inputDir);

        const nextRewrites = await this.hasher.runWhenChanged(
          () => runNextcasts(this.plugins),
          {
            namespace: "ran_nextcasts",
            watchDir: nextSpec.getProjectRoot(),
          }
        );

        Object.keys(this.rewrites).forEach((filePath) => {
          delete this.rewrites[filePath];
        });
        Object.keys(nextRewrites).forEach((filePath) => {
          this.rewrites[filePath] = nextRewrites[filePath];
        });

        compilerHookRewrite(this.webpackPluginName, this.rewrites, compiler);
      }
    );
  }
}

export default RunnerPlugin;
