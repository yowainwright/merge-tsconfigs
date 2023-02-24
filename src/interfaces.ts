import { CompilerOptions } from 'typescript';
import { PartialDeep } from 'type-fest';

export interface ConfigOptions {
  compilerOptions?: PartialDeep<CompilerOptions>;
  debug?: boolean;
  out?: string;
  tsconfigs?: string[];
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
  compilerOptions?: CompilerOptions;
  include?: string[];
  exclude?: string[];
}
