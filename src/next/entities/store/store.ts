import { existsSync, readFileSync } from "fs";
import { set } from "lodash";
import type * as Types from "../../types";
import * as parser from "@babel/parser";
import { Reads, Writes } from "./queries";

const STORE_PATH_DELIMITER = ".0BslO9.";

const prohibitAccessProxy = (errorMessage: string) => {
  return new Proxy({} as any, {
    get: () => {
      // throw before the invocation of the getter since the reference would be lost
      // when we call _dangerouslyStartMicro().
      throw new Error(errorMessage);
    },
  });
};

const uninitializedErrorMessage = `Store not initialized. Must call _dangerouslyStartMicro().`;
const endedErrorMessage = `Store is closed. We already called _dangerouslyEndMicro().`;

type THistory = Pick<
  Store,
  "_unsafeAccessRegisters" | "_unsafeStore" | "_unsafeMicroName"
>;

class Store {
  public _unsafeAccessRegisters: Array<Array<string>> = [];
  public _unsafeStore: any = {};
  public _unsafeMicroName: string;
  public _unsafeHistory: Array<THistory> = [];

  // by default, these are set to throw errors any time they are accessed
  // this should prevent any accidental access before the micro is started
  public reads: Reads = prohibitAccessProxy(uninitializedErrorMessage);
  public writes: Writes = prohibitAccessProxy(uninitializedErrorMessage);

  public getHistory = () => {
    return this._unsafeHistory.map((history) => new Store(history));
  };

  constructor(cacheHistory?: THistory) {
    if (cacheHistory) {
      Object.keys(cacheHistory).forEach((storeKey) => {
        this[storeKey] = cacheHistory[storeKey];
      });
    }
  }

  public getParseCache = () =>
    this.reads.get<Record<string, Types.ParsedBabel>>(
      this._safePath(["parsed"])
    );

  public accessMicroName = () => {
    if (typeof this._unsafeMicroName === "undefined") {
      throw new Error(`Cannot set cache without a micro name.`);
    }
    return this._unsafeMicroName;
  };

  private _validatePath = (path: any) => {
    if (!Array.isArray(path)) {
      throw new Error(`Store path must be an array.`);
    }
    if (path.some((subpath) => typeof subpath !== "string")) {
      throw new Error(`Store path must be an array of strings.`);
    }
  };

  private _applySafeReads = <TReads extends Reads>(reads: TReads): TReads => {
    return new Proxy(reads, {
      get: (target: TReads, readMethodName: string) => {
        if (typeof target[readMethodName] !== "function") {
          return target[readMethodName];
        }
        return (accessPath: Array<string>, ...args: any[]) => {
          const cachePath = this._safePath(accessPath);
          this._validatePath(cachePath);

          const isValid = this._unsafeAccessRegisters.some((registeredPath) =>
            registeredPath
              .join(STORE_PATH_DELIMITER)
              .startsWith(cachePath.join(STORE_PATH_DELIMITER))
          );
          if (!isValid) {
            throw new Error(
              `Nothing exists in the cache at path: ${cachePath}`
            );
          }

          return reads[readMethodName](cachePath, ...args);
        };
      },
    }) as TReads;
  };

  private _applySafeWrites = <TWrites extends Writes>(
    writes: TWrites
  ): TWrites => {
    return new Proxy(writes, {
      get: (target: TWrites, writeMethodName: string) => {
        if (typeof target[writeMethodName] !== "function") {
          return target[writeMethodName];
        }
        return (accessPath: Array<string>, ...args: any[]) => {
          const cachePath = this._safePath(accessPath);
          this._validatePath(cachePath);

          const isValid = this._unsafeAccessRegisters.some(
            (registeredPath) =>
              registeredPath.join(STORE_PATH_DELIMITER) ===
              cachePath.join(STORE_PATH_DELIMITER)
          );
          if (!isValid) {
            throw new Error(`Can't mutate unregistered path: ${cachePath}`);
          }

          return writes[writeMethodName](cachePath, ...args);
        };
      },
    }) as TWrites;
  };

  private _safePath = (path: Array<string>) => {
    const cachePath = [this.accessMicroName(), ...path];
    this._validatePath(cachePath);
    return cachePath;
  };

  public parse = (filePath: string): Types.ParsedBabel => {
    if (!existsSync(filePath)) {
      throw new Error(`Cannot parse ${filePath} because it does not exist.`);
    }

    const cachePath = this._safePath(["parsed"]);
    const parseStored = this.reads.get(cachePath);
    if (parseStored[filePath]) {
      return parseStored[filePath];
    }

    const sourceCode = readFileSync(filePath, "utf8");
    const babelOptions: Parameters<typeof parser.parse>[1] = {
      sourceType: "module",
      plugins: ["jsx"],
    };
    if (filePath.endsWith(".ts") || filePath.endsWith(".tsx")) {
      babelOptions.plugins.push("typescript");
    }

    const returnValue: Types.ParsedBabel = parser.parse(
      sourceCode,
      babelOptions
    );

    this.writes.merge<Types.ParsedBabel>(cachePath, {
      [filePath]: returnValue,
    });

    return returnValue;
  };

  public registerAccessPath = (
    accessPathToRegister: any,
    initialData: any = null
  ) => {
    this._validatePath(accessPathToRegister);
    const accessPathToRegisterWithMicro = [
      this.accessMicroName(),
      ...accessPathToRegister,
    ];
    const containsDelimiter = accessPathToRegisterWithMicro.some((subpath) =>
      subpath.includes(STORE_PATH_DELIMITER)
    );
    if (containsDelimiter) {
      throw new Error(
        `Cannot use delimiter "${STORE_PATH_DELIMITER}" in registered subpaths: ${accessPathToRegisterWithMicro}`
      );
    }
    const foundRegisteredPath = this._unsafeAccessRegisters.find(
      (registeredPath) =>
        accessPathToRegisterWithMicro
          .join(STORE_PATH_DELIMITER)
          .startsWith(registeredPath.join(STORE_PATH_DELIMITER))
    );
    if (foundRegisteredPath) {
      throw new Error(
        `A cache register already exists at: ${foundRegisteredPath}`
      );
    }
    this._unsafeAccessRegisters.push(accessPathToRegisterWithMicro);
    set(this._unsafeStore, accessPathToRegisterWithMicro, initialData);
  };

  public _dangerouslyStartMicro = (
    microName: string,
    preparsed: Record<string, Types.ParsedBabel> = null
  ) => {
    this._unsafeMicroName = microName;
    this._unsafeAccessRegisters = [];
    this._unsafeStore = {};

    this.reads = this._applySafeReads(new Reads(this));
    this.writes = this._applySafeWrites(new Writes(this));

    this.registerAccessPath(this._safePath(["parsed"]), preparsed || {});
  };

  public _dangerouslyEndMicro = () => {
    this._unsafeHistory.unshift({
      _unsafeStore: this._unsafeStore,
      _unsafeAccessRegisters: this._unsafeAccessRegisters,
      _unsafeMicroName: this._unsafeMicroName,
    });
    this._unsafeStore = {};
    this._unsafeAccessRegisters = [];
    this._unsafeMicroName = undefined;

    // throw error on access after micro is ended
    this.reads = prohibitAccessProxy(endedErrorMessage);
    this.writes = prohibitAccessProxy(endedErrorMessage);
  };
}

export default Store;
