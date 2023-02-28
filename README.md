# Merge-Tsconfigs

![Typed with TypeScript](https://flat.badgen.net/badge/icon/Typed?icon=typescript&label&labelColor=blue&color=555555)
[![npm version](https://badge.fury.io/js/merge-tsconfigs.svg)](https://badge.fury.io/js/merge-tsconfigs)
[![unpkg](https://img.shields.io/badge/unpkg-blue.svg)](https://unpkg.com/merge-tsconfigs@0.1.1/dist/index.js)
[![skypack](https://img.shields.io/badge/skypack-blueviolet.svg)](https://cdn.skypack.dev/merge-tsconfigs?min)
![ci](https://github.com/yowainwright/merge-tsconfigs/actions/workflows/ci.yml/badge.svg)
[![Github](https://badgen.net/badge/icon/github?icon=github&label&color=grey)](https://github.com/yowainwright/merge-tsconfigs)
![Twitter](https://img.shields.io/twitter/url?url=https%3A%2F%2Fgithub.com%2Fyowainwright%2Fmerge-tsconfigs)

_Merge-tsconfigs_ is a CLI and node tool for merging tsconfig files into the exact tsconfig file you want. 💪

---

**[Why do I want this?](#why-do-i-want-this)** | **[Example](#for-example)** | **[How do I use this?](#how-do-i-use-this)** | **[CLI API](#cli-api)** | **[Node API](#node-api)** | **[How do I start using this?](#how-do-i-start-using-this)**

---

## Why do I want this?

Tsconfig files are copied, pasted, or left as out-of-sync widows 😥 throughout projects. _Merge-tsconfigs_ provides a CLI and node functions to merge tsconfigs files and compilerOptions into _the single tsconfig file you want at a given time_.

For example, if you have a monorepo with multiple packages and you want to deploy one of them with a single tsconfig, you might need to copy a tsconfig from root, or write another static tsconfig just for deployment. Well, with _Merge-tsconfigs_ you can run the CLI to write a temporary tsconfig to be used for deployment.

By providing an easy way to create the tsconfig you want, your everyday tsconfig code remains the same, your dockerfiles require less context into other directories, and your deployment process is dynamically more exact.

---

### _For example_

By running `merge-tsconfigs ./tsconfig.build.json` you'll merge `tsconfig.json`
```ts
{
  "compilerOptions": {
    "allowJS": true
  }
}
```

and, `tsconfig.build.json`
```ts
{
  "compilerOptions": {
    "target": "esnext"
  },
  "extends": "./tsconfig.json"
}
```

into `tsconfig.merged.json`
```ts
{
  "compilerOptions": {
    "allowJS": true,
    "target": "esnext"
  }
}
```

Which you can now use for deployment, dockerfiles, or any other use case. And, you don't have to worry about copying, pasting, or keeping track of multiple tsconfigs! 🎉

---

## How do I use this?

Merge-tsconfigs is built to be uses as a CLI first and foremost. It also exports node functions which can be used to preform the same merge operation.

---
### CLI API

Listed below are the CLI options and arguments to execute merge-tsconfigs. To \*_view all_ cli options in your browser, run `merge-tsconfigs --help`!

```sh
Usage: merge-tsconfigs [options] [files...]

Merge-tsconfigs is a CLI and node tool for merging tsconfig files into the exact tsconfig file you want 🛣️

Arguments:
  files                       files to check, matches an array pattern

Options:
  -o, --out [out]             output file
  -i, --include [include...]  files to include, matches a glob or array pattern
  -e, --exclude [exclude...]  files to exclude, matches a glob or array pattern
  -p, --path <path>           a json parseable string wrapped object, e.g. {"item/*": ["foo": "bar"]}
  -h, --help                  display help for command
```

\*`compilerOptions` are not added above for readability (but they can be leveraged). To view all cli options, run `merge-tsconfigs --help`! `compilerOptions.paths` is a string wrapped object.

#### Recipes

Merge tsconfig files into a single tsconfig

```sh
merge-tsconfigs ./tsconfig.json ./tsconfig.build.json
# ./tsconfig.json + ./tsconfig.build.json => ./tsconfig.merged.json
```

Merge tsconfig files a specific tsconfig file

```sh
merge-tsconfigs ./tsconfig.json ./tsconfig.build.json --out ./tsconfig.out.json
# ./tsconfig.json + ./tsconfig.build.json => ./tsconfig.out.json
```

Merge tsconfig files with unique `include` and `exclude` strings

```sh
merge-tsconfigs ./tsconfig.json ./tsconfig.build.json --include 'src/**.ts' --exclude 'test/**.ts'
# ./tsconfig.json + ./tsconfig.build.json => ./tsconfig.merged.json
```

```ts
// tsconfig.merged.json
{
  "compilerOptions": {
    // ...options
  },
  "include": ["src/**.ts"],
  "exclude": ["test/**.ts", "config/*.ts"]
}
```

Merge tsconfig files with unique `include` and `exclude` or by using arrays

```sh
merge-tsconfigs ./tsconfig.json ./tsconfig.build.json --include 'src/**.ts' --exclude 'test/**.ts' 'config/*.ts'
# ./tsconfig.json + ./tsconfig.build.json => ./tsconfig.merged.json
```

```ts
// tsconfig.merged.json
{
  "compilerOptions": {
    // ...options
  },
  "include": ["src/**.ts"],
  "exclude": ["test/**.ts", "config/*.ts"]
}
```

Sprinkle in some `compilerOptions` to the mix

```sh
merge-tsconfigs ./tsconfig.json ./tsconfig.build.json --out ./tsconfig.out.json --allowJs true --noEmit true
# ./tsconfig.json + ./tsconfig.build.json => ./tsconfig.out.json
```

```ts
// tsconfig.out.json
{
  "compilerOptions": {
    "allowJS": true,
    "noEmit": true,
  }
}
```

Delete a compiler option

```sh
merge-tsconfigs ./tsconfig.json ./tsconfig.build.json --allowJS --noEmit 'delete'
# ./tsconfig.json + ./tsconfig.build.json => ./tsconfig.merged.json
```

```ts
// tsconfig.merged.json
{
  "compilerOptions": {
    "allowJS": true,
    // "noEmit": true, // deleted
  }
}
```

Add a path to `compilerOptions.paths`

```sh
merge-tsconfigs ./tsconfig.json ./tsconfig.build.json --path '{"item/*": ["foo": "bar"]}'
# ./tsconfig.json + ./tsconfig.build.json => ./tsconfig.merged.json
```

```ts
// tsconfig.merged.json
{
  "compilerOptions": {
    "paths": {
      "item/*": ["foo": "bar"]
    }
  }
}
```

---

### Node API

The node API works exactly the same as the CLI API.

```ts
import mergeTsconfigs from 'merge-tsconfigs';

mergeTsconfigs({
  files: ['./tsconfig.json', './tsconfig.build.json'],
  out: './tsconfig.out.json',
  include: ['src/**.ts'],
  exclude: ['test/**.ts'],
  compilerOptions: {
    allowJs: true,
    noEmit: true,
  },
});

```

You can use any compiler options provided by [Typescript](https://www.typescriptlang.org/docs/handbook/compiler-options.html). Object keys aren't currently implemented but can be upon feature request.

#### Recipes

Merge tsconfig files into a single tsconfig

```ts
const config = mergeTsconfigs({
  files: ['./tsconfig.json', './tsconfig.build.json'],
});
// ./tsconfig.json + ./tsconfig.build.json => ./tsconfig.merged.json
```

Merge tsconfig files into a custom output file

```ts
const config = mergeTsconfigs({
  files: ['./tsconfig.json', './tsconfig.build.json'],
  out: './new-dir/tsconfig.out.json',
});
// ./tsconfig.json + ./tsconfig.build.json => ./tsconfig.out.json
```

---

## How do I start using this?

Install merge-tsconfigs with your preferred package manager.

```sh
npm install merge-tsconfigs --save-dev
```

\*_Untested_: In, Deno, Snowpack, or other options, you can import merge-tsconfigs directly into your project.
```ts
import mergeTsconfigs from 'npm:merge-tsconfigs';
// or
import mergeTsconfigs from "https://cdn.skypack.dev/merge-tsconfigs@latest";
// or
import mergeTsconfigs from "https://unpkg.com/merge-tsconfigs@latest/dist/index.js";
```

---

Made by [@yowainwright](https://github.com/yowainwright), MIT 2023
