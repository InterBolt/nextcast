import { isAbsolute, resolve } from "path";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import colors from "colors/safe";
import core from "../../core";
import constants from "../../constants";
import * as Utils from "../../utils";
import type * as Types from "../../types";
import log from "../../log";
import HHasher from "../../classes/HHasher";

const runNextcasts = async (packs: Array<Types.CustomPlugin<any>>) => {
  let previouslyParsed: Record<string, Types.ParsedBabel> = {};
  for (let i = 0; i < packs.length; i++) {
    const startTime = Date.now();

    const { parsed, errors: errorLogs } = await core(
      packs[i],
      {
        rewrite: false,
      },
      previouslyParsed
    );

    errorLogs.map((args) => console.log(...args));

    log.success(
      `Ran nextcast: ${colors.blue(packs[i].name)} in ${(
        (Date.now() - startTime) /
        1000
      ).toFixed(2)}s`
    );

    previouslyParsed = parsed;
  }
};

const mapInputDir = (inputDir: string) => {
  return isAbsolute(inputDir)
    ? inputDir
    : resolve(Utils.getProjectRoot(), inputDir);
};

const createTsConfigIfNotExists = (inputDirPath: string) => {
  const tsConfigPath = resolve(inputDirPath, "tsconfig.json");
  if (!existsSync(tsConfigPath)) {
    const tsConfig = {
      compilerOptions: {
        outDir: `../${constants.compiledUserPluginsDir}}`,
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
    cwd: Utils.getProjectRoot(),
    stdio: "inherit",
    encoding: "utf8",
  });

  log.success(
    `Compiled your packs in ${((Date.now() - startTime) / 1000).toFixed(2)}s`
  );
};

class RunnerPlugin {
  public hasher: HHasher;
  public inputDir: string;
  public packs: Array<Types.CustomPlugin<any>>;

  constructor(options: { inputDir: string }) {
    this.inputDir = options.inputDir;
    this.hasher = new HHasher();
    this.hasher.init();
  }

  public loadUserPlugins = (inputDir: string) => {
    const inputDirPath = mapInputDir(inputDir);
    if (!existsSync(inputDirPath)) {
      throw new Error(
        `${constants.name} error: could not find packs input directory at ${inputDirPath}`
      );
    }

    const tsEntryPath = resolve(inputDirPath, "index.ts");
    if (!existsSync(tsEntryPath)) {
      throw new Error(`${constants.name} error: could not find ${tsEntryPath}`);
    }

    const foundTsConfig = createTsConfigIfNotExists(inputDirPath);
    this.hasher.runWhenChanged(() => compileUserPlugins(inputDirPath), {
      namespace: "compile_nextcasts",
      watchDir: inputDirPath,
    });

    const packs = require(resolve(
      inputDirPath,
      foundTsConfig.compilerOptions.outDir,
      "index.js"
    )).default;
    if (typeof packs === "undefined" || !Array.isArray(packs)) {
      throw new Error(
        `${constants.name} error: ${inputDirPath}/index.{ts,js} must include a default export that is an array of packs.`
      );
    }

    return packs as Array<Types.CustomPlugin<any>>;
  };

  apply(compiler: any) {
    compiler.hooks.beforeCompile.tapPromise(
      constants.name[0].toUpperCase() + constants.name.slice(1),
      async () => {
        this.packs = this.loadUserPlugins(this.inputDir);

        await this.hasher.runWhenChanged(() => runNextcasts(this.packs), {
          namespace: "ran_nextcasts",
          watchDir: Utils.getProjectRoot(),
        });
      }
    );
  }
}

export default RunnerPlugin;
