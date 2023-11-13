import { existsSync, readFileSync } from "fs";
import { get, set } from "lodash";
import jscodeshift from "jscodeshift";
import type * as Types from "../types";
import * as parser from "@babel/parser";

const CACHE_PATH_DELIMITER = ".0BslO9.";

type THistory = Pick<
  Cache,
  "_unsafeRegisters" | "_unsafeCache" | "_unsafeMacroName"
>;

class Cache {
  public _unsafeRegisters: Array<Array<string>> = [];
  public _unsafeCache: any = {};
  public _unsafeMacroName: string;
  public _unsafeHistory: Array<THistory> = [];

  public getHistory = () => {
    return this._unsafeHistory.map((history) => new Cache(history));
  };

  constructor(cacheHistory?: THistory) {
    if (cacheHistory) {
      Object.keys(cacheHistory).forEach((storeKey) => {
        this[storeKey] = cacheHistory[storeKey];
      });
    }
  }

  private getParsedBabelPath = () => this._macroPath(["parsed_babel"]);

  private getParsedJscodeshiftPath = () =>
    this._macroPath(["parsed_jscodeshift"]);

  public parseBabel = (filePath: string): Types.ParsedBabel => {
    if (!existsSync(filePath)) {
      throw new Error(`Cannot parse ${filePath} because it does not exist.`);
    }

    const cachePath = this.getParsedBabelPath();
    const parseCached = this.get(cachePath);
    if (parseCached[filePath]) {
      return parseCached[filePath];
    }

    const sourceCode = readFileSync(filePath, "utf8");
    const babelOptions: Parameters<typeof parser.parse>[1] = {
      sourceType: "module",
      plugins: ["jsx"],
    };
    if (filePath.endsWith(".ts") || filePath.endsWith(".tsx")) {
      babelOptions.plugins.push("typescript");
    }

    const returnValue: Types.ParsedBabel = {
      ast: parser.parse(sourceCode, babelOptions),
      sourceCode,
      filePath,
    };

    this.merge<Types.ParsedBabel>(cachePath, {
      [filePath]: returnValue,
    });

    return returnValue;
  };

  public parseJscodeshift = (filePath: string): Types.ParsedJscodeshift => {
    if (!existsSync(filePath)) {
      throw new Error(`Cannot parse ${filePath} because it does not exist.`);
    }

    const cachePath = this.getParsedJscodeshiftPath();
    const parseCached = this.get(cachePath);
    if (parseCached[filePath]) {
      return parseCached[filePath];
    }

    const sourceCode = readFileSync(filePath, "utf8");
    const jscodeshiftCollection = jscodeshift.withParser("tsx")(sourceCode);

    const value: Types.ParsedJscodeshift = {
      collection: jscodeshiftCollection,
      sourceCode,
      filePath,
    };

    this.merge<Types.ParsedJscodeshift>(cachePath, {
      [filePath]: value,
    });

    return value;
  };

  private _validatePath = (path: any) => {
    if (!Array.isArray(path)) {
      throw new Error(`Cache path must be an array.`);
    }
    if (path.some((subpath) => typeof subpath !== "string")) {
      throw new Error(`Cache path must be an array of strings.`);
    }
  };

  public getMacroName = () => {
    if (typeof this._unsafeMacroName === "undefined") {
      throw new Error(`Cannot set cache without a macro name.`);
    }
    return this._unsafeMacroName;
  };

  private _macroPath = (path: Array<string>) => {
    this._validatePath(path);
    return [this.getMacroName(), ...path];
  };

  private _withMacroRead = <TValue extends any>(
    accessPath: any,
    doRead: (cachePath: Array<string>) => TValue
  ) => {
    this._validatePath(accessPath);
    const cachePath = this._macroPath(accessPath);
    this._validateReadAccess(cachePath);
    return doRead(cachePath);
  };

  private _withMacroWrite = (
    accessPath: any,
    doWrite: (cachePath: Array<string>) => void
  ) => {
    this._validatePath(accessPath);
    const cachePath = this._macroPath(accessPath);
    this._validateWriteAccess(cachePath);
    return doWrite(cachePath);
  };

  private _validateReadAccess = (pathToAccess: Array<string>) => {
    this._validatePath(pathToAccess);
    const isValid = this._unsafeRegisters.some((registeredPath) =>
      registeredPath
        .join(CACHE_PATH_DELIMITER)
        .startsWith(pathToAccess.join(CACHE_PATH_DELIMITER))
    );
    if (!isValid) {
      throw new Error(`Nothing exists in the cache at path: ${pathToAccess}`);
    }
  };

  private _validateWriteAccess = (pathToMutate: Array<string>) => {
    this._validatePath(pathToMutate);
    const isValid = this._unsafeRegisters.some(
      (registeredPath) =>
        registeredPath.join(CACHE_PATH_DELIMITER) ===
        pathToMutate.join(CACHE_PATH_DELIMITER)
    );
    if (!isValid) {
      throw new Error(`Can't mutate unregistered path: ${pathToMutate}`);
    }
  };

  public register = (pathToRegister: any, initialData: any = null) => {
    this._validatePath(pathToRegister);
    const pathToRegisterWithMacro = [this.getMacroName(), ...pathToRegister];
    const containsDelimiter = pathToRegisterWithMacro.some((subpath) =>
      subpath.includes(CACHE_PATH_DELIMITER)
    );
    if (containsDelimiter) {
      throw new Error(
        `Cannot use delimiter "${CACHE_PATH_DELIMITER}" in registered subpaths: ${pathToRegisterWithMacro}`
      );
    }
    const foundRegisteredPath = this._unsafeRegisters.find((registeredPath) =>
      pathToRegisterWithMacro
        .join(CACHE_PATH_DELIMITER)
        .startsWith(registeredPath.join(CACHE_PATH_DELIMITER))
    );
    if (foundRegisteredPath) {
      throw new Error(
        `A cache register already exists at: ${foundRegisteredPath}`
      );
    }
    this._unsafeRegisters.push(pathToRegisterWithMacro);
    set(this._unsafeCache, pathToRegisterWithMacro, initialData);
  };

  public set = (path: any, value: any) =>
    this._withMacroWrite(path, (cachePath) =>
      set(this._unsafeCache, cachePath, value)
    );

  public push = (path: any, value: any) =>
    this._withMacroWrite(path, (cachePath) => {
      const arr = get(this._unsafeCache, cachePath) || [];
      if (!Array.isArray(arr)) {
        throw new Error(
          `Cannot push to a non array at cache.${cachePath.join(".")}`
        );
      }

      arr.push(value);
      set(this._unsafeCache, cachePath, arr);
    });

  public unshift = <Value extends any = any>(path: any, value: Value) =>
    this._withMacroWrite(path, (cachePath) => {
      const arr = get(this._unsafeCache, cachePath) || [];
      if (!Array.isArray(arr)) {
        throw new Error(
          `Cannot unshift to a non array at cache.${cachePath.join(".")}`
        );
      }

      arr.unshift(value);
      set(this._unsafeCache, cachePath, arr);
    });

  public merge = <TValue extends any>(
    path: any,
    value: Record<string, TValue>
  ) =>
    this._withMacroWrite(path, (cachePath) => {
      const mapObj = get(this._unsafeCache, cachePath) || {};
      const isMap =
        mapObj && !Array.isArray(mapObj) && typeof mapObj === "object";
      if (!isMap) {
        throw new Error(
          `Cannot merge with a non-map at cache.${cachePath.join(".")}`
        );
      }
      set(this._unsafeCache, cachePath, {
        mapObj,
        ...value,
      });
    });

  public get = <TValue extends any>(accessPath: any) =>
    this._withMacroRead<TValue>(accessPath, (cachePath) => {
      return get(this._unsafeCache, cachePath);
    });

  public _dangerouslyStartMacro = (macroName: string) => {
    this._unsafeMacroName = macroName;
    this._unsafeRegisters = [];
    this._unsafeCache = {};
    this.register(this.getParsedBabelPath(), {});
    this.register(this.getParsedJscodeshiftPath(), {});
  };

  public _dangerouslyEndMacro = () => {
    this._unsafeHistory.unshift({
      _unsafeCache: this._unsafeCache,
      _unsafeRegisters: this._unsafeRegisters,
      _unsafeMacroName: this._unsafeMacroName,
    });
    this._unsafeCache = {};
    this._unsafeRegisters = [];
    this._unsafeMacroName = undefined;
  };
}

export default Cache;
