import { readFileSync, existsSync } from "fs";
import jscodeshift from "jscodeshift";
import resolvers from "./resolvers";
import * as Types from "../types";
import Cache from "../classes/cache";

const recursiveSegmentParse = (
  entryPath: string,
  segmentName: string,
  cacheGetter: (filePath: string) => Types.CollectorFile,
  cacheSetter: (segmentName: string, file: Types.CollectorFile) => void
) => {
  if (!existsSync(entryPath)) {
    throw new Error(`Could not parse: ${entryPath} file does not exist`);
  }

  const alreadyParsedCollection = cacheGetter(entryPath);
  if (alreadyParsedCollection) {
    cacheSetter(segmentName, alreadyParsedCollection);
    return;
  }

  const sourceCode = readFileSync(entryPath, "utf8");
  const astCollection = jscodeshift.withParser("tsx")(sourceCode);
  cacheSetter(segmentName, {
    astCollection,
    filePath: entryPath,
    sourceCode,
  });
  resolvers
    .topLevelAndDynamic(entryPath, astCollection)
    .forEach((importPath) =>
      recursiveSegmentParse(importPath, segmentName, cacheGetter, cacheSetter)
    );
};

const parse = (cache: Cache) => {
  const segments = cache.getSegments();
  console.log(cache);
  segments.forEach((segment) => {
    segment.entries.forEach((entry) => {
      recursiveSegmentParse(
        entry,
        segment.name,
        cache.getCollectedFile,
        cache.addCollectedFile
      );
    });
  });
};

export default parse;
