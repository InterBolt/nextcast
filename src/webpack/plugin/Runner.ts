import { isAbsolute, resolve } from "path";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import { pluginPhaseRunner, prepluginPhaseRunner } from "../../core";
import constants from "../../constants";
import type * as Types from "../../types";
import log from "../../log";
import HHasher from "../../classes/HHasher";
import nextSpec from "../../next/nextSpec";

// This will run the preplugin phase first which parses and loads some context
// that all plugins might need.
// Then, it runs each plugin's collection phase syncronously, and each
// of those phases will return a builder function that will be run asyncronously parallel to each other.
// Then, each builder returns an async rewriter function that will run in series.
const runNextcasts = async (plugins: Array<Types.Plugin<any>>) => {
  const startTime = Date.now();
  let previouslyParsed: Record<string, Types.ParsedBabel> = {};
  const { parseCache, ctx } = await prepluginPhaseRunner();

  previouslyParsed = parseCache;
  const builders = plugins.map((plugin) => {
    const { parseCache, builder } = pluginPhaseRunner(
      plugin,
      ctx,
      {
        rewrite: false,
      },
      previouslyParsed
    );
    previouslyParsed = parseCache;
    return builder;
  });

  const rewriters = await Promise.all(builders.map((builder) => builder()));

  for (let i = 0; i < rewriters.length; i++) {
    const rewriter = rewriters[i];
    await rewriter();
  }

  log.success(
    `Ran nextcasts: [${plugins.map((p) => p.name).join(", ")}] in ${(
      (Date.now() - startTime) /
      1000
    ).toFixed(2)}s`
  );
};

const mapInputDir = (inputDir: string) => {
  return isAbsolute(inputDir)
    ? inputDir
    : resolve(nextSpec.getProjectRoot(), inputDir);
};

const createTsConfigIfNotExists = (inputDirPath: string) => {
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
    writeFileSync(tsConfigPath, JSON.stringify(tsConfig, null, 2));
  }

  const foundTsConfig = JSON.parse(readFileSync(tsConfigPath, "utf8"));
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

    const foundTsConfig = createTsConfigIfNotExists(inputDirPath);
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

  apply(compiler: any) {
    compiler.hooks.beforeCompile.tapPromise(
      constants.name[0].toUpperCase() + constants.name.slice(1),
      async () => {
        this.plugins = await this.loadUserPlugins(this.inputDir);

        await this.hasher.runWhenChanged(() => runNextcasts(this.plugins), {
          namespace: "ran_nextcasts",
          watchDir: nextSpec.getProjectRoot(),
        });
      }
    );
  }
}

export default RunnerPlugin;
