import { existsSync } from "fs";
import { resolve, dirname } from "path";
import { glob } from "glob";
import nextConstants from "@src/next/nextConstants";
import * as Utils from "@src/utils";
import log from "@log";
import constants from "@src/constants";

const getProjectRoot = (): string => {
  const foundConfig = nextConstants.CONFIG_EXTS.find((ext) =>
    existsSync(resolve(process.cwd(), `next.config.${ext}`))
  );
  const foundInstalledNext = !!Utils.getPackageDeps(process.cwd()).all.next;
  if (!foundInstalledNext) {
    throw new Error(
      `The "next" package is not installed anywhere in your package.json.`
    );
  }
  if (!foundConfig) {
    throw new Error(
      `Must run from within a Next.js project. Couldn't find a next.config.{${nextConstants.CONFIG_EXTS.join(
        ", "
      )}}`
    );
  }

  return process.cwd();
};

const usesAppRouterVersion = () => {
  const rootProjectPath = getProjectRoot();
  const nextMajorMinorVersion = Utils.getPackageDeps(rootProjectPath)
    .all.next.replace(/[^\d.]/g, "")
    .split(".")
    .slice(0, 2)
    .join(".");

  return Number(nextMajorMinorVersion) > 13.4;
};

const getAppDir = (rootPath?: string): string => {
  if (!rootPath) {
    rootPath = getProjectRoot();
  }

  let appDir: string;
  const topLevelAppDir = resolve(rootPath, "app");
  if (existsSync(topLevelAppDir)) {
    appDir = topLevelAppDir;
  }
  const srcLevelAppDir = resolve(rootPath, "src", "app");
  if (existsSync(srcLevelAppDir)) {
    appDir = srcLevelAppDir;
  }

  let foundPagesDir: string;
  const topLevelPagesDir = resolve(rootPath, "pages");
  if (existsSync(topLevelPagesDir)) {
    foundPagesDir = topLevelPagesDir;
  }
  const srcLevelPagesDir = resolve(rootPath, "src", "pages");
  if (existsSync(srcLevelPagesDir)) {
    foundPagesDir = srcLevelPagesDir;
  }
  if (foundPagesDir) {
    log.warn(
      'Nextcast does not support a "pages" directory. Please move your pages to an "app" directory for full functionality.'
    );
  }

  if (!appDir) {
    throw new Error(
      `Must run from within a Next.js project that uses the app router. Couldn't find an "app" or "src/app" directory.`
    );
  }

  return appDir;
};

export type NextRoute = {
  filePath: string;
  routePath: string;
  name: string;
  entries: Array<string>;
  clientComponents: Array<string>;
  serverComponents: Array<string>;
};

const isRouteFile = (fileName: string) => {
  const invalidExt = !nextConstants.SOURCE_EXTS.some((ext) =>
    fileName.endsWith(ext)
  );
  if (invalidExt) {
    return false;
  }

  const fileNameWithoutExt = fileName.slice(0, fileName.lastIndexOf("."));
  return (
    fileNameWithoutExt === "page" ||
    fileNameWithoutExt === "error" ||
    fileNameWithoutExt === "not-found" ||
    fileNameWithoutExt === "global-error"
  );
};

const getParentLayoutFiles = (routePath: string) => {
  const appDir = getAppDir();
  const layouts: Array<{ filePath: string; depth: number }> = [
    {
      filePath: resolve(appDir, "layout.tsx"),
      depth: 0,
    },
  ];
  const routePathArr = routePath.split("/").filter((e) => e);
  routePathArr.forEach((subpath, i) => {
    const fullSubpath = resolve(appDir, routePathArr.slice(0, i + 1).join("/"));
    const layoutFilePathExt = nextConstants.SOURCE_EXTS.find((ext) => {
      const filePath = resolve(fullSubpath, `layout${ext}`);
      return existsSync(filePath);
    });

    if (!layoutFilePathExt) {
      return;
    }

    const layoutFilePath = resolve(fullSubpath, `layout${layoutFilePathExt}`);

    let shouldSubstitute = false;

    const isRouteGroup = nextConstants.ROUTE_GROUP_REGEX.test(subpath);
    const prevLayout = layouts[0];

    if (prevLayout && isRouteGroup && prevLayout.depth === i) {
      shouldSubstitute = true;
    }

    if (shouldSubstitute) {
      layouts[0] = { filePath: layoutFilePath, depth: i + 1 };
    } else {
      layouts.unshift({ filePath: layoutFilePath, depth: i + 1 });
    }
  });

  return layouts.map((layout) => layout.filePath);
};

const getRouteEntries = async (): Promise<
  Array<Omit<NextRoute, "clientComponents" | "serverComponents">>
> => {
  const appDir = getAppDir();
  const routes: Array<
    Omit<NextRoute, "clientComponents" | "serverComponents">
  > = [];

  const files = await glob(`${appDir}/**/*.{js,ts,jsx,tsx}`);
  files.forEach((file) => {
    const dirPath = dirname(file);
    const fileName = file.replace(`${dirPath}/`, "");
    if (isRouteFile(fileName)) {
      const name = fileName.slice(0, fileName.lastIndexOf("."));
      routes.push({
        filePath: file,
        routePath: `${dirPath.replace(appDir, "")}/${name}`,
        name: name,
        entries: [file],
      });
    }
  });

  routes.forEach((route) => {
    const routeUsesLayouts =
      route.name === "error" ||
      route.name === "page" ||
      route.name === "not-found";
    if (routeUsesLayouts) {
      route.entries.push(...getParentLayoutFiles(route.routePath));
    }
    if (route.name === "page") {
      const templateFilePath = nextConstants.SOURCE_EXTS.find((ext) => {
        const templateFilePath = resolve(
          dirname(route.filePath),
          `template${ext}`
        );
        return existsSync(templateFilePath) && templateFilePath;
      });
      const loadingFilePath = nextConstants.SOURCE_EXTS.find((ext) => {
        const templateFilePath = resolve(
          dirname(route.filePath),
          `loading${ext}`
        );
        return existsSync(templateFilePath) && templateFilePath;
      });
      if (templateFilePath) {
        route.entries.push(templateFilePath);
      }
      if (loadingFilePath) {
        route.entries.push(loadingFilePath);
      }
    }
  });

  return routes;
};

const getDataDir = () => {
  return resolve(getProjectRoot(), constants.dataDirname);
};

const withCorrectExt = (filePath: string, fallbackValue?: any): string => {
  const withoutExt = filePath.slice(0, filePath.lastIndexOf("."));
  const correctExt = nextConstants.SOURCE_EXTS.find((ext) =>
    existsSync(`${withoutExt}${ext}`)
  );
  if (!correctExt) {
    if (typeof fallbackValue === "undefined") {
      throw new Error(
        `We expected ${filePath} to have a valid extension: ${nextConstants.SOURCE_EXTS.join(
          ", "
        )}`
      );
    }
    return fallbackValue;
  }
  return `${withoutExt}.${correctExt}`;
};

const nextSpec = {
  getDataDir,
  getProjectRoot,
  getAppDir,
  usesAppRouterVersion,
  getRouteEntries,
  withCorrectExt,
};

export default nextSpec;
