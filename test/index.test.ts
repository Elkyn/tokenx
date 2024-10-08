import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import {
  approximateMaxTokenSize,
  approximateTokenSize,
  chunkByMaxTokens,
  getModelContextSize,
  isWithinTokenLimit,
} from '../src/index'

const fixturesDir = fileURLToPath(new URL('fixtures', import.meta.url))

describe('token-related functions', () => {
  describe('chunkByMaxTokens', () => {
    it('should split into chunks based on the token size for short English text', () => {
      const input = 'Hello, world! This is a short sentence.'
      expect(chunkByMaxTokens(input, 5)).length(3)
    })
    it('should split into chunks based on the token size for short English text, taking into account overlap count', () => {
      const input = 'Hello, world! This is a short sentence.'
      const output = chunkByMaxTokens(input, 3, 1)

      expect(output).length(6)
      expect(output).toStrictEqual([
          "Hello, world",
           "Hello, world! This ",
           " This is a ",
           " a short ",
           " short sentence",
           " short sentence.",
      ])
    })

    it('should split into chunks based on the token size for short German text with umlauts', () => {
      const input = 'Die pünktlich gewünschte Trüffelfüllung im übergestülpten Würzkümmel-Würfel ist kümmerlich und dürfte fürderhin zu Rüffeln in Hülle und Fülle führen'
      expect(chunkByMaxTokens(input, 5)).length(12)
    })

    it('should split into chunks based on the token size for English ebook', async () => {
      const input = await readFile(join(fixturesDir, 'ebooks/pg5200.txt'), 'utf-8')
      expect(chunkByMaxTokens(input, 1000)).length(34)
    })

    it('should split into chunks based on the token size for German ebook', async () => {
      const input = await readFile(join(fixturesDir, 'ebooks/pg22367.txt'), 'utf-8')
      expect(chunkByMaxTokens(input, 1000)).length(35)
    })

    it('should split into chunks based on the token size for Chinese ebook', async () => {
      const input = await readFile(join(fixturesDir, 'ebooks/pg7337.txt'), 'utf-8')
      expect(chunkByMaxTokens(input, 1000)).length(12)
    })
    it('should split into chunks based on the token size for Chinese ebook, taking into account overlap count', async () => {
      const input = await readFile(join(fixturesDir, 'ebooks/pg7337.txt'), 'utf-8')
      expect(chunkByMaxTokens(input, 1000, 200)).length(15)
    })
  })
  describe('approximateTokenSize', () => {
    it('should approximate the token size for short English text', () => {
      const input = 'Hello, world! This is a short sentence.'
      expect(approximateTokenSize(input)).toMatchInlineSnapshot('11')
    })

    it('should approximate the token size for short German text with umlauts', () => {
      const input = 'Die pünktlich gewünschte Trüffelfüllung im übergestülpten Würzkümmel-Würfel ist kümmerlich und dürfte fürderhin zu Rüffeln in Hülle und Fülle führen'
      expect(approximateTokenSize(input)).toMatchInlineSnapshot('49')
    })

    it('should approximate the token size for English ebook', async () => {
      const input = await readFile(join(fixturesDir, 'ebooks/pg5200.txt'), 'utf-8')
      expect(approximateTokenSize(input)).toMatchInlineSnapshot(`33928`)
    })

    it('should approximate the token size for German ebook', async () => {
      const input = await readFile(join(fixturesDir, 'ebooks/pg22367.txt'), 'utf-8')
      expect(approximateTokenSize(input)).toMatchInlineSnapshot(`34908`)
    })

    it('should approximate the token size for Chinese ebook', async () => {
      const input = await readFile(join(fixturesDir, 'ebooks/pg7337.txt'), 'utf-8')
      expect(approximateTokenSize(input)).toMatchInlineSnapshot(`11919`)
    })
  })

  describe('getModelContextSize', () => {
    it('should return the correct context size for a given model', () => {
      const modelName = 'gpt-3.5-turbo'
      expect(getModelContextSize(modelName)).toMatchInlineSnapshot('4096')
    })
  })

  describe('approximateMaxTokenSize', () => {
    it('should calculate the maximum number of tokens correctly', () => {
      const prompt = 'This is a test prompt.'
      const modelName = 'gpt-3.5-turbo'
      const maxTokensInResponse = 100
      const tokenSize = approximateTokenSize(prompt)
      const maxTokens = getModelContextSize(modelName)
      const expectedMaxTokens = maxTokens - tokenSize - maxTokensInResponse
      expect(
        approximateMaxTokenSize({ prompt, modelName, maxTokensInResponse }),
      ).toBe(expectedMaxTokens)
    })
  })

  describe('isWithinTokenLimit', () => {
    it('should return true if the input is within the token limit', () => {
      const input = 'Short input.'
      const tokenLimit = 10
      expect(isWithinTokenLimit(input, tokenLimit)).toBe(true)
    })

    it('should return false if the input exceeds the token limit', () => {
      const input
        = 'This is a much longer input that should exceed the token limit set for this test case.'
      const tokenLimit = 10
      expect(isWithinTokenLimit(input, tokenLimit)).toBe(false)
    })
  })
})
