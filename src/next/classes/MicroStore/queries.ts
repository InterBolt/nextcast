import { get, set } from "lodash";
import type MicroStore from "./index";

export class Writes {
  public store: MicroStore;

  constructor(store: MicroStore) {
    this.store = store;
  }

  public set = (accessPath: any, value: any) =>
    set(this.store._unsafeStore, accessPath, value);

  public push = (accessPath: any, value: any) => {
    const arr = get(this.store._unsafeStore, accessPath) || [];
    if (!Array.isArray(arr)) {
      throw new Error(
        `Cannot push to a non array at store.${accessPath.join(".")}`
      );
    }

    arr.push(value);
    set(this.store._unsafeStore, accessPath, arr);
  };

  public unshift = <Value extends any = any>(accessPath: any, value: Value) => {
    const arr = get(this.store._unsafeStore, accessPath) || [];
    if (!Array.isArray(arr)) {
      throw new Error(
        `Cannot unshift to a non array at store.${accessPath.join(".")}`
      );
    }

    arr.unshift(value);
    set(this.store._unsafeStore, accessPath, arr);
  };

  public merge = <TValue extends any>(
    accessPath: any,
    value: Record<string, TValue>
  ) => {
    const mapObj = get(this.store._unsafeStore, accessPath) || {};
    const isMap =
      mapObj && !Array.isArray(mapObj) && typeof mapObj === "object";
    if (!isMap) {
      throw new Error(
        `Cannot merge with a non-map at store.${accessPath.join(".")}`
      );
    }
    set(this.store._unsafeStore, accessPath, {
      mapObj,
      ...value,
    });
  };
}

export class Reads {
  public store: MicroStore;

  constructor(store: MicroStore) {
    this.store = store;
  }

  public get = <TValue extends any>(accessPath: any): TValue =>
    get(this.store._unsafeStore, accessPath);
}
