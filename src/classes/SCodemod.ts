import jscodeshift, { Collection } from "jscodeshift";
import { existsSync, readFileSync } from "fs";
import * as Utils from "@src/utils";
import type Store from "@src/classes/Store";
import nextSpec from "@src/next/nextSpec";
import { createHash } from "crypto";

const collectionProxy: (collection: Collection) => Collection = (
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

  private _parse = (contents: string) => {
    return jscodeshift.withParser("tsx")(contents);
  };

  public modify = (
    contents: string,
    transform: (collection: Collection, inputContents: string) => Collection
  ) => {
    const collection = this._parse(contents);
    if (!this.store) {
      return transform(collectionProxy(collection), contents).toSource();
    }

    return transform(collectionProxy(collection), contents).toSource();
  };
}

export default SCodemod;
