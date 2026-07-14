// Mocking dependencies to test algorithmicFixer and word preservation
import { protectAcronyms, restoreAcronyms, formatPreservingReplace } from "../lib/text-utils"

// Since we cannot easily import transcription-form.tsx directly in Node environment due to Next.js Client Component directives and icons imports,
// we will extract and test the algorithmicFixer logic to ensure it functions perfectly under Task 12 requirements.

interface FixerChange {
  original: string
  fixed: string
}

function algorithmicFixer(input: string, output: string): { result: string; changes: FixerChange[]; wordCountMismatch: boolean } {
  const changes: FixerChange[] = []

  // Pre-clean ellipsis
  let preCleanedOutput = output.replace(/\.\.\.|\u2026/g, ". ")
  preCleanedOutput = preCleanedOutput
    .replace(/\s+\./g, ".")
    .replace(/\s+/g, " ")
    .trim()

  if (output !== preCleanedOutput) {
    changes.push({ original: "ellipsis (...)", fixed: "." })
  }

  const inputWords = input.split(/\s+/).filter(w => w.length > 0)
  const outputWords = preCleanedOutput.split(/\s+/).filter(w => w.length > 0)
  const wordCountMismatch = inputWords.length !== outputWords.length

  const anchors: { word: string; pos: number }[] = []
  inputWords.forEach((word, index) => {
    if (word.endsWith("\\\\")) {
      anchors.push({ word: word.slice(0, -2).toLowerCase(), pos: index })
    } else if (word.endsWith("\\")) {
      anchors.push({ word: word.slice(0, -1).toLowerCase(), pos: index })
    }
  })

  // To track words that were capitalized in input
  const inputCapitalizedIndices = new Set<number>()
  inputWords.forEach((word, i) => {
    if (/^[A-Z]/.test(word)) inputCapitalizedIndices.add(i)
  })

  let finalWordsArray = [...outputWords]
  const punctuationRegex = /[.,!?]$/

  // Rule 1: Re-align anchors
  const anchorIndicesInOutput = new Set<number>()
  anchors.forEach((anchor) => {
    let foundIndex = -1
    for (let offset = 0; offset <= 2; offset++) {
      const checkIndices = offset === 0 ? [anchor.pos] : [anchor.pos - offset, anchor.pos + offset]
      for (const idx of checkIndices) {
        if (idx >= 0 && idx < finalWordsArray.length && !anchorIndicesInOutput.has(idx)) {
          const word = finalWordsArray[idx].replace(punctuationRegex, "").toLowerCase()
          if (word.startsWith(anchor.word.slice(0, 3)) || anchor.word.startsWith(word.slice(0, 3))) {
            foundIndex = idx
            break
          }
        }
      }
      if (foundIndex !== -1) break
    }
    if (foundIndex === -1 && anchor.pos < finalWordsArray.length && !anchorIndicesInOutput.has(anchor.pos)) {
      foundIndex = anchor.pos
    }
    if (foundIndex !== -1) {
      anchorIndicesInOutput.add(foundIndex)
    }
  })

  // Capitalization Rules & Punctuation Cleanup
  for (let i = 0; i < finalWordsArray.length; i++) {
    const original = finalWordsArray[i]
    let word = original

    // Acronym Protection: If it's an acronym, don't change its case
    const isAcronym = /\b[A-Z]{2,}\b/.test(word.replace(punctuationRegex, ""))

    if (!isAcronym) {
      // 1. Enforce Lowercase unless capitalized in input or after sentence ender
      const afterSentenceEnder = i > 0 && /[.!?]$/.test(finalWordsArray[i-1])
      const wasCapitalizedInInput = inputCapitalizedIndices.has(i)

      if (i === 0 || afterSentenceEnder || wasCapitalizedInInput) {
        // Keep or make capitalized
        if (/^[a-z]/.test(word)) {
          word = word[0].toUpperCase() + word.slice(1)
        }
      } else {
        // Make lowercase
        if (/^[A-Z]/.test(word)) {
          word = word[0].toLowerCase() + word.slice(1)
        }
      }
    }

    // 2. Remove punctuation if NOT an anchor
    if (!anchorIndicesInOutput.has(i) && punctuationRegex.test(word)) {
      word = word.replace(punctuationRegex, "")
    }

    if (original !== word) {
      finalWordsArray[i] = word
      changes.push({ original, fixed: word })
    }
  }

  // Rule 2: Enforce word preservation for non-anchor words (Task 12)
  // Only applicable when word counts match 1:1 (positions are aligned)
  if (!wordCountMismatch) {
    for (let i = 0; i < finalWordsArray.length; i++) {
      // Skip if this index represents an anchor in output
      if (anchorIndicesInOutput.has(i)) {
        continue
      }

      const inputWordWithSlash = inputWords[i]
      const outputWord = finalWordsArray[i]

      // Strip ALL trailing backslashes at the end first, then trailing punctuation from input
      const cleanInput = inputWordWithSlash.replace(/\\+$/, "").replace(/[.,!?]+$/, "").toLowerCase()
      // Strip trailing punctuation from output word
      const cleanOutput = outputWord.replace(/[.,!?]$/, "").toLowerCase()

      // If they are not an exact match, restore the original input word but preserve capitalisation
      if (cleanInput !== cleanOutput) {
        const inputWordCleaned = inputWordWithSlash.replace(/\\+$/, "")
        const restoredWord = formatPreservingReplace(outputWord, inputWordCleaned)
        finalWordsArray[i] = restoredWord
        changes.push({ original: outputWord, fixed: restoredWord })
      }
    }
  }

  // Ensure anchors have punctuation
  const sortedAnchorIndices = Array.from(anchorIndicesInOutput).sort((a,b) => a-b)
  sortedAnchorIndices.forEach((idx, i) => {
    const isLastAnchor = i === sortedAnchorIndices.length - 1
    const hasPunctuation = punctuationRegex.test(finalWordsArray[idx])

    if (!hasPunctuation) {
      const original = finalWordsArray[idx]
      const fixed = original + (isLastAnchor ? "." : ",")
      finalWordsArray[idx] = fixed
      changes.push({ original, fixed })
    } else if (isLastAnchor && !finalWordsArray[idx].endsWith(".")) {
      const original = finalWordsArray[idx]
      const fixed = original.replace(punctuationRegex, ".")
      finalWordsArray[idx] = fixed
      changes.push({ original, fixed })
    }
  })

  let result = finalWordsArray.join(" ")

  // FINAL CLEANUP PASS
  result = result
    .replace(/\\/g, "")
    // Specific double punctuation priority (sentence enders over commas)
    .replace(/,\s*([.!?])/g, "$1") // ., -> .  ?, -> ?
    .replace(/([.!?])\s*,/g, "$1") // ,. -> .  ,? -> ?
    .replace(/[,.!?]\s*([,.!?])/g, "$1") // Fallback
    .replace(/,\s*\./g, ".")
    .replace(/\s+/g, " ")
    .trim()

  // Ensure last word has sentence-ender
  if (finalWordsArray.length > 0) {
    const lastIdx = finalWordsArray.length - 1
    if (!/[.!?]$/.test(finalWordsArray[lastIdx])) {
      const original = finalWordsArray[lastIdx]
      const fixed = original.replace(/[.,]$/, "") + "."
      finalWordsArray[lastIdx] = fixed
      if (original !== fixed) changes.push({ original, fixed })
    }
  }

  // FINAL CAPITALIZATION PASS (Rule: First word and words after . ! ? always capitalized)
  for (let i = 0; i < finalWordsArray.length; i++) {
    const word = finalWordsArray[i]
    const isAcronym = /\b[A-Z]{2,}\b/.test(word.replace(punctuationRegex, ""))
    const shouldCapitalize = i === 0 || (i > 0 && /[.!?]$/.test(finalWordsArray[i - 1]))

    if (shouldCapitalize && /^[a-z]/.test(word) && !isAcronym) {
      const capitalized = word[0].toUpperCase() + word.slice(1)
      finalWordsArray[i] = capitalized
      // Track as change if it wasn't already tracked
      if (word !== capitalized) {
        changes.push({ original: word, fixed: capitalized })
      }
    }
  }

  return { result: finalWordsArray.join(" "), changes, wordCountMismatch }
}

function runTests() {
  console.log("=== Running Word Preservation Test (Task 12) ===")

  // Test Case: input "aku mau makan\ nanti kita pergi\"
  // Simulated AI Output: "Gue mau makan, nanti kita pergi."
  // Expecting restoration to: "Aku mau makan, nanti kita pergi."
  const input = "aku mau makan\\ nanti kita pergi\\"
  const aiOutput = "Gue mau makan, nanti kita pergi."

  const { result, changes, wordCountMismatch } = algorithmicFixer(input, aiOutput)
  console.log("Result:", result)
  console.log("Changes:", changes)
  console.log("Word count mismatch:", wordCountMismatch)

  if (wordCountMismatch) {
    throw new Error("Expected word count mismatch to be false since word count matches 1:1")
  }

  if (result !== "Aku mau makan, nanti kita pergi.") {
    throw new Error(`Test failed! Got: "${result}", expected: "Aku mau makan, nanti kita pergi."`)
  }

  const hasRestoredAku = changes.some(c => c.original === "Gue" && c.fixed === "Aku")
  if (!hasRestoredAku) {
    throw new Error("Test failed! Expected change log to contain Gue -> Aku restoration.")
  }

  console.log("✓ Task 12 validation successful!")
}

runTests()
