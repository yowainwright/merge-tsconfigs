# Merge-Tsconfigs

_Merge-tsconfigs_ is an efficiency CLI and node tool for merging tsconfig files.
It additionally supports overriding merged tsconfigs with `tsconfig.compilerOptions`.

---

## Why do I want this?

There are many scenarios where tsconfig files are copied, pasted, or left as out-of-sync widows throughout projects. _Merge-tsconfigs_ provides a utility CLI and node functions to merge tsconfigs files so projects don't have to have needless create and copy tsconfig assets.

For example, if you have a monorepo with multiple packages and you want to deploy one of them with a single tsconfig, you might need to copy a tsconfig from root, or write another static tsconfig just for deployment. Well, with _Merge-tsconfigs_ you can run the CLI to write a temporary tsconfig to be used only while building your packages docker image.
## How do I use this?


## CLI API

```sh
Usage: merge-tsconfigs [options] [files...]

Codependency, for code dependency. Checks `coDependencies` in package.json files to ensure dependencies are up-to-date

Arguments:
  files                       files to check

Options:
  -t, --isTestingCLI          enable CLI only testing
  --isTesting                 enable running fn tests w/o overwriting
  -i, --include [include...]  files to include
  -e, --exclude [exclude...]  files to exclude
  -h, --help                  display help for command
```

## Development
