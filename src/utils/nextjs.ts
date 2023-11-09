import { basename, dirname, resolve } from "path";
import { existsSync } from "fs";
import { glob } from "glob";
import * as Types from "../types";
import appRootPath from "app-root-path";

const validExts = ["js", "ts", "tsx", "jsx"];
const routeGroupRegex = /^.*\(.*\)$/;

const removeExt = (filePath: string): string => {
  if (validExts.find((ext) => filePath.endsWith(`.${ext}`))) {
    return filePath.slice(0, filePath.lastIndexOf("."));
  }
  return filePath;
};

export const withCorrectExt = (filePath: string): string => {
  const withoutExt = removeExt(filePath);
  const correctExt = validExts.find((ext) =>
    existsSync(`${withoutExt}.${ext}`)
  );
  console.log(withoutExt, correctExt);
  if (!correctExt) {
    throw new Error(`No valid extension found for ${filePath}`);
  }
  return `${withoutExt}.${correctExt}`;
};

export const getAppDir = (): string => resolve(appRootPath.path, "app");

export const getParentLayouts = (
  routeFile: string,
  layouts = []
): Array<string> => {
  const appDir = getAppDir();
  const routeFileName = removeExt(basename(routeFile));
  const rootLayouDirPath = withCorrectExt(resolve(appDir, "layout"));
  const pageDirPath = dirname(routeFile);
  const pageDirName = basename(dirname(routeFile));
  const parentDirPath = resolve(pageDirPath, "..");
  const grandparentDirPath = resolve(pageDirPath, "..", "..");

  if (appDir === pageDirPath) {
    layouts.push(rootLayouDirPath);
    return layouts;
  }

  const layoutPath = withCorrectExt(routeFile);
  if (!existsSync(layoutPath)) {
    return getParentLayouts(parentDirPath, layouts);
  }

  layouts.push(layoutPath);

  const isInRouteGroup = routeGroupRegex.test(pageDirName);
  if (isInRouteGroup) {
    if (grandparentDirPath === appDir) {
      layouts.push(rootLayouDirPath);
      return layouts;
    }
    return getParentLayouts(
      withCorrectExt(resolve(grandparentDirPath, "layout")),
      layouts
    );
  }

  return getParentLayouts(
    withCorrectExt(resolve(parentDirPath, routeFileName)),
    layouts
  );
};

export const getSegments = async (): Promise<Array<Types.CollectorSegment>> => {
  const appDir = getAppDir();
  const pageSegments = (await glob(`${appDir}/**/page.{js,ts,jsx,tsx}`)).map(
    (pageFile) => ({
      name: removeExt(pageFile).replace(appDir, "") || "/page",
      entries: ["page", "template", "loading", ...getParentLayouts(pageFile)]
        .map((entryFile) => {
          return validExts
            .map((ext) => resolve(dirname(pageFile), `${entryFile}.${ext}`))
            .find(existsSync);
        })
        .filter((e) => e),
      files: [],
    })
  );

  const notFoundSegments = (
    await glob(`${appDir}/**/not-found.{js,ts,jsx,tsx}`)
  ).map((notFoundFile) => ({
    name: removeExt(notFoundFile).replace(appDir, "") || "/not-found",
    entries: [notFoundFile],
    files: [],
  }));

  const errorSegments = (
    await glob(`${appDir}/**/{error,global-error}.{js,ts,jsx,tsx}`)
  )
    .map(removeExt)
    .filter((errorFileWithoutExt, i, filesWithoutExt) => {
      const hasGlobalError =
        filesWithoutExt.indexOf(resolve(appDir, "global-error")) !== -1;
      const isRootErrorFile = errorFileWithoutExt === resolve(appDir, "error");
      const shouldRemove = hasGlobalError && isRootErrorFile;

      return !shouldRemove;
    })
    .map(withCorrectExt)
    .map((errorFile) => ({
      name: removeExt(errorFile).replace(appDir, "") || "/error",
      entries:
        removeExt(basename(errorFile)) === "global-error"
          ? [errorFile]
          : [errorFile, ...getParentLayouts(errorFile)],
      files: [],
    }));

  return [...pageSegments, ...notFoundSegments, ...errorSegments];
};
