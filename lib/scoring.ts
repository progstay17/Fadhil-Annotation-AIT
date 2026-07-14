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
  return text.match(/\S+|[^\S]+/g) || []
}

/**
 * Helper to determine if two words are similar based on the specification.
 */
function isSimilar(wA: string, wB: string): boolean {
  const isAnchor = wA.endsWith("\\") || wA.endsWith("\\\\")

  let cleanA = ""
  if (isAnchor) {
    // Strip ALL trailing backslashes at the end
    cleanA = wA.replace(/\\+$/, "").replace(/[.,!?]+$/, "").toLowerCase()
  } else {
    // Strip trailing punctuation from input
    cleanA = wA.replace(/[.,!?]+$/, "").toLowerCase()
  }

  // Strip trailing punctuation from output
  const cleanB = wB.replace(/[.,!?]+$/, "").toLowerCase()

  // Exact comparison
  return cleanA === cleanB
}

/**
 * Calculates accuracy score using word-level LCS alignment.
 */
export function calculateScoring(input: string, output: string): ScoringResult {
  // Normalize hyphens to spaces for comparison as per requirements
  const normalizedInput = input.replace(/-/g, " ")
  const normalizedOutput = output.replace(/-/g, " ")

  const inTokens = tokenize(normalizedInput)
  const outTokens = tokenize(normalizedOutput)

  // Filter out whitespace for alignment logic
  const inWords = inTokens.filter(t => /\S/.test(t))
  const outWords = outTokens.filter(t => /\S/.test(t))

  if (inWords.length === 0) {
    const highlights: HighlightSegment[] = outWords.map(w => ({
      text: w + " ",
      type: "added" as const
    }))
    return {
      score: 100,
      highlights
    }
  }

  if (outWords.length === 0) {
    const highlights: HighlightSegment[] = inWords.map(w => ({
      text: w.replace(/\\/g, "") + " ",
      type: "missing" as const
    }))
    return {
      score: 0,
      highlights
    }
  }

  const n = inWords.length
  const m = outWords.length

  // Needleman-Wunsch sequence alignment parameters
  const MATCH_SCORE = 2
  const MISMATCH_SCORE = -1
  const GAP_SCORE = -2

  const scoreTable: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0))

  for (let i = 1; i <= n; i++) {
    scoreTable[i][0] = scoreTable[i - 1][0] + GAP_SCORE
  }
  for (let j = 1; j <= m; j++) {
    scoreTable[0][j] = scoreTable[0][j - 1] + GAP_SCORE
  }

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const isMatched = isSimilar(inWords[i - 1], outWords[j - 1])
      const diagonalScore = scoreTable[i - 1][j - 1] + (isMatched ? MATCH_SCORE : MISMATCH_SCORE)
      const upScore = scoreTable[i - 1][j] + GAP_SCORE
      const leftScore = scoreTable[i][j - 1] + GAP_SCORE
      scoreTable[i][j] = Math.max(diagonalScore, upScore, leftScore)
    }
  }

  // Backtracking
  let i = n
  let j = m
  interface AlignmentOp {
    type: "match" | "substitute" | "delete" | "insert"
    inWord?: string
    outWord?: string
  }
  const ops: AlignmentOp[] = []

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const isMatched = isSimilar(inWords[i - 1], outWords[j - 1])
      const currentScore = scoreTable[i][j]
      const diagScore = scoreTable[i - 1][j - 1] + (isMatched ? MATCH_SCORE : MISMATCH_SCORE)
      const upScore = scoreTable[i - 1][j] + GAP_SCORE

      if (currentScore === diagScore) {
        ops.push({
          type: isMatched ? "match" : "substitute",
          inWord: inWords[i - 1],
          outWord: outWords[j - 1]
        })
        i--
        j--
      } else if (currentScore === upScore) {
        ops.push({
          type: "delete",
          inWord: inWords[i - 1]
        })
        i--
      } else {
        ops.push({
          type: "insert",
          outWord: outWords[j - 1]
        })
        j--
      }
    } else if (i > 0) {
      ops.push({
        type: "delete",
        inWord: inWords[i - 1]
      })
      i--
    } else {
      ops.push({
        type: "insert",
        outWord: outWords[j - 1]
      })
      j--
    }
  }
  ops.reverse()

  const highlights: HighlightSegment[] = []
  let matches = 0

  ops.forEach((op) => {
    if (op.type === "match" && op.inWord && op.outWord) {
      const isAnchor = op.inWord.endsWith("\\") || op.inWord.endsWith("\\\\")
      if (isAnchor) {
        // Must have punctuation in the output word to be "correct"
        const hasPunctuation = /[.,!?]$/.test(op.outWord)
        if (hasPunctuation) {
          highlights.push({ text: op.outWord + " ", type: "correct" })
          matches++
        } else {
          highlights.push({ text: op.outWord + " ", type: "changed" })
        }
      } else {
        highlights.push({ text: op.outWord + " ", type: "normal" })
        matches++
      }
    } else if (op.type === "substitute" && op.outWord) {
      highlights.push({ text: op.outWord + " ", type: "changed" })
    } else if (op.type === "delete" && op.inWord) {
      highlights.push({ text: op.inWord.replace(/\\/g, "") + " ", type: "missing" })
    } else if (op.type === "insert" && op.outWord) {
      highlights.push({ text: op.outWord + " ", type: "added" })
    }
  })

  const totalOpportunities = inWords.length
  const score = totalOpportunities > 0 ? (matches / totalOpportunities) * 100 : 100

  // Post-process highlights to clean up trailing spaces and merge segments
  const mergedHighlights: HighlightSegment[] = []
  if (highlights.length > 0) {
    let current = { ...highlights[0] }
    for (let idx = 1; idx < highlights.length; idx++) {
      if (highlights[idx].type === current.type) {
        current.text += highlights[idx].text
      } else {
        mergedHighlights.push(current)
        current = { ...highlights[idx] }
      }
    }
    mergedHighlights.push(current)
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    highlights: mergedHighlights
  }
}
