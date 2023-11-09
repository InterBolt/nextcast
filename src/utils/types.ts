interface JSONArray extends Array<JSONValue> {}

export type JSONValue =
  | string
  | number
  | boolean
  | null
  | { [member: string]: JSONValue }
  | JSONArray;

declare interface IStats {
  isFile: () => boolean;
  isDirectory: () => boolean;
  isBlockDevice: () => boolean;
  isCharacterDevice: () => boolean;
  isSymbolicLink: () => boolean;
  isFIFO: () => boolean;
  isSocket: () => boolean;
  dev: number | bigint;
  ino: number | bigint;
  mode: number | bigint;
  nlink: number | bigint;
  uid: number | bigint;
  gid: number | bigint;
  rdev: number | bigint;
  size: number | bigint;
  blksize: number | bigint;
  blocks: number | bigint;
  atimeMs: number | bigint;
  mtimeMs: number | bigint;
  ctimeMs: number | bigint;
  birthtimeMs: number | bigint;
  atime: Date;
  mtime: Date;
  ctime: Date;
  birthtime: Date;
}

interface IDirent {
  isFile: () => boolean;
  isDirectory: () => boolean;
  isBlockDevice: () => boolean;
  isCharacterDevice: () => boolean;
  isSymbolicLink: () => boolean;
  isFIFO: () => boolean;
  isSocket: () => boolean;
  name: string | Buffer;
}

export interface InputFileSystem {
  readFile: (
    arg0: string,
    arg1: (arg0?: null | NodeJS.ErrnoException, arg1?: string | Buffer) => void
  ) => void;
  readJson?: (
    arg0: string,
    arg1: (arg0?: null | Error | NodeJS.ErrnoException, arg1?: any) => void
  ) => void;
  readlink: (
    arg0: string,
    arg1: (arg0?: null | NodeJS.ErrnoException, arg1?: string | Buffer) => void
  ) => void;
  readdir: (
    arg0: string,
    arg1: (
      arg0?: null | NodeJS.ErrnoException,
      arg1?: (string | Buffer)[] | IDirent[]
    ) => void
  ) => void;
  stat: (
    arg0: string,
    arg1: (arg0?: null | NodeJS.ErrnoException, arg1?: IStats) => void
  ) => void;
  lstat?: (
    arg0: string,
    arg1: (arg0?: null | NodeJS.ErrnoException, arg1?: IStats) => void
  ) => void;
  realpath?: (
    arg0: string,
    arg1: (arg0?: null | NodeJS.ErrnoException, arg1?: string | Buffer) => void
  ) => void;
  purge?: (arg0?: string) => void;
  join?: (arg0: string, arg1: string) => string;
  relative?: (arg0: string, arg1: string) => string;
  dirname?: (arg0: string) => string;
}
