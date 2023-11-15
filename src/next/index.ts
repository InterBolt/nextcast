import * as Utils from "./utils";
import type * as Types from "./types";
import core from "./core";
import { isAbsolute, resolve } from "path";
import jscodeshift from "jscodeshift";
import * as Classes from "./entities";
import type { Linter } from "eslint";
import eslintPlugin from "./eslint/index";
import constants from "./constants";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";

export async function attachDataLoader(code: string) {
  const callback = this.async();
  const { name } = this.getOptions();
  const pathToData = resolve(
    `.${constants.name}`,
    name,
    constants.dataFileName
  );
  const data = require(pathToData);
  const codemods = new Classes.codemods(jscodeshift.withParser("tsx")(code));

  codemods.addDataToHTMLTag(data, `data-${constants.name}-${name}`, "html");

  try {
    return callback(null, codemods.collection.toSource());
  } catch (err) {
    callback(err, code);
  }
}

export async function rewriterLoader(code: string) {
  const callback = this.async();
  const { name } = this.getOptions();
  const resourcePath = this.resourcePath as string;
  const pathToRewrites = resolve(
    `.${constants.name}`,
    name,
    constants.rewritesFileName
  );
  const rewrite = (() => {
    try {
      return require(pathToRewrites);
    } catch (err) {
      console.log(err);
      throw new Error(`Could not require ${pathToRewrites}`);
    }
  })()[resourcePath];

  try {
    return callback(null, typeof rewrite === "string" ? rewrite : code);
  } catch (err) {
    callback(err, code);
  }
}

const runMicrosWithCache = async (micros: Array<Types.Definition<any>>) => {
  let prevParseCache: Record<string, Types.ParsedBabel> = {};
  for (let i = 0; i < micros.length; i++) {
    console.log(` » Running micro: ${micros[i].name}`);
    const { parseCache } = await core(
      micros[i],
      {
        rewrite: false,
      },
      prevParseCache
    );
    prevParseCache = parseCache;
  }
};

const mapInputDir = (inputDir: string) => {
  return isAbsolute(inputDir)
    ? inputDir
    : resolve(Utils.getProjectRoot(), inputDir);
};

const getLastSourceCodeHash = (dataDir: string) => {
  const tsconfigPath = resolve(Utils.getProjectRoot(), "tsconfig.json");
  const { exclude = ["node_modules"], include = ["."] } = existsSync(
    tsconfigPath
  )
    ? require(tsconfigPath)
    : {};
  return Utils.getSourceCodeHash(exclude, include);
};

class MicropackPlugin {
  public dataDir: string;
  public lastSourceCodeHash: string;
  public micros: Array<Types.Definition<any>>;

  constructor(options: {
    micros: Array<Types.Definition<any>>;
    dataDir: string;
  }) {
    this.lastSourceCodeHash = getLastSourceCodeHash(options.dataDir);
    this.micros = options.micros;
  }

  apply(compiler: any) {
    compiler.hooks.beforeCompile.tapPromise(constants.name, async () => {
      const nextHash = getLastSourceCodeHash(this.dataDir);
      if (nextHash !== this.lastSourceCodeHash) {
        this.lastSourceCodeHash = nextHash;
        await runMicrosWithCache(this.micros);
      }
    });
  }
}

const createTsConfigIfNotExists = (inputDirPath: string) => {
  const tsConfigPath = resolve(inputDirPath, "tsconfig.json");
  if (!existsSync(tsConfigPath)) {
    const tsConfig = {
      compilerOptions: {
        outDir: `../.${constants.name}/dist`,
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

const compileInputDir = (inputDirPath: string) => {
  execSync(`npx tsc -p ${resolve(inputDirPath, "tsconfig.json")}`, {
    cwd: Utils.getProjectRoot(),
    stdio: "inherit",
    encoding: "utf8",
  });
};

const loadUserMicros = (inputDir: string) => {
  const inputDirPath = mapInputDir(inputDir);

  if (!existsSync(inputDirPath)) {
    throw new Error(
      `${constants.name} error: could not find micros input directory at ${inputDirPath}`
    );
  }
  let micros: any = [];
  const tsEntryPath = resolve(inputDirPath, "index.ts");
  const jsEntryPath = resolve(inputDirPath, "index.js");

  if (!existsSync(tsEntryPath) && !existsSync(jsEntryPath)) {
    throw new Error(
      `${constants.name} error: could not find micros entry file at ${inputDirPath}`
    );
  }

  if (!existsSync(tsEntryPath)) {
    micros = require(jsEntryPath);
  } else {
    const foundTsConfig = createTsConfigIfNotExists(inputDirPath);
    compileInputDir(inputDirPath);
    const compiledPath = resolve(
      inputDirPath,
      foundTsConfig.compilerOptions.outDir,
      "index.js"
    );
    micros = require(compiledPath).default;
  }

  if (typeof micros === "undefined" || !Array.isArray(micros)) {
    throw new Error(
      `${constants.name} error: ${inputDirPath}/index.{ts,js} must include a default export that is an array of micros.`
    );
  }

  return micros as Array<Types.Definition<any>>;
};

export const withMicropack = (
  nextConfig: any,
  opts?: { inputDir?: string }
) => {
  const { inputDir = constants.userDir } = opts || {};
  const micros = loadUserMicros(inputDir);
  const webpack = (config: any, nextWebpackOptions: any) => {
    config.plugins.push(
      new MicropackPlugin({
        micros,
        dataDir: resolve(Utils.getProjectRoot(), `.${constants.name}`),
      })
    );
    micros.forEach((micro) => {
      config.module.rules.push(
        {
          // Run on the root layout because we'll attach the lookahead data
          // to the body tag as a data attribute.
          test: new RegExp(`${Utils.getAppDir()}/layout.(js|ts|tsx|jsx)`),
          use: [
            {
              options: {
                name: micro.name,
              },
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
              options: {
                name: micro.name,
              },
              loader: resolve(__dirname, "loaders", "rewrite.js"),
            },
          ],
          // we must run this before attaching data to the root layout
          // in the loader below so that we don't lose our data attribute
          // in the process of executing rewrites.
          enforce: "pre",
        }
      );
    });

    if (typeof nextConfig.webpack === "function") {
      return nextConfig.webpack(config, nextWebpackOptions);
    }
    return config;
  };
  return Object.assign({}, nextConfig, { webpack });
};
