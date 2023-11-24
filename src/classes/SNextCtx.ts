import { readFileSync } from "fs";
import STraversals from "./STraversals";
import Store from "./Store/index";
import { NextCtx } from "../types";
import nextSpec from "../next/nextSpec";

class SNextCtx {
  private traversals: STraversals;

  constructor(store: Store) {
    this.traversals = new STraversals(store);
  }

  private _mapToComponentTypes = (
    files: Array<string>
  ): { clientComponents: Array<string>; serverComponents: Array<string> } => {
    return files
      .map((filePath) => {
        const fileContents = readFileSync(filePath, "utf8");
        const lines = fileContents.split("\n");
        return lines.some(
          (line) =>
            line.trim() === `"use client"` ||
            line.trim() === `"use client";` ||
            line.trim() === `'use client'` ||
            line.trim() === `'use client';`
        );
      })
      .reduce(
        (accum, hasClientDirective, i) => {
          if (hasClientDirective) accum.clientComponents.push(files[i]);
          else accum.serverComponents.push(files[i]);
          return accum;
        },
        {
          clientComponents: [],
          serverComponents: [],
        }
      );
  };

  public load = async (): Promise<NextCtx> => {
    const routesWithEntries = await nextSpec.getRouteEntries();
    const routes = routesWithEntries.map(({ routePath, entries }) => {
      const nextRoute = {
        name: routePath,
        entries,
        files: entries
          .map((entry) => this.traversals.extractFilePaths(entry))
          .flat()
          .reduce(
            (unique, filePath) =>
              unique.includes(filePath) ? unique : unique.concat([filePath]),
            [] as Array<string>
          ),
      };

      const { clientComponents, serverComponents } = this._mapToComponentTypes(
        nextRoute.files
      );

      return {
        ...nextRoute,
        clientComponents,
        serverComponents,
      };
    });

    return { routes };
  };
}

export default SNextCtx;
