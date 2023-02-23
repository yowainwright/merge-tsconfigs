import { CompilerOptions } from 'typescript';
import { O } from 'ts-toolbelt';

export interface ConfigOptions {
  tsconfigs?: string[];
  compilerOptions?: O.Partial<CompilerOptions>;
  debug?: boolean;
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
