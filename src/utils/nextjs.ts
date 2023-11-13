import { basename, dirname, resolve } from "path";
import { existsSync } from "fs";
import appRootPath from "app-root-path";
import resolveAliasedImport from "./resolveAliasedImport";

export const validExts = ["js", "ts", "tsx", "jsx"];
export const routeGroupRegex = /^.*\(.*\)$/;

export const removeExt = (filePath: string): string => {
  if (validExts.find((ext) => filePath.endsWith(`.${ext}`))) {
    return filePath.slice(0, filePath.lastIndexOf("."));
  }
  return filePath;
};

export const withCorrectExt = (
  filePath: string,
  ifFileDoesntExist?: any
): string => {
  const withoutExt = removeExt(filePath);
  const correctExt = validExts.find((ext) =>
    existsSync(`${withoutExt}.${ext}`)
  );
  if (!correctExt) {
    if (typeof ifFileDoesntExist === "undefined") {
      throw new Error(`No valid extension found for ${filePath}`);
    }
    return ifFileDoesntExist;
  }
  return `${withoutExt}.${correctExt}`;
};

export const getProjectRoot = (): string => {
  const isCWDNextJSProject = existsSync(
    resolve(process.cwd(), "next.config.js")
  );
  if (isCWDNextJSProject) {
    return process.cwd();
  }
  const isRootNextJSProject = existsSync(
    resolve(appRootPath.path, "next.config.js")
  );
  if (isRootNextJSProject) {
    return appRootPath.path;
  }
  throw new Error("Can't locate a NextJS project.");
};

export const getAppDir = (rootPath?: string): string => {
  if (!rootPath) {
    rootPath = getProjectRoot();
  }
  const isNextJSProject = existsSync(resolve(rootPath, "next.config.js"));
  if (!isNextJSProject) {
    throw new Error(
      "Not a Next.js project. Can't locate a NextJS app router directory."
    );
  }
  const topLevelAppDir = resolve(rootPath, "app");
  if (existsSync(topLevelAppDir)) {
    return topLevelAppDir;
  }
  const srcLevelAppDir = resolve(rootPath, "src", "app");
  if (existsSync(srcLevelAppDir)) {
    return srcLevelAppDir;
  }
  let foundPagesDir: string;
  const topLevelPagesDir = resolve(rootPath, "app");
  if (existsSync(topLevelPagesDir)) {
    foundPagesDir = topLevelPagesDir;
  }
  const srcLevelPagesDir = resolve(rootPath, "src", "app");
  if (existsSync(srcLevelPagesDir)) {
    foundPagesDir = srcLevelPagesDir;
  }
  if (foundPagesDir) {
    throw new Error(
      "You must use the new NextJS app router directory structure. See https://nextjs.org/docs"
    );
  }
  throw new Error(
    "Can't locate a NextJS app or pages directory. Are you sure this is a valid NextJS project?"
  );
};

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

export const resolveImport = (filePath: string, importPath: string) => {
  const projectRoot = getProjectRoot();
  const tsconfig = (() => {
    try {
      return require(resolve(projectRoot, "tsconfig.json"));
    } catch (err) {
      return undefined;
    }
  })();
  return resolveAliasedImport(getProjectRoot(), filePath, importPath, {
    ...(tsconfig?.compilerOptions?.paths || {}),
    ["*"]: ["node_modules/*"],
  });
};
