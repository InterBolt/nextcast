import jscodeshift, { Collection } from "jscodeshift";
import { existsSync, readFileSync } from "fs";
import * as Utils from "../utils";
import type Store from "./Store";
import nextSpec from "../next/nextSpec";

const getCollectionProxy: (collection: Collection) => Collection = (
  collection: Collection
) =>
  new Proxy(collection, {
    get: (target, prop) => {
      if (prop === "toSource") {
        return () => {
          const messages = [
            `NextCast restricts calling toSource() directly.`,
            `Everything else about your jscodeshift collection works as intended.`,
          ];
          throw new Error(messages.join("\n"));
        };
      }

      return target[prop];
    },
  });

class SCodemod {
  private store: Store;

  constructor(store?: Store) {
    if (!store) {
      return;
    }
    this.store = store;
    this.store.registerAccessPath(this._pathModifications, {});
  }

  private _pathModifications = ["codemods", "modifications"];

  private _parse = (filePath: string) =>
    jscodeshift.withParser("tsx")(
      readFileSync(nextSpec.withCorrectExt(filePath), "utf8")
    );

  public modify = (
    file: string,
    transform: (collection: Collection) => Collection,
    opts: { cacheKey?: string; useCache?: boolean; dontCache?: boolean } = {}
  ) => {
    if (!existsSync(file)) {
      throw new Error(`File ${file} does not exist`);
    }
    if (!this.store) {
      return transform(getCollectionProxy(this._parse(file))).toSource();
    }

    const { useCache = true, dontCache = false, cacheKey = null } = opts;
    const weakMapCacheKey = cacheKey ? { [cacheKey]: cacheKey } : null;

    type WeakMapCache = WeakMap<
      ((...args: any[]) => any) | { [k in string]: string },
      string
    >;

    if (useCache) {
      const cached = this.store.reads.get<WeakMapCache>(
        this._pathModifications
      );
      const cachedResult = cached.get(
        weakMapCacheKey ? weakMapCacheKey : transform
      );
      if (typeof cachedResult === "string") {
        return cachedResult;
      }
    }

    const modifiedCollection = transform(getCollectionProxy(this._parse(file)));
    const modifiedSourceCode = modifiedCollection.toSource();

    if (dontCache) {
      return modifiedSourceCode;
    }

    const cached = this.store.reads.get<WeakMapCache>(this._pathModifications);

    cached.set(
      weakMapCacheKey ? weakMapCacheKey : transform,
      modifiedSourceCode
    );

    return modifiedSourceCode;
  };
}

export default SCodemod;
