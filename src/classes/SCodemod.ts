import jscodeshift, { Collection } from "jscodeshift";
import type Store from "@src/classes/Store";

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
      return transform(collection, contents).toSource();
    }

    return transform(collection, contents).toSource();
  };
}

export default SCodemod;
