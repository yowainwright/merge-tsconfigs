import { CompilerOptions } from 'typescript';
import { PartialDeep } from 'type-fest';

export interface CompilerOptionOverrides {
  [key: string]: string | boolean | string[] | undefined;
}

export type PartialCompilerOptions = PartialDeep<CompilerOptions | CompilerOptionOverrides>;

export interface ConfigOptions {
  compilerOptions?: PartialCompilerOptions;
  debug?: boolean;
  out?: string;
  tsconfigs?: string[];
  exclude?: string[];
  include?: string[];
  path?: string;
  isTesting?: boolean;
}
export interface CompilerOption {
  name: string;
  value: string;
}
export interface Options {
  out?: string;
  exclude?: string[];
  include?: string[];
  tsconfigs?: string[];
  path?: string;
  debug?: boolean;
  isTesting?: boolean;
  isTestingCLI?: boolean;
  [key: string]: string | boolean | string[] | undefined;
}

export type LoggerParams = {
  isDebugging?: boolean
  gap?: string
  emoji?: string
  name?: string
}

export interface TsConfig {
  extends?: string;
  compilerOptions?: PartialDeep<CompilerOptions>;
  include?: string[];
  exclude?: string[];
}
