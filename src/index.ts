import type { ModelName } from './types'

export * from './types'

const modelContextSizeMap = new Map<ModelName, number>([
  ['gpt-3.5-turbo-16k', 16384],
  ['gpt-3.5-turbo', 4096],
  ['gpt-4-1106-preview', 128000],
  ['gpt-4-32k', 32768],
  ['gpt-4', 8192],
  ['text-davinci-003', 4097],
  ['text-curie-001', 2048],
  ['text-babbage-001', 2048],
  ['text-ada-001', 2048],
  ['code-davinci-002', 8000],
  ['code-cushman-001', 2048],
])

/**
 * Resolve a model name to a canonical model name.
 */
export function resolveModelName(modelName: string): ModelName {
  if (modelName.startsWith('gpt-3.5-turbo-16k'))
    return 'gpt-3.5-turbo-16k'

  if (modelName.startsWith('gpt-3.5-turbo-'))
    return 'gpt-3.5-turbo'

  if (modelName.startsWith('gpt-4-32k'))
    return 'gpt-4-32k'

  if (modelName.startsWith('gpt-4-'))
    return 'gpt-4'

  return modelName as ModelName
}

/**
 * Returns the maximum number of tokens that can be generated by the model.
 */
export function getModelContextSize(modelName: string): number {
  const modelKey = resolveModelName(modelName)
  return modelContextSizeMap.get(modelKey) ?? 4097
}

export function getEmbeddingContextSize(modelName?: string): number {
  if (modelName === 'text-embedding-ada-002')
    return 8191

  return 2046
}

const WHITESPACE_RE = /^\s+$/
const CJK_RE = /[\u4E00-\u9FFF\u3400-\u4DBF\u3000-\u303F\uFF00-\uFFEF\u30A0-\u30FF\u2E80-\u2EFF\u31C0-\u31EF\u3200-\u32FF\u3300-\u33FF\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FF]/
const NUMERIC_SEQUENCE_RE = /[\d.,]+/
const PUNCTUATION_RE = /[.,!?;'"„“”‘’\-(){}[\]<>:/\\|@#$%^&*+=`~]/
// Pattern for spoken words, including accented characters
const ALPHANUMERIC_RE = /^[a-zA-Z0-9\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u00FF]+$/

const DEFAULT_AVERAGE_CHARS_PER_TOKEN = 6
// For languages similar to English, define a rough average
// number of characters per token
const LANGUAGE_METRICS = [
  { regex: /[äöüßẞ]/i, averageCharsPerToken: 3 },
]

interface TokenCount {
  token: string
  count: number
}
export function chunkByMaxTokens(input: string, maxTokens: number, overlap: number = 0): string[] {
  const counts = approximateTokenChunks(input)
  const chunks: TokenCount[][] = []

  let chunk: TokenCount[] = []
  let count = 0
  for (const token of counts) {
    if (count + token.count > maxTokens) {
      chunks.push(chunk)
      if (overlap > 0) {
        let i = chunk.length - 1
        count = 0

        while (i-- && count < overlap) {
          count += chunk[i].count
        }
        chunk = chunk.slice(i)
      }
      else {
        chunk = []
        count = 0
      }
    }

    chunk.push(token)
    count += token.count
  }
  if (chunk.length > 0) {
    chunks.push(chunk)
  }

  return chunks.map(chunk => chunk.map(({ token }) => token).join(''))
}

export function approximateTokenChunks(input: string): TokenCount[] {
  // Split by whitespace, punctuation, and other special characters
  const roughTokens = input
    .split(/(\s+|[.,!?;'"„“”‘’\-(){}[\]<>:/\\|@#$%^&*+=`~]+)/)
    .filter(Boolean)

  const tokenCounts: TokenCount[] = []

  for (const token of roughTokens) {
    let averageCharsPerToken: number | undefined
    for (const language of LANGUAGE_METRICS) {
      if (language.regex.test(token)) {
        averageCharsPerToken = language.averageCharsPerToken
        break
      }
    }

    let count = 0
    if (WHITESPACE_RE.test(token)) {
      // Don't count whitespace as a token
      count = 0
    }
    else if (CJK_RE.test(token)) {
      // For CJK languages, each character is usually a separate token
      count = Array.from(token).length
    }
    else if (NUMERIC_SEQUENCE_RE.test(token)) {
      // Numeric sequences are often a single token, regardless of length
      count = 1
    }
    else if (token.length <= 3) {
      // Short tokens are often a single token
      count = 1
    }
    else if (PUNCTUATION_RE.test(token)) {
      // Punctuation is often a single token, but multiple punctuations are often split
      count = token.length > 1 ? Math.ceil(token.length / 2) : 1
    }
    else if (ALPHANUMERIC_RE.test(token) || averageCharsPerToken) {
      // Use language-specific average characters per token or default to average
      count = Math.ceil(token.length / (averageCharsPerToken ?? DEFAULT_AVERAGE_CHARS_PER_TOKEN))
    }
    else {
      // For other characters (like emojis or special characters), or languages
      // like Arabic, Hebrew and Greek, count each as a token
      count = Array.from(token).length
    }

    tokenCounts.push({ token, count })
  }

  return tokenCounts
}

/**
 * Estimate the number of tokens in a string.
 */
export function approximateTokenSize(input: string) {
  return approximateTokenChunks(input).reduce((acc, { count }) => acc + count, 0)
}

/**
 * Returns the maximum number of tokens that can be generated by the model.
 */
export function approximateMaxTokenSize({
  prompt,
  modelName,
  maxTokensInResponse = 0,
}: {
  prompt: string
  modelName: ModelName
  /** The maximum number of tokens to generate in the reply. 1000 tokens are roughly 750 English words. */
  maxTokensInResponse?: number
}) {
  // Ensure that the sum of the prompt tokens and the response tokens
  // doesn't exceed the model's limit
  const remainingTokens = getModelContextSize(modelName)
    // Not using GPT tokenizer here because it will explode the bundle size
    - approximateTokenSize(prompt)
    - maxTokensInResponse

  return Math.max(0, remainingTokens)
}

/**
 * Ensures that the input string is within the token limit.
 */
export function isWithinTokenLimit(input: string, tokenLimit: number) {
  return approximateTokenSize(input) <= tokenLimit
}
