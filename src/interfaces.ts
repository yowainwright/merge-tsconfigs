import { CompilerOptions } from 'typescript';
import { PartialDeep } from 'type-fest';

export type PartialCompilerOptions = PartialDeep<CompilerOptions>;

export interface ConfigOptions {
  compilerOptions?: PartialCompilerOptions;
  debug?: boolean;
  out?: string;
  tsconfigs?: string[];
  exclude?: string[];
  include?: string[];
  isTesting?: boolean;
}
export interface CompilerOption {
  name: string;
  value: string;
}
export interface Options {
  tsconfigs?: string[];
  debug?: boolean;
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
