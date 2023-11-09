import { resolve } from "path";
import { existsSync } from "fs";

const getNestedDepthRelativePath = (basePath: string, nestedPath: string) => {
  const nestDistance = nestedPath.replace(basePath, "").split("/").length - 1;
  return [...Array(nestDistance).keys()].map(() => "..").join("/");
};

const onlyUnique = <TArrElement extends any>(
  value: TArrElement,
  index: number,
  array: Array<TArrElement>
): boolean => {
  return array.indexOf(value) === index;
};

const withoutAsterisk = (path: string) => [path.replaceAll("*", ""), path];

const resolveAliasedImport = (
  basePath: string,
  sourcePath: string,
  importPath: string,
  aliasPaths: Record<string, Array<string>>
) => {
  const currentDefaultPaths = Array.isArray(aliasPaths["*"])
    ? aliasPaths["*"]
    : [];
  const aliases = Object.keys({
    ...aliasPaths,
    "*": [...currentDefaultPaths, "node_modules/*"].filter(onlyUnique),
  });
  const potentialPaths = aliases
    .map(withoutAsterisk)
    .map(([aliasWithoutAsterisk, alias]) => {
      const unaliasedPaths = importPath.startsWith(aliasWithoutAsterisk)
        ? aliasPaths[alias]
            .map(withoutAsterisk)
            .map(([mappedPathWithoutAsterisk]) => {
              return resolve(
                sourcePath,
                getNestedDepthRelativePath(basePath, sourcePath),
                importPath.replace(
                  aliasWithoutAsterisk,
                  mappedPathWithoutAsterisk
                )
              );
            })
        : [resolve(sourcePath, "..", importPath)];

      const withGuessedExtensions = unaliasedPaths
        .concat(
          unaliasedPaths
            .map((unaliasedPath) => {
              const lastSubpath = unaliasedPath.split("/").at(-1);

              if (lastSubpath.includes(".")) {
                return [unaliasedPath];
              }

              return [
                unaliasedPath + ".ts",
                unaliasedPath + ".tsx",
                unaliasedPath + ".js",
                unaliasedPath + ".jsx",
              ];
            })
            .flat()
        )
        .flat();

      return withGuessedExtensions;
    })
    .flat()
    .filter(onlyUnique)
    .sort((a, b) => b.length - a.length);

  // find which of the two potentialPaths the correct path is when combined with the basePath
  const correctPath = potentialPaths.find((e) => existsSync(e));

  if (!correctPath) {
    throw new Error(
      `Could not resolve possible paths: ${potentialPaths.join(", ")}`
    );
  }

  return correctPath;
};

export default resolveAliasedImport;
