import { protectKnownEntities, restoreKnownEntities, addKnownEntity } from "../lib/known-entities"
import { applyFormatWithProtection } from "../lib/text-utils"

// Mock window localStorage
if (typeof window === "undefined") {
  const storage: Record<string, string> = {}
  global.window = {
    localStorage: {
      getItem: (key: string) => storage[key] || null,
      setItem: (key: string, val: string) => { storage[key] = val },
      removeItem: (key: string) => { delete storage[key] },
      clear: () => { Object.keys(storage).forEach(k => delete storage[k]) }
    }
  } as any
  global.localStorage = global.window.localStorage
}

function simulateFilterCustomEngine(text: string, autoCapital: boolean = true, autoLowercase: boolean = true): string {
  let result = text

  // 1.5 Protect Known Entities
  const { protectedText, entities } = protectKnownEntities(result)
  result = protectedText

  // 8. Auto Lowercase
  if (autoLowercase) {
    const acronyms: string[] = []
    let pText = result.replace(/\b[A-Z]{2,}\b/g, match => {
      acronyms.push(match)
      return `__ACR${acronyms.length - 1}__`
    })
    pText = pText.replace(/\b[A-Z][a-z]*\b/g, w => w.toLowerCase())
    result = pText.replace(/__ACR(\d+)__/g, (_, i) => acronyms[parseInt(i)])
  }

  // 6. Auto Capital
  if (autoCapital) {
    result = applyFormatWithProtection(result, (t) => {
      return t.replace(/(^|[.!?]\s+|\n+\s*)([a-z])/g, (_, punct, char) =>
        punct + char.toUpperCase()
      )
    })
  }

  // 9.5 Restore Known Entities
  result = restoreKnownEntities(result, entities)

  return result
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`)
  }
}

function runPasteTests() {
  console.log("=== Running Filter Custom Paste Integration Tests ===")

  localStorage.clear()
  addKnownEntity("sprei", "seprai")

  // Scenario 1: Paste text with dictionary match at start of sentence (autoCapital ON, autoLowercase ON)
  const text1 = "sprei putih yang kotor tadi pagi masih menumpuk di lantai kamar."
  const out1 = simulateFilterCustomEngine(text1, true, true)
  assert(
    out1 === "Seprai putih yang kotor tadi pagi masih menumpuk di lantai kamar.",
    `Scenario 1 failed! Expected "Seprai...", got "${out1}"`
  )
  console.log("✓ Scenario 1 passed (Paste + Dictionary + Auto Capital ON + Auto Lower ON -> Seprai...)")

  // Scenario 2: Paste text with dictionary match at start of sentence (autoCapital ON, autoLowercase OFF)
  const text2 = "sprei putih yang kotor tadi pagi."
  const out2 = simulateFilterCustomEngine(text2, true, false)
  assert(
    out2 === "Seprai putih yang kotor tadi pagi.",
    `Scenario 2 failed! Expected "Seprai...", got "${out2}"`
  )
  console.log("✓ Scenario 2 passed (Paste + Dictionary + Auto Capital ON + Auto Lower OFF -> Seprai...)")

  // Scenario 3: Paste text without dictionary match (regular text)
  const text3 = "sprei yang tidak ada di dictionary tapi kata lain biasa."
  // Note: "sprei" IS in dictionary, so let's use a word not in dictionary: "selimut"
  const text3b = "selimut putih yang kotor tadi pagi."
  const out3 = simulateFilterCustomEngine(text3b, true, true)
  assert(
    out3 === "Selimut putih yang kotor tadi pagi.",
    `Scenario 3 failed! Expected "Selimut...", got "${out3}"`
  )
  console.log("✓ Scenario 3 passed (Paste regular text without dictionary match -> Selimut...)")

  // Scenario 4: Short text vs Long text paste
  const text4Short = "sprei kotor."
  const out4Short = simulateFilterCustomEngine(text4Short, true, true)
  assert(out4Short === "Seprai kotor.", `Scenario 4 Short failed! Got: "${out4Short}"`)

  const text4Long = "sprei putih kotor. " + "kalimat kedua disini. ".repeat(20)
  const out4Long = simulateFilterCustomEngine(text4Long, true, true)
  assert(out4Long.startsWith("Seprai putih kotor. Kalimat kedua disini."), `Scenario 4 Long failed! Got start: "${out4Long.slice(0, 50)}"`)
  console.log("✓ Scenario 4 passed (Short & Long text paste)")

  // Scenario 5: Multi-line paste with removeLineBreak ON & autoCapital ON
  function simulateFilterCustomEngineWithNoBreak(text: string, autoCapital: boolean = true, removeLineBreak: boolean = true): string {
    let result = text
    const { protectedText, entities } = protectKnownEntities(result)
    result = protectedText

    if (autoCapital) {
      result = applyFormatWithProtection(result, (t) => {
        return t.replace(/(^|[.!?]\s+|\n+\s*)([a-z])/g, (_, punct, char) =>
          punct + char.toUpperCase()
        )
      })
    }

    if (removeLineBreak) {
      result = result.replace(/\n+/g, ' ')
    }

    result = restoreKnownEntities(result, entities)
    return result
  }

  const multiLineText = "baris pertama.\nbaris kedua.\nbaris ketiga."
  const out5 = simulateFilterCustomEngineWithNoBreak(multiLineText, true, true)
  assert(
    out5 === "Baris pertama. Baris kedua. Baris ketiga.",
    `Scenario 5 failed! Expected "Baris pertama. Baris kedua. Baris ketiga.", got "${out5}"`
  )
  console.log("✓ Scenario 5 passed (Multi-line paste + removeLineBreak ON + autoCapital ON)")

  // Scenario 6: React State Track Simulation (lastProcessedInput ref vs boolean isInternalUpdate flag)
  function simulateReactEffectStateSync(inputValues: string[], runEngineFn: (t: string) => string): string[] {
    const outputs: string[] = []
    let lastProcessedInput: string | null = null

    for (const inputVal of inputValues) {
      if (inputVal === lastProcessedInput) {
        outputs.push(inputVal)
        continue
      }
      const processed = runEngineFn(inputVal)
      lastProcessedInput = processed
      outputs.push(processed)
    }

    return outputs
  }

  const pasteSimResults = simulateReactEffectStateSync(
    ["sprei putih kotor.", "sprei putih kotor."],
    (t) => simulateFilterCustomEngine(t, true, true)
  )
  assert(
    pasteSimResults[0] === "Seprai putih kotor." && pasteSimResults[1] === "Seprai putih kotor.",
    `Scenario 6 failed! React State Sync simulation failed: ${JSON.stringify(pasteSimResults)}`
  )
  console.log("✓ Scenario 6 passed (React State Sync tracking with lastProcessedInput)")

  console.log("All Filter Custom Paste integration tests passed successfully!")
}

runPasteTests()
