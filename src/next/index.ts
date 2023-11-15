import * as Utils from "./utils";
import type * as Types from "./types";
import core, { buildOptions } from "./core";
import { resolve } from "path";
import jscodeshift from "jscodeshift";
import * as Classes from "./entities";

export async function attachDataLoader(code: string) {
  const callback = this.async();
  const options = buildOptions(this.getOptions() as Types.Options);
  const pathToData = resolve(options.dataDir, `data.json`);
  const data = require(pathToData);
  const codemods = new Classes.codemods(jscodeshift.withParser("tsx")(code));

  codemods.addDataToHTMLTag(
    data,
    `data-micropack-${options.micro.name}`,
    "html"
  );

  try {
    return callback(null, codemods.collection.toSource());
  } catch (err) {
    callback(err, code);
  }
}

export async function rewriterLoader(code: string) {
  const callback = this.async();
  const options = buildOptions(this.getOptions() as Types.Options);
  const resourcePath = this.resourcePath as string;
  const pathToRewrites = resolve(options.dataDir, `rewrites.json`);
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

class MicropackPlugin {
  public micros: Array<Types.Options>;
  constructor(options: { micros: Array<Types.Options> }) {
    this.micros = options.micros;
  }

  apply(compiler: any) {
    compiler.hooks.emit.tapPromise("Micropack", async () => {
      let prevParseCache: Record<string, Types.ParsedBabel> = {};
      for (let i = 0; i < this.micros.length; i++) {
        const { parseCache } = await core(
          {
            ...this.micros[i],
            rewrite: false,
          },
          prevParseCache
        );
        prevParseCache = parseCache;
      }
    });
  }
}

const micropack = (micros: Array<Types.Options>) => (nextConfig: any) => {
  const webpack = (config: any, nextWebpackOptions: any) => {
    config.plugins.push(new MicropackPlugin({ micros }));
    micros.forEach((options) => {
      config.module.rules.push(
        {
          // Run on the root layout because we'll attach the lookahead data
          // to the body tag as a data attribute.
          test: new RegExp(`${Utils.getAppDir()}/layout.(js|ts|tsx|jsx)`),
          use: [
            {
              options,
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
              options,
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

export default micropack;
