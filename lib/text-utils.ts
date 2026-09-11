/**
 * Text utility functions for the Text Processing Engine
 */

/**
 * Protects acronyms (2 or more consecutive uppercase letters) by replacing them with placeholders.
 */
export function protectAcronyms(text: string): { protectedText: string; acronyms: string[] } {
  const acronymRegex = /\b[A-Z]{2,}\b/g
  const acronyms: string[] = []
  const protectedText = text.replace(acronymRegex, (match) => {
    acronyms.push(match)
    return `__ACRONYM_${acronyms.length - 1}__`
  })
  return { protectedText, acronyms }
}

/**
 * Restores acronyms from placeholders.
 */
export function restoreAcronyms(text: string, acronyms: string[]): string {
  return text.replace(/__ACRONYM_(\d+)__/g, (_, i) => acronyms[parseInt(i)] || "")
}

/**
 * Applies a formatting function to text while protecting acronyms.
 */
export function applyFormatWithProtection(
  text: string,
  formatFn: (t: string) => string
): string {
  const { protectedText, acronyms } = protectAcronyms(text)
  const formattedText = formatFn(protectedText)
  return restoreAcronyms(formattedText, acronyms)
}

/**
 * Converts a number to Indonesian words.
 */
export function numberToIndonesianWords(num: number | string): string {
  const n = typeof num === "string" ? parseInt(num) : num
  if (isNaN(n)) return ""
  if (n === 0) return "nol"

  const units = [
    "", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan",
    "sepuluh", "sebelas", "dua belas", "tiga belas", "empat belas", "lima belas",
    "enam belas", "tujuh belas", "delapan belas", "sembilan belas"
  ]

  function convert(val: number): string {
    if (val < 20) return units[val]
    if (val < 100) return units[Math.floor(val / 10)] + " puluh " + convert(val % 10)
    if (val < 200) return "seratus " + convert(val - 100)
    if (val < 1000) return units[Math.floor(val / 100)] + " ratus " + convert(val % 100)
    if (val < 2000) return "seribu " + convert(val - 1000)
    if (val < 1000000) return convert(Math.floor(val / 1000)) + " ribu " + convert(val % 1000)
    if (val < 1000000000) return convert(Math.floor(val / 1000000)) + " juta " + convert(val % 1000000)
    return val.toString()
  }

  return convert(n).replace(/\s+/g, " ").trim()
}

/**
 * Converts Indonesian words to a number.
 */
export function wordsToNumber(text: string): number | null {
  const cleanText = text.toLowerCase().trim()
  if (!cleanText) return null

  const units: Record<string, number> = {
    "nol": 0, "satu": 1, "dua": 2, "tiga": 3, "empat": 4, "lima": 5, "enam": 6, "tujuh": 7, "delapan": 8, "sembilan": 9,
    "sepuluh": 10, "sebelas": 11, "dua belas": 12, "tiga belas": 13, "empat belas": 14, "lima belas": 15,
    "enam belas": 16, "tujuh belas": 17, "delapan belas": 18, "sembilan belas": 19,
    "seratus": 100, "seribu": 1000
  }

  if (units[cleanText] !== undefined) return units[cleanText]

  const words = cleanText.split(/\s+/)

  // Handle "puluh" (20-99)
  if (words.includes("puluh")) {
    const index = words.indexOf("puluh")
    let result = 0
    if (index > 0) {
      const prefix = units[words[index - 1]]
      if (prefix !== undefined && prefix < 10) {
        result = prefix * 10
      }
    }
    if (index < words.length - 1) {
      const suffix = units[words[index + 1]]
      if (suffix !== undefined && suffix < 10) {
        result += suffix
      }
    }
    if (result > 0) return result
  }

  return null
}

/**
 * Applies sentence case with acronym protection.
 */
export function applySentenceCase(text: string): string {
  // Step 1: protect acronyms
  const acronyms: string[] = []
  let protectedText = text.replace(/\b[A-Z]{2,}\b/g, match => {
    acronyms.push(match)
    return `__ACR${acronyms.length - 1}__`
  })

  // Step 2: lowercase everything
  protectedText = protectedText.toLowerCase()

  // Step 3: capitalize after sentence-ending punctuation
  protectedText = protectedText.replace(
    /(^|[.!?]\s+|[\r\n]+\s*)([a-z])/g,
    (_, prefix, char) => prefix + char.toUpperCase()
  )

  // Step 4: restore acronyms (case-insensitive because of step 2)
  protectedText = protectedText.replace(/__acr(\d+)__/g, (_, i) => acronyms[parseInt(i)])

  return protectedText
}

/**
 * Smart Replace: Format-Preserving logic.
 */
export function formatPreservingReplace(original: string, replacement: string): string {
  // Extract leading/trailing punctuation
  const punctMatch = original.match(/^([^a-zA-Z]*)([a-zA-Z\s]+)([^a-zA-Z]*)$/)
  if (!punctMatch) return replacement // Fallback if no letters found (e.g. just punctuation)

  const [, leadingPunct, word, trailingPunct] = punctMatch
  let formattedReplacement = replacement

  // Detect pattern of the word part
  if (word === word.toUpperCase()) {
    formattedReplacement = replacement.toUpperCase()
  } else if (word[0] === word[0].toUpperCase()) {
    formattedReplacement = replacement[0].toUpperCase() + replacement.slice(1).toLowerCase()
  } else {
    formattedReplacement = replacement.toLowerCase()
  }

  return leadingPunct + formattedReplacement + trailingPunct
}

/**
 * Detection logic for repeated words with affix support.
 */
export function getRepeatedWordsIndices(text: string) {
  // Tokenize by whitespace but keep whitespace to reconstruct indices
  const tokens = text.split(/(\s+)/)
  const indices: number[] = []

  // Step 2: check adjacent identical tokens
  for (let i = 0; i < tokens.length - 2; i += 2) {
    const currentWord = tokens[i]
    const nextWord = tokens[i + 2]

    if (currentWord && nextWord && currentWord === nextWord && !/[.,!?\\-]/.test(currentWord) && currentWord.trim().length > 0) {
      indices.push(i, i + 2)
    }
  }

  // Step 3: affix patterns using regex for visual highlights
  // We'll return the tokens and indices for highlighting
  return { tokens, indices }
}
