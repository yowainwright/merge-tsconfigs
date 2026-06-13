#!/usr/bin/env tsx

import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

type StripAnsiState = {
  inAnsiSequence: boolean
  output: string
  skipCharacter: boolean
}

type PackedPackage = {
  filename: string
}

const escapeCharacter = String.fromCharCode(27)
const controlSequenceIntroducer = String.fromCharCode(155)
const ansiFinalCodeMinimum = 0x40
const ansiFinalCodeMaximum = 0x7e

const isAnsiFinalCharacter = (character: string): boolean => {
  const code = character.charCodeAt(0)

  return code >= ansiFinalCodeMinimum && code <= ansiFinalCodeMaximum
}

const isPackedPackage = (value: unknown): value is PackedPackage =>
  typeof value === 'object' && value !== null && 'filename' in value && typeof value.filename === 'string'

export const stripAnsi = (value: string): string => {
  const characters = Array.from(value)

  return characters.reduce<StripAnsiState>(
    (state, character, index) => {
      if (state.skipCharacter) {
        return { ...state, skipCharacter: false }
      }

      if (state.inAnsiSequence) {
        return { ...state, inAnsiSequence: !isAnsiFinalCharacter(character) }
      }

      if (character === escapeCharacter && characters[index + 1] === '[') {
        return { ...state, inAnsiSequence: true, skipCharacter: true }
      }

      if (character === controlSequenceIntroducer) {
        return { ...state, inAnsiSequence: true }
      }

      return { ...state, output: `${state.output}${character}` }
    },
    { inAnsiSequence: false, output: '', skipCharacter: false },
  ).output
}

export const findJsonStartIndexes = (text: string): number[] =>
  Array.from(text)
    .map((character, index) => ({ character, index }))
    .filter(({ character }) => character === '[' || character === '{')
    .map(({ index }) => index)

export const findPackTarballInJson = (parsed: unknown): string | undefined => {
  const packages = Array.isArray(parsed) ? parsed : [parsed]

  return packages.find(isPackedPackage)?.filename
}

export const readPackTarballCandidate = (candidate: string): string | undefined => {
  try {
    return findPackTarballInJson(JSON.parse(candidate))
  } catch {
    return undefined
  }
}

export const readPackTarball = (output: string): string => {
  const text = stripAnsi(output)
  const tarball = findJsonStartIndexes(text).reduceRight<string | undefined>(
    (found, start) => found ?? readPackTarballCandidate(text.slice(start).trim()),
    undefined,
  )

  if (!tarball) {
    throw new Error('pack JSON output not found')
  }

  return tarball
}

export const readPackTarballFile = (filePath: string): string => readPackTarball(fs.readFileSync(filePath, 'utf8'))

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const filePath = process.argv[2]

  if (!filePath) {
    throw new Error('usage: node --import tsx scripts/read-pack-tarball.ts <npm-pack-json-file>')
  }

  console.log(readPackTarballFile(filePath))
}
