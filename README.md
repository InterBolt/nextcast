[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
![npm](https://img.shields.io/npm/v/nextcast)
![X (formerly Twitter) Follow](https://img.shields.io/twitter/follow/interbolt_colin)

# NextCast

**This is an alpha version. The plugin API is subject to change.**

_Read the blog post here for a high level description and backstory: https://interbolt.org/blog/nextcast/_

**NextCast** is a plugin system that reduces the friction involved with doing **static analysis and metaprogramming** within NextJS applications. Its built on top of [Webpack](https://webpack.js.org), [BabelJS](https://babeljs.io/), [Jscodeshift](https://github.com/facebook/jscodeshift), and [ESLint](https://eslint.org/).

A plugin can collect static information about source code, generate helpful artifacts like JSON files and TypeScript interfaces, pipe domain-driven errors and warnings into ESLint, and rewrite code ([webpack loader style](https://webpack.js.org/contribute/writing-a-loader/#guidelines)) during the build process. Plugins define their logic within three different phases:

- **Collector phase (sync, series)**: Collect information about [NextJS](https://nextjs.org) source code via static analysis. Used for accummulating data based on babel traversals. Each plugin's collector runs in the order the plugins were defined, making it easy for plugin authors to leverage collected data from a "base" plugin, third party or their own.

- **Builder phase (async, parallel)**: Uses the data collected in the collector phase in combination with any number of possible internal or external data sources to produce useful information to lend our rewrite logic. Each plugin's builder phase will run in parallel.

- **Rewriter phase (async, series)**: Uses gathered information and artifacts to queue rewrites. Each plugin's rewriter must await the previously defined plugin's rewriter to run, which means plugin authors should only use async code for things like filesystem access.

### What problem does NextCast solve?

**NextCast** enables NextJS specific meta-frameworks. JS frameworks often make use of a build tool like Webpack or a custom compiler like Svelte's to introduce application developers to new magical properties, such as new syntax or filesystem rules. To make these magical properites usable, frameworks package eslint plugins and rules so that errors are revealed before a build or compile step runs. **NextCast** is like a heavily watered-down and opinionated combination of webpack's loader system and eslint's custom rule api that only works for NextJS. I'm dog fooding **NextCast** by building our my custom framework on top of [NextJS's SSG feature](https://nextjs.org/docs/app/building-your-application/deploying/static-exports) and [Cloudflare Page Functions](https://developers.cloudflare.com/pages/platform/functions/get-started/). [Follow me on twitter](https://twitter.com/interbolt_colin) for an announcement of its launch.

### Reporting linter errors and warnings

During any phase, plugin authors can call a function to report errors or warnings as they detect them. These errors are automatically piped into ESLint when `eslint-plugin-nextcast` is installed and configured. _Note: for NPM >= 7 users, `eslint-plugin-nextcast` is automatically installed via `npm i -D nextcast`_.

### Why support only [NextJS](https://nextjs.org)?

I feel strongly that **NextCast** delivers the most value when its constrained to a single JS framework. Due to the high availability of compilers, bundlers, and transpilers in the ecosystem, JS frameworks are notorious for creating unique syntactic properties and/or architecture conventions, which means keeping up with version upgrades is no small task. I hope that focusing on a single framework inspires more confidence in downstream developers.

## Setup

Install NextCast and its ESLint plugin with npm

```bash
npm install nextcast eslint-plugin-nextcast
```

Configure the eslint plugin. Here's an example `.eslintrc.json` file:

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
const { withNextCast } = require("nextcast");

/** @type {import('next').NextConfig} */
const nextConfig = { ... };

module.exports = withNextCast(nextConfig);
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

## API reference for `withNextCast`

#### Usage

```javascript
// next.config.js

const { withNextCast } = require("nextcast");

/** @type {import('next').NextConfig} */
const nextConfig = { ... };

/** @type {import('nextcast').TNextCast.WithNextCastOptions} **/
const nextcastOptions = { ... };

module.exports = withNextCast(nextConfig, nextcastOptions);
```

#### API

```typescript
function(
  nextConfig: NextConfig,
  nextcastOptions: {
    plugins?:
      | ((
          userPlugins: Array<NextCastPlugin>
        ) => Array<string | NextCastPlugin>)
      | Array<string | NextCastPlugin>;
  }
): undefined
```

| Parameter                 | Type                                                                                       |
| :------------------------ | :----------------------------------------------------------------------------------------- |
| `nextConfig`              | `NextConfig`                                                                               |
| `nextcastOptions.plugins` | `Array<NextCastPlugin>` or `(userPlugins: Array<NextCastPlugin>) => Array<NextCastPlugin>` |

When plugins are provided as a string the resolution strategy goes as follows:

1. First, check in the node_modules folder for a matching package with a `dist` subdirectory. Eg: `special-plugin` will become `$repo/node_modules/special-plugin/dist`.
2. If not found, check relative to your project's root for a matching dir with a `dist` subdirectory. Eg: `special-plugin` will become `$repo/special-plugin/dist`.

If no plugin is found for a particular string, NextCast will throw before building. _Vendors are responsible for compiling their plugins to JS before publishing. NextCast will only compile TS for user plugins._

## API reference for plugins

_**Disclaimer**: I'll be adding more helper methods for traversing NextJS source files in the future. In the meantime, I expect most useful plugins will need to write lots of their own AST traversals._

A user plugin must implement the following interface:

```typescript
import type { TNextCast } from "nextcast";

// Implement the interface as a class if possible
interface NextCastPlugin {
  config: Record<string, any>;
  name: string;
  collector: TNextCast.Collector;
  builder: TNextCast.Builder;
  rewriter: TNextCast.Rewriter;
}
```

#### TNextCast.Collector

```typescript
function(ctx: TNextCast.PluginContext, api: TNextCast.PluginApi): undefined
```

A syncronous lifecycle method for plugin authors to collect information about source code. Runs in series with other plugins.

| Parameter | Type                      |
| :-------- | :------------------------ |
| `ctx`     | `TNextCast.PluginContext` |
| `api`     | `TNextCast.Api`           |

#### TNextCast.Builder

```typescript
function(ctx: TNextCast.PluginContext, api: TNextCast.PluginApi): Promise<undefined>;
```

An asyncronous lifecycle method for plugin authors to reduce collected information and build/generate artifacts. Runs in parallel to other plugins.

| Parameter | Type                      |
| :-------- | :------------------------ |
| `ctx`     | `TNextCast.PluginContext` |
| `api`     | `TNextCast.Api`           |

#### TNextCast.Rewriter

```typescript
function(ctx: TNextCast.PluginContext, api: TNextCast.PluginApi): Promise<undefined>;
```

An asyncronous lifecycle method for plugin authors to rewrite code. Runs in series with other plugins.

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

The data returned by the builder. By default, this data is attached to the root layout's opening html tag as a data-attribute.

## API reference for `TNextCast.PluginApi`

#### PluginApi.collect

```typescript
function(data: SerializableJSON): void;
```

Pushes data into an array of "colected" items. Use this function to store information relating to source code.

#### PluginApi.save

```typescript
function(data: SerializableJSON): void;
```

Overwrites the previously saved data while retaining a history of previous saves. Use this function to store a mapped/formatted data structure for rewriter phase.

#### PluginApi.queueTransform

```typescript
function(filePath: string, transform: (JscodeshiftCollect) => JscodeshiftCollection): void
```

Queue a file rewrite defined within a transform function. Queued rewrites for each plugin run in series, with later transforms taking the output of previous transforms as input.

TODO: add some debug utilities to allow applying transforms in arbitrary orders. I think we need some kind of diff/patch like lib so we can rewind/fastforward code.

#### PluginApi.reportError

```typescript
function(
  message: string,
  filePath: string,
  node: BabelNode | JSCodeshiftNode = null
): void
```

Usually, you'll want to call this while traversing or modifying a babel or jscodeshift AST. If you pass in a valid AST node as the third argument, ESLint will be able to point out the exact line/column number of the error.

#### PluginApi.reportWarning

```typescript
function(
  message: string,
  filePath: string,
  node: BabelNode | JSCodeshiftNode = null
): void
```

Works exactly the same as `PluginApi.reportError`, except you'll see warnings in ESLint, not errors.

#### PluginApi.traverse

```typescript
// See @babel/traverse docs for the TraverseOptions type

function(filePath: string, traversalOptions: TraverseOptions): BabelAST
```

Wraps `@babel/traverse` - https://babeljs.io/docs/babel-traverse

#### PluginApi.parse

```typescript
function(filePath: string): BabelAST;
```

Wraps `babel/parser` and returns a cached version of the AST if the `filePath` was already parsed.

#### PluginApi.getCollected

```typescript
function(): Array<SerializableJSON>;
```

You can call this at any point to get a list of all the data collected via `PluginApi.collect`.

#### PluginApi.getSaved

```typescript
function(): Array<SerializableJSON>;
```

You can call this to get the last saved data structure persisted by `PluginApi.save`.

#### PluginApi.getSavedHistory

```typescript
function(): Array<SerializableJSON>;
```

You can call this to get a list of every previous saved data structure persisted by `PluginApi.saved`. Returns array sorted newest to oldest.

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

function(): Array<Error>;
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

function(): Array<Warning>;
```

Returns a list of all the warnings reported up until this point.

## A note on the undocumented API at `PluginApi._.`

Any functions attached to `PluginApi._` should be consider experimental and used with caution. I am still researching useful helper methods and am using this namespace to experiment.
