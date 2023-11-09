import { InputFileSystem } from "./types";
import * as sourceFs from "fs";

const rewrite = (
  rewriteMap: Record<string, string>,
  fs: InputFileSystem = sourceFs
) => {};

export default rewrite;
