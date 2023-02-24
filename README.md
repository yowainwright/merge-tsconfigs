# Merge-Tsconfigs

![Typed with TypeScript](https://flat.badgen.net/badge/icon/Typed?icon=typescript&label&labelColor=blue&color=555555)
[![npm version](https://badge.fury.io/js/merge-tsconfigs.svg)](https://badge.fury.io/js/merge-tsconfigs)
![ci](https://github.com/yowainwright/merge-tsconfigs/actions/workflows/ci.yml/badge.svg)
[![Github](https://badgen.net/badge/icon/github?icon=github&label&color=grey)](https://github.com/yowainwright/merge-tsconfigs)
![Twitter](https://img.shields.io/twitter/url?url=https%3A%2F%2Fgithub.com%2Fyowainwright%2Fmerge-tsconfigs)

_Merge-tsconfigs_ is a CLI and node tool for merging tsconfig files into the exact tsconfig file you want. 💪

---

## Why do I want this?

Tsconfig files are copied, pasted, or left as out-of-sync widows 😥 throughout projects. _Merge-tsconfigs_ provides a CLI and node functions to merge tsconfigs files and compilerOptions into _the single tsconfig file you want at a given time_.

For example, if you have a monorepo with multiple packages and you want to deploy one of them with a single tsconfig, you might need to copy a tsconfig from root, or write another static tsconfig just for deployment. Well, with _Merge-tsconfigs_ you can run the CLI to write a temporary tsconfig to be used for deployment.

By providing an easy way to create the tsconfig you want, your everyday tsconfig code remains the same, your dockerfiles require less context into other directories, and your deployment process is dynamically more exact.

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
  -h, --help                  display help for command
```
\*compiler options are not added above for readability (but they can be leveraged). To view all cli options, run `merge-tsconfigs --help`!

#### Recipes

Merge tsconfig files into a single tsconfig

```sh
merge-tsconfigs ./tsconfig.json ./tsconfig.build.json
# => ./tsconfig.merged.json
```

Merge tsconfig files a specific tsconfig file

```sh
merge-tsconfigs ./tsconfig.json ./tsconfig.build.json --out ./tsconfig.out.json
# => ./tsconfig.out.json
```

Merge tsconfig files with unique `include` and `exclude` strings

```sh
merge-tsconfigs ./tsconfig.json ./tsconfig.build.json --include 'src/**.ts' --exclude 'test/**.ts'
# => ./tsconfig.merged.json
```

Merge tsconfig files with unique `include` and `exclude` or by using arrays

```sh
merge-tsconfigs ./tsconfig.json ./tsconfig.build.json --include 'src/**.ts' --exclude 'test/**.ts' 'config/*.ts'
# => ./tsconfig.merged.json
```

Sprinkle in some `compilerOptions` to the mix

```sh
merge-tsconfigs ./tsconfig.json ./tsconfig.build.json --out ./tsconfig.out.json --allowJs true --noEmit true
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
// => config = { ... }
```

Merge tsconfig files into a custom output file

```ts
const config = mergeTsconfigs({
  files: ['./tsconfig.json', './tsconfig.build.json'],
  out: './new-dir/tsconfig.out.json',
});
// => config = { ... }
```

---

## How do I start using this?

Install merge-tsconfigs with your preferred package manager.

```sh
npm install merge-tsconfigs --save-dev
```

\*unpkg and skypack support coming very soon! 🚀

---

Made by [@yowainwright](https://github.com/yowainwright), MIT 2023
