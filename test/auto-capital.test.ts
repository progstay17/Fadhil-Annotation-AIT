import {
  applyFormatWithProtection,
  applySentenceCase,
  formatPreservingReplace
} from "../lib/text-utils"
import { protectKnownEntities, restoreKnownEntities, KnownEntity } from "../lib/known-entities"

// Helper asserting condition
function assertEqual(actual: string, expected: string, testName: string) {
  if (actual !== expected) {
    throw new Error(`[FAIL] ${testName}:\n  Expected: ${JSON.stringify(expected)}\n  Got:      ${JSON.stringify(actual)}`)
  }
  console.log(`✓ [PASS] ${testName}`)
}

interface RunEngineOptions {
  findValue?: string
  replaceValue?: string
  smartReplaceMode?: "format-preserving" | "strict"
  stripEnabled?: boolean
  removeLineBreak?: boolean
  formatMode?: "none" | "sentence" | "lower" | "upper" | "capitalize" | "toggle"
  autoCapital?: boolean
  autoSentence?: boolean
  autoLowercase?: boolean
  autoFixSpace?: boolean
}

// Helper to simulate known entities without window/localStorage
function protectKnownEntitiesMock(text: string, mockEntities: KnownEntity[]): { protectedText: string; entities: string[] } {
  if (mockEntities.length === 0) return { protectedText: text, entities: [] }

  const sorted = [...mockEntities].sort((a, b) => b.key.length - a.key.length)
  const restoreList: string[] = []
  let protectedText = text

  sorted.forEach(({ key, canonical }) => {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`\\b${escapedKey}\\b`, "gi")
    protectedText = protectedText.replace(regex, () => {
      restoreList.push(canonical)
      return `zzentityz${restoreList.length - 1}zz`
    })
  })

  return { protectedText, entities: restoreList }
}

// Simulated runEngine matching components/filter-custom.tsx
function runEngine(text: string, options: RunEngineOptions = {}, mockEntities: KnownEntity[] = []): string {
  const {
    findValue = "",
    replaceValue = "",
    smartReplaceMode = "format-preserving",
    stripEnabled = false,
    removeLineBreak = false,
    formatMode = "none",
    autoCapital = false,
    autoSentence = false,
    autoLowercase = false,
    autoFixSpace = false,
  } = options

  let result = text

  // 1. Find & Replace
  if (findValue.trim()) {
    const targets = findValue.split(/\s+/).filter(t => t.length > 0)
    targets.forEach(target => {
      if (smartReplaceMode === "format-preserving") {
        const escapedTarget = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const regex = new RegExp(`(\\b|\\s|^)(${escapedTarget})(\\b|\\s|$)`, 'g')
        result = result.replace(regex, (match, p1, p2, p3) => {
          return p1 + formatPreservingReplace(p2, replaceValue) + p3
        })
      } else {
        result = result.replaceAll(target, replaceValue)
      }
    })
  }

  // 1.5. Protect Known Entities (Dictionary)
  const { protectedText, entities } = mockEntities.length > 0
    ? protectKnownEntitiesMock(result, mockEntities)
    : protectKnownEntities(result)
  result = protectedText

  // 2. Add Strip
  if (stripEnabled) {
    result = result.replace(/\b([a-zA-Z0-9]+)\s+\1\b/gi, (match, word1) => {
      const words = match.split(/\s+/)
      return words[0] + '-' + words[1].toLowerCase()
    })
  }

  // 4. Format Huruf
  if (formatMode !== "none") {
    result = applyFormatWithProtection(result, (t) => {
      if (formatMode === "lower") return t.toLowerCase()
      if (formatMode === "upper") return t.toUpperCase()
      if (formatMode === "sentence") return applySentenceCase(t)
      if (formatMode === "capitalize") return t.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
      if (formatMode === "toggle") return t.split("").map(c => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()).join("")
      return t
    })
  }

  // 8. Auto Lowercase (if ON)
  if (autoLowercase) {
    if (autoSentence) {
      result = result.toLowerCase()
      result = applySentenceCase(result)
    } else {
      // Protect acronyms, lowercase rest
      const acronyms: string[] = []
      let protectedText = result.replace(/\b[A-Z]{2,}\b/g, match => {
        acronyms.push(match)
        return `__ACR${acronyms.length - 1}__`
      })
      protectedText = protectedText.replace(/\b[A-Z][a-z]*\b/g, w => w.toLowerCase())
      result = protectedText.replace(/__ACR(\d+)__/g, (_, i) => acronyms[parseInt(i)])
    }
  }

  // 6. Auto Capital After .!? (if ON) - Exact code from components/filter-custom.tsx
  if (autoCapital) {
    result = applyFormatWithProtection(result, (t) => {
      return t.replace(/(^|[.!?]\s+|[\r\n]+\s*)([a-z])/g, (_, punct, char) =>
        punct + char.toUpperCase()
      )
    })
  }

  // 7. Auto Sentence Case (if ON)
  if (autoSentence) {
    result = applySentenceCase(result)
  }

  // 3. Remove Line Break
  if (removeLineBreak) {
    result = result.replace(/[\r\n]+/g, ' ')
  }

  // 9. Auto Fix Space
  if (autoFixSpace) {
    result = result
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/(\r?\n){3,}/g, '\n\n')
      .trim()
  }

  // 9.5. Restore Known Entities
  result = restoreKnownEntities(result, entities)

  return result
}

function runAutoCapitalTests() {
  console.log("=== Running Auto Capital (Step 6) Tests ===")

  // 1. Toggle autoCapital ON. Input: "sprei itu bagus." (huruf pertama lowercase di awal teks)
  const res1 = runEngine("sprei itu bagus.", { autoCapital: true })
  assertEqual(res1, "Sprei itu bagus.", "Test 1: Auto Capital ON (start of string)")

  // 2. Toggle autoCapital ON. Input: "sprei itu bagus. beli di toko." (dua kalimat dipisah titik)
  const res2 = runEngine("sprei itu bagus. beli di toko.", { autoCapital: true })
  assertEqual(res2, "Sprei itu bagus. Beli di toko.", "Test 2: Auto Capital ON (multi-sentence with period)")

  // 3. Toggle autoCapital ON. Input: multi-line separated by newline without punctuation
  const res3 = runEngine("baju itu bagus\nsperai itu juga bagus\nselimut juga oke", { autoCapital: true })
  assertEqual(res3, "Baju itu bagus\nSperai itu juga bagus\nSelimut juga oke", "Test 3: Auto Capital ON (newline separated)")

  // 4. Toggle autoCapital ON. Input mixed period and newline
  const res4 = runEngine("kalimat satu. kalimat dua\nkalimat tiga! kalimat empat", { autoCapital: true })
  assertEqual(res4, "Kalimat satu. Kalimat dua\nKalimat tiga! Kalimat empat", "Test 4: Auto Capital ON (mixed punctuation and newline)")

  // 5. Toggle autoCapital ON + autoLowercase ON (autoSentence false). Input: "baju bagus\nQRIS itu praktis"
  const res5 = runEngine("baju bagus\nQRIS itu praktis", { autoCapital: true, autoLowercase: true, autoSentence: false })
  assertEqual(res5, "Baju bagus\nQRIS itu praktis", "Test 5: Auto Capital ON + Auto Lowercase ON (acronym QRIS preserved)")

  // 6. Toggle autoCapital OFF. Input multi-line -> unchanged
  const res6 = runEngine("baju itu bagus\nsperai itu juga bagus\nselimut juga oke", { autoCapital: false })
  assertEqual(res6, "baju itu bagus\nsperai itu juga bagus\nselimut juga oke", "Test 6: Auto Capital OFF (no-op)")

  // 7. Toggle autoCapital ON + removeLineBreak ON
  const input7 = "sprei putih kotor\naku ambil bantal\nbagian bawah kasur"
  const res7 = runEngine(input7, { autoCapital: true, removeLineBreak: true })
  assertEqual(res7, "Sprei putih kotor Aku ambil bantal Bagian bawah kasur", "Test 7: autoCapital ON + removeLineBreak ON")

  // 8. Toggle autoCapital ON + removeLineBreak OFF
  const res8 = runEngine(input7, { autoCapital: true, removeLineBreak: false })
  assertEqual(res8, "Sprei putih kotor\nAku ambil bantal\nBagian bawah kasur", "Test 8: autoCapital ON + removeLineBreak OFF")

  // 9. Toggle autoCapital OFF + removeLineBreak ON
  const res9 = runEngine(input7, { autoCapital: false, removeLineBreak: true })
  assertEqual(res9, "sprei putih kotor aku ambil bantal bagian bawah kasur", "Test 9: autoCapital OFF + removeLineBreak ON")

  // 10. Dictionary combination: entry 'sprei' -> 'seprai' + autoCapital ON + removeLineBreak ON
  const input10 = "sprei putih kotor\naku ambil bantal"
  const res10 = runEngine(input10, { autoCapital: true, removeLineBreak: true }, [{ key: "sprei", canonical: "seprai" }])
  assertEqual(res10, "Seprai putih kotor Aku ambil bantal", "Test 10: Dictionary + autoCapital ON + removeLineBreak ON")

  // 11. Multi-toggle CRLF line break test: removeLineBreak ON + autoCapital ON + autoLowercase ON + Dictionary
  const input11 = "shopee adalah aplikasi\r\nini baris kedua\r\nini baris ketiga\r\nini baris keempat"
  const res11 = runEngine(input11, { autoCapital: true, autoLowercase: true, removeLineBreak: true }, [{ key: "shopee", canonical: "Shopee" }])
  assertEqual(res11, "Shopee adalah aplikasi Ini baris kedua Ini baris ketiga Ini baris keempat", "Test 11: CRLF multi-line paste + removeLineBreak ON + autoCapital ON + autoLowercase ON + Dictionary")

  console.log("All Auto Capital tests passed successfully!")
}

runAutoCapitalTests()
