[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
![npm](https://img.shields.io/npm/v/nextcast)

# NextCast

**This is an alpha version and the plugin API is subject to change.**

_Read the blog post here for a high level description and backstory: https://interbolt.org/blog/nextcast/_

At a high level, **NextCast** is a build tool that makes **static analysis + metaprogramming** accessible to application developers using NextJS's [app router](https://nextjs.org/docs/app). It exposes a user plugin system built on top of [NextJS](https://nextjs.org)'s webpack configuration ([turbopack](https://turbo.build/pack) support coming), [BabelJS](https://babeljs.io/), [Jscodeshift](https://github.com/facebook/jscodeshift), and [ESLint](https://eslint.org/).

A plugin can collect static information about source code, generate helpful artifacts like JSON files and TypeScript interfaces, pipe domain-driven errors and warnings into ESLint, and rewrite code ([webpack loader style](https://webpack.js.org/contribute/writing-a-loader/#guidelines)) during the build process. Plugins define their logic within three different phases:

- **The collector phase**: collects information about [NextJS](https://nextjs.org) source code via static analysis.
- **The reducer phase**: Uses collected source code data and (potentially) external data sources to generate artifacts like JSON files, TypeScript interfaces, documentation, etc.
- **The rewriter phase**: Uses gathered information and artifacts to rewrite application code.

## Setup

Install NextCast and its ESLint plugin with npm

```bash
npm install nextcast eslint-plugin-nextcast
```

Add the nextcast eslint plugin to your eslint config file. Here's an example `.eslintrc.json` file:

```json
{
  "extends": ["next/core-web-vitals"],
  "plugins": ["nextcast"],
  "rules": {
    "nextcast/error": 2,
    "nextcast/warn": 1
  }
}
```

Modify your `next.config.js` file:

```javascript
const { withNextcast } = require("nextcast");

/** @type {import('next').NextConfig} */
const nextConfig = { ... };

module.exports = withNextcast(nextConfig);
```

Create a `nextcasts/index.ts` file for your custom plugins:

```bash
mkdir nextcasts
touch nextcasts/index.ts
```

And finally, within `nextcasts/index.ts` you can define your plugins likeso:

_NextCast will automatically generate a `nextcasts/tsconfig.json` file when you run `next build/dev`._

```typescript
const CustomPlugins = [...]

export default CustomPlugins;
```

Once all of that is in place, you can head down to the API reference below to learn how to create a new NextCast plugin.

## API reference for user defined plugins

_**Disclaimer**: I'll be adding more helper methods for traversing NextJS source files in the future. In the meantime, I expect most useful plugins will need to write lots of their own AST traversals._

A user plugin must implement the following interface:

```typescript
import type { TNextCast } from "nextcast";

// Implement the interface as a class if possible
interface NextCastPlugin {
  config: Record<string, any>;
  name: string;
  collector: TNextCast.Collector;
  reducer: TNextCast.Reducer;
  rewriter: TNextCast.Rewriter;
}
```

#### TNextCast.Collector

```typescript
(ctx: TNextCast.PluginContext, api: TNextCast.PluginApi) => void
```

A lifecycle method for plugin authors to collect information about source code.

| Parameter | Type                      |
| :-------- | :------------------------ |
| `ctx`     | `TNextCast.PluginContext` |
| `api`     | `TNextCast.Api`           |

#### TNextCast.Reducer

```typescript
(ctx: TNextCast.PluginContext, api: TNextCast.PluginApi) => SerializableJSON;
```

A lifecycle method for plugin authors to reduce collected information and build/generate artifacts. The value returned is how we populate `TNextCast.PluginContext.data` in the next lifecycle method.

| Parameter | Type                      |
| :-------- | :------------------------ |
| `ctx`     | `TNextCast.PluginContext` |
| `api`     | `TNextCast.Api`           |

#### TNextCast.Rewriter

```typescript
(ctx: TNextCast.PluginContext, api: TNextCast.PluginApi) => void
```

A lifecycle method for plugin authors to rewrite code.

| Parameter | Type                      |
| :-------- | :------------------------ |
| `ctx`     | `TNextCast.PluginContext` |
| `api`     | `TNextCast.Api`           |

## API reference for `TNextCast.PluginContext`

#### PluginContext.sourceFiles

```typescript
Array<string>;
```

A list of all source code files paths. Any files not included in this array were not parsed ahead of time.

#### PluginContext.routes

```typescript
Array<{
  name: string;
  entries: Array<string>;
  files: Array<string>;
  serverComponents: Array<string>;
  clientComponents: Array<string>;
}>;
```

`entries`, `files`, `serverComponents`, and `clientComponents` are all lists of file paths. The name is the route name - ex: `/about` or `/dashboard`

#### PluginContext.data

```typescript
SerializableJSON;
```

The data returned by the reducer. By default, this data is attached to the root layout's opening html tag as a data-attribute.

## API reference for `TNextCast.PluginApi`

#### PluginApi.collect

```typescript
(data: SerializableJSON) => void;
```

Use this function to store information relating to source code.

#### PluginApi.modify

```typescript
(
  filePath: string,
  transform: (collection: JscodeshiftCollection) => JscodeshiftCollection,
  opts?: { cacheKey?: string; useCache?: boolean; dontCache?: boolean }
) => string;
```

Supply a `transform` param to modify a file's AST and refer to https://github.com/facebook/jscodeshift for how to modify a `JscodeshiftCollection`. Note: `PluginApi.modify` will prevent you from calling `JscodeshiftCollection.toSource()`, since it prefers to do that internally for caching reasons.

#### PluginApi.queueRewrite

```typescript
(code: string, filePath: string) => void
```

Tells NextCast to rewrite this file before running NextJS loaders. Note: **This does not rewrite actual source code.**

#### PluginApi.dangerouslyQueueRewrite

```typescript
(code: string, filePath: string) => void
```

Tells NextCast to rewrite the actual, version-controlled source code. Important: **This will modify your project's source code. Use carefully.**

#### PluginApi.reportError

```typescript
(
    message: string,
    filePath: string,
    node: BabelNode | JSCodeshiftNode = null
) => void
```

Usually, you'll want to call this while traversing or modifying a babel or jscodeshift AST. If you pass in a valid AST node as the third argument, ESLint will be able to point out the exact line/column number of the error.

#### PluginApi.reportWarning

```typescript
(
    message: string,
    filePath: string,
    node: BabelNode | JSCodeshiftNode = null
) => void
```

Works exactly the same as `PluginApi.reportError`, except you'll see warnings in ESLint, not errors.

#### PluginApi.traverse

```typescript
// See @babel/traverse docs for the TraverseOptions type

(filePath: string, traversalOptions: TraverseOptions): BabelAST
```

Wraps `@babel/traverse` - https://babeljs.io/docs/babel-traverse

#### PluginApi.parse

```typescript
(filePath: string) => BabelAST;
```

Wraps `babel/parser` and returns a cached version of the AST if the `filePath` was already parsed.

#### PluginApi.getRewrites

```typescript
() => {
    dangerous: {
        history: Array<{ filePath: string; code: string }>,
        toCommit: Record<string, string>
    },
    loader: {
        history: Array<{ filePath: string; code: string }>,
        toCommit: Record<string, string>
    }
}
```

Get all queued rewrites that will occur to either the source code (`dangerous`), or within a webpack build (`loader`). If a file was rewritten multiple times, you'll only see the latest rewrite at `[dangerous|loader].toCommit[filePath]` slot.

#### PluginApi.getCollected

```typescript
() => Array<SerializableJSON>;
```

You can call this at any point to get a list of all the data collected via `PluginApi.collect`.

#### PluginApi.getErrors

```typescript
type Error = {
  info: {
    loc: LocPosition;
    plugin: string;
    file: string;
    line: string;
    column: string;
    source: string;
  };
  message: string;
};

() => Array<Error>;
```

Returns a list of all the errors reported up until this point.

#### PluginApi.getWarnings

```typescript
type Warning = {
  info: {
    loc: LocPosition;
    plugin: string;
    file: string;
    line: string;
    column: string;
    source: string;
  };
  message: string;
};

() => Array<Warning>;
```

Returns a list of all the warnings reported up until this point.

## A note on the undocumented API at `PluginApi._.`

Any functions attached to `PluginApi._` should be consider experimental and used with caution. I am still researching useful helper methods and am using this namespace to experiment.
