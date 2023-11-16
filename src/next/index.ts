import { isAbsolute, resolve } from "path";
import jscodeshift from "jscodeshift";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "fs";
import { execSync } from "child_process";
import core from "./core";
import Codemods from "./classes/HCodemods";
import constants from "./constants";
import * as Utils from "./utils";
import type * as Types from "./types";
import colors from "colors/safe";
import logger from "./logger";
import HDirHasher from "./classes/HDirHasher";

const debouncer = new HDirHasher();

const getPackDirs = (dataDir: string) =>
  readdirSync(dataDir)
    .filter((name) => !["node_modules", "dist"].includes(name))
    .filter((name) => !name.startsWith("."))
    .filter((name) => statSync(resolve(dataDir, name)).isDirectory());

export async function attachDataLoader(code: string) {
  const callback = this.async();
  const dataDir = resolve(Utils.getProjectRoot(), `.${constants.name}`);
  const codemods = new Codemods(jscodeshift.withParser("tsx")(code));
  const names = getPackDirs(dataDir);

  names.forEach((name) => {
    const pathToData = resolve(
      `.${constants.name}`,
      name,
      constants.dataFileName
    );
    const data = require(pathToData);
    codemods.addDataToHTMLTag(data, `data-${constants.name}-${name}`, "html");
  });

  try {
    return callback(null, codemods.collection.toSource());
  } catch (err) {
    callback(err, code);
  }
}

export async function rewriterLoader(code: string) {
  const callback = this.async();
  const dataDir = resolve(Utils.getProjectRoot(), `.${constants.name}`);
  const names = getPackDirs(dataDir);
  const resourcePath = this.resourcePath as string;
  let rewrite: string | undefined = undefined;

  names.forEach((name) => {
    const pathToRewrites = resolve(
      `.${constants.name}`,
      name,
      constants.rewritesFileName
    );
    rewrite = (() => {
      try {
        return require(pathToRewrites);
      } catch (err) {
        console.log(err);
        throw new Error(`Could not require ${pathToRewrites}`);
      }
    })()[resourcePath];
  });

  try {
    return callback(null, typeof rewrite === "string" ? rewrite : code);
  } catch (err) {
    callback(err, code);
  }
}

const runMicropacks = async (packs: Array<Types.Pack<any>>) => {
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

    logger.success(
      `Ran micropack: ${colors.blue(packs[i].name)} in ${(
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
        outDir: `../dist`,
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

const compileUserPacks = (inputDirPath: string) => {
  const startTime = Date.now();
  logger.wait(`One sec, gotta compile your micropacks...`);

  execSync(`npx tsc -p ${resolve(inputDirPath, "tsconfig.json")}`, {
    cwd: Utils.getProjectRoot(),
    stdio: "inherit",
    encoding: "utf8",
  });

  logger.success(
    `Compiled your packs in ${((Date.now() - startTime) / 1000).toFixed(2)}s`
  );
};

const loadUserPacks = (inputDir: string) => {
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
  debouncer.runWhenChanged(() => compileUserPacks(inputDirPath), {
    namespace: "compile_micropacks",
    dir: inputDirPath,
    excludeFiles: ["tsconfig.json"],
  });
  const pathToCompiledFile = resolve(
    inputDirPath,
    foundTsConfig.compilerOptions.outDir,
    "index.js"
  );
  if (!existsSync(pathToCompiledFile)) {
    throw new Error(
      `${constants.name} error: could not find compiled file at ${pathToCompiledFile}`
    );
  }
  const packs = require(pathToCompiledFile).default;

  if (typeof packs === "undefined" || !Array.isArray(packs)) {
    throw new Error(
      `${constants.name} error: ${inputDirPath}/index.{ts,js} must include a default export that is an array of packs.`
    );
  }

  return packs as Array<Types.Pack<any>>;
};

class Plugin {
  public inputDir: string;
  public packs: Array<Types.Pack<any>>;

  constructor(options: { inputDir: string }) {
    this.inputDir = options.inputDir;
  }

  run = () => {
    return debouncer.runWhenChanged(() => runMicropacks(this.packs), {
      namespace: "ran_micropacks",
    });
  };

  apply(compiler: any) {
    compiler.hooks.beforeCompile.tapPromise(
      constants.name[0].toUpperCase() + constants.name.slice(1),
      async () => {
        this.packs = loadUserPacks(this.inputDir);
        await this.run();
      }
    );
  }
}

export const withMicropack = (
  nextConfig: any,
  opts?: { inputDir?: string }
) => {
  const { inputDir = constants.userDir } = opts || {};
  debouncer.init();

  const webpack = (config: any, nextWebpackOptions: any) => {
    config.plugins.push(new Plugin({ inputDir }));

    config.module.rules.push(
      {
        // Run on the root layout because we'll attach the lookahead data
        // to the body tag as a data attribute.
        test: new RegExp(`${Utils.getAppDir()}/layout.(js|ts|tsx|jsx)`),
        use: [
          {
            loader: resolve(__dirname, "loaders", "attachData.js"),
          },
        ],
        enforce: "pre",
      },
      {
        // Run on the root layout because we'll attach the lookahead data
        // to the body tag as a data attribute.
        test: /\.(js|jsx|ts|tsx)$/,
        use: [
          {
            loader: resolve(__dirname, "loaders", "rewrite.js"),
          },
        ],
        // we must run this before attaching data to the root layout
        // in the loader below so that we don't lose our data attribute
        // in the process of executing rewrites.
        enforce: "pre",
      }
    );

    if (typeof nextConfig.webpack === "function") {
      return nextConfig.webpack(config, nextWebpackOptions);
    }
    return config;
  };
  return Object.assign({}, nextConfig, { webpack });
};
