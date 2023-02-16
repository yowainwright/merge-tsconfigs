import { CompilerOptions } from 'typescript';

export interface ConfigOptions {
  tsconfigs?: string[];
  // compilerOptions?: CompilerOptions; // TODO compilerOptions
  debug?: boolean;
}

export interface Options {
  tsconfigs?: string[];
  debug?: boolean;
  isTestingCLI?: boolean;
  isTesting?: boolean;
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
