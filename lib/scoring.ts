export interface HighlightSegment {
  text: string
  type: "normal" | "correct" | "added" | "missing" | "changed"
}

export interface ScoringResult {
  score: number
  highlights: HighlightSegment[]
}

/**
 * Tokenizes text into words and whitespace.
 */
function tokenize(text: string): string[] {
  // Matches words (including \\ markers and punctuation) or sequences of whitespace
  return text.match(/\S+|[^\S]+/g) || []
}

/**
 * Calculates accuracy score using word-level alignment.
 * Ignores whitespace and newlines for scoring, but preserves them for highlights.
 */
export function calculateScoring(input: string, output: string): ScoringResult {
  // Normalize hyphens to spaces for comparison as per requirements
  const normalizedInput = input.replace(/-/g, " ")
  const normalizedOutput = output.replace(/-/g, " ")

  const inTokens = tokenize(normalizedInput)
  const outTokens = tokenize(normalizedOutput)

  // Filter out whitespace for alignment logic but keep track of indices
  const inWords = inTokens.filter(t => /\S/.test(t))
  const outWords = outTokens.filter(t => /\S/.test(t))

  const highlights: HighlightSegment[] = []
  let matches = 0
  let totalOpportunities = 0

  // Basic word-level alignment (greedy)
  let inIdx = 0
  let outIdx = 0

  while (inIdx < inWords.length || outIdx < outWords.length) {
    const inWord = inWords[inIdx]
    const outWord = outWords[outIdx]

    if (!inWord && outWord) {
      // AI added extra words
      highlights.push({ text: outWord + " ", type: "added" })
      outIdx++
      continue
    }

    if (inWord && !outWord) {
      // AI missing words
      highlights.push({ text: inWord.replace(/\\/g, "") + " ", type: "missing" })
      inIdx++
      continue
    }

    // Check if inWord has a \\ or \ marker
    const hasDoubleSlash = inWord.endsWith("\\\\")
    const hasSingleSlash = !hasDoubleSlash && inWord.endsWith("\\")

    if (hasDoubleSlash || hasSingleSlash) {
      const sliceLen = hasDoubleSlash ? -2 : -1
      const baseInWord = inWord.slice(0, sliceLen).toLowerCase()
      const baseOutWord = outWord.replace(/[.,!?]$/, "").toLowerCase()
      const hasPunctuation = /[.,!?]$/.test(outWord)

      // It's a match if base words match (fuzzy 3-char) and punctuation is present
      const baseMatches = baseOutWord.startsWith(baseInWord.slice(0, 3)) || baseInWord.startsWith(baseOutWord.slice(0, 3))

      totalOpportunities++ // The backslash marker is an opportunity

      if (baseMatches && hasPunctuation) {
        highlights.push({ text: outWord + " ", type: "correct" })
        matches++
        inIdx++
        outIdx++
      } else if (baseMatches && !hasPunctuation) {
        // Base word correct but missing punctuation
        highlights.push({ text: outWord + " ", type: "changed" })
        inIdx++
        outIdx++
      } else {
        // Complete mismatch
        highlights.push({ text: outWord + " ", type: "changed" })
        inIdx++
        outIdx++
      }
    } else {
      // Regular word comparison
      const cleanIn = inWord.toLowerCase()
      const cleanOut = outWord.toLowerCase()

      totalOpportunities++ // Each word is an opportunity

      if (cleanIn === cleanOut) {
        highlights.push({ text: outWord + " ", type: "normal" })
        matches++
        inIdx++
        outIdx++
      } else {
        // Mismatch
        highlights.push({ text: outWord + " ", type: "changed" })
        inIdx++
        outIdx++
      }
    }
  }

  const score = totalOpportunities > 0 ? (matches / totalOpportunities) * 100 : 100

  // Post-process highlights to clean up trailing spaces and merge segments
  const mergedHighlights: HighlightSegment[] = []
  if (highlights.length > 0) {
    let current = { ...highlights[0] }
    for (let i = 1; i < highlights.length; i++) {
      if (highlights[i].type === current.type) {
        current.text += highlights[i].text
      } else {
        mergedHighlights.push(current)
        current = { ...highlights[i] }
      }
    }
    mergedHighlights.push(current)
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    highlights: mergedHighlights
  }
}
