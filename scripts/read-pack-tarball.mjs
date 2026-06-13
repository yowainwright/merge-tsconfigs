#!/usr/bin/env node

import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

const escapeCharacter = String.fromCharCode(27)
const controlSequenceIntroducer = String.fromCharCode(155)
const ansiFinalCodeMinimum = 0x40
const ansiFinalCodeMaximum = 0x7e

const isAnsiFinalCharacter = (character) => {
  const code = character.charCodeAt(0)

  return code >= ansiFinalCodeMinimum && code <= ansiFinalCodeMaximum
}

export const stripAnsi = (value) => {
  const characters = Array.from(value)

  return characters.reduce(
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

export const findJsonStartIndexes = (text) =>
  Array.from(text)
    .map((character, index) => ({ character, index }))
    .filter(({ character }) => character === '[' || character === '{')
    .map(({ index }) => index)

export const findPackTarballInJson = (parsed) => {
  const packages = Array.isArray(parsed) ? parsed : [parsed]
  const packedPackage = packages.find((pkg) => pkg && typeof pkg === 'object' && typeof pkg.filename === 'string')

  return packedPackage?.filename
}

export const readPackTarballCandidate = (candidate) => {
  try {
    return findPackTarballInJson(JSON.parse(candidate))
  } catch {
    return undefined
  }
}

export const readPackTarball = (output) => {
  const text = stripAnsi(output)
  const tarball = findJsonStartIndexes(text)
    .toReversed()
    .map((start) => readPackTarballCandidate(text.slice(start).trim()))
    .find((candidate) => candidate)

  if (!tarball) {
    throw new Error('pack JSON output not found')
  }

  return tarball
}

export const readPackTarballFile = (filePath) => readPackTarball(fs.readFileSync(filePath, 'utf8'))

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const filePath = process.argv[2]

  if (!filePath) {
    throw new Error('usage: node scripts/read-pack-tarball.mjs <npm-pack-json-file>')
  }

  console.log(readPackTarballFile(filePath))
}
