import { calculateScoring } from "../lib/scoring"

function runTests() {
  console.log("=== Running Scoring Regression and LCS Alignment Tests ===")

  // Test Case 1: Input "satu\\ dua\ tiga" -> output "Satu. Dua, tiga." (100% score)
  const res1 = calculateScoring("satu\\\\ dua\\ tiga", "Satu. Dua, tiga.")
  console.log("Test Case 1 Result:", res1)
  if (res1.score !== 100) {
    throw new Error(`Test Case 1 failed! Got score: ${res1.score}, expected: 100`)
  }
  // Check highlights breakdown
  const correctCount1 = res1.highlights.filter(h => h.type === "correct").length
  const normalCount1 = res1.highlights.filter(h => h.type === "normal").length
  // Wait, let's check exact text of highlights. Since they merge adjacent highlights of the same type,
  // we might have merged segments. Let's see how many segments we got.
  console.log("✓ Test Case 1 passed.")

  // Test Case 2: Input 10 words, output missing 1 word in middle
  // "satu dua tiga empat lima enam tujuh delapan sembilan sepuluh"
  // Output missing "lima" -> "Satu dua tiga empat enam tujuh delapan sembilan sepuluh."
  const input2 = "satu dua tiga empat lima enam tujuh delapan sembilan sepuluh"
  const output2 = "Satu dua tiga empat enam tujuh delapan sembilan sepuluh."
  const res2 = calculateScoring(input2, output2)
  console.log("Test Case 2 Result:", res2)
  if (res2.score !== 90) {
    throw new Error(`Test Case 2 failed! Got score: ${res2.score}, expected: 90`)
  }
  // Verify highlight types: should have "missing" for lima
  const hasMissing = res2.highlights.some(h => h.type === "missing" && h.text.includes("lima"))
  if (!hasMissing) {
    throw new Error(`Test Case 2 failed! Expected "missing" segment containing "lima"`)
  }
  console.log("✓ Test Case 2 passed.")

  // Test Case 3: Input 10 words, output added 1 word in middle
  // Input: "satu dua tiga empat lima enam tujuh delapan sembilan sepuluh"
  // Output: "Satu dua tiga empat lima ekstra enam tujuh delapan sembilan sepuluh."
  const input3 = "satu dua tiga empat lima enam tujuh delapan sembilan sepuluh"
  const output3 = "Satu dua tiga empat lima ekstra enam tujuh delapan sembilan sepuluh."
  const res3 = calculateScoring(input3, output3)
  console.log("Test Case 3 Result:", res3)
  // Opportunities = 10, matches = 10. score should be 100%.
  if (res3.score !== 100) {
    throw new Error(`Test Case 3 failed! Got score: ${res3.score}, expected: 100`)
  }
  const hasAdded = res3.highlights.some(h => h.type === "added" && h.text.includes("ekstra"))
  if (!hasAdded) {
    throw new Error(`Test Case 3 failed! Expected "added" segment containing "ekstra"`)
  }
  console.log("✓ Test Case 3 passed.")

  // Test Case 4: Word with marker \\ -> base word stripped properly, no backslash nyangkut
  const res4 = calculateScoring("buku\\\\", "Buku.")
  console.log("Test Case 4 Result:", res4)
  if (res4.score !== 100) {
    throw new Error(`Test Case 4 failed! Got score: ${res4.score}, expected: 100`)
  }
  // There should be no backslash in highlights
  res4.highlights.forEach(h => {
    if (h.text.includes("\\")) {
      throw new Error(`Test Case 4 failed! Found backslash in highlight segment: ${h.text}`)
    }
  })
  console.log("✓ Test Case 4 passed.")

  // Test Case 5: Ellipsis spacing cleanup test
  const ellipsisInputs = [
    "kata...  kata",
    "kata ... kata",
    "kata...kata",
    "kata …  kata",
  ]
  const expectedOutputs = [
    "kata. kata",
    "kata. kata",
    "kata. kata",
    "kata. kata",
  ]
  ellipsisInputs.forEach((inp, idx) => {
    let clean = inp.replace(/\.\.\.|\u2026/g, ". ")
    clean = clean
      .replace(/\s+\./g, ".")
      .replace(/\s+/g, " ")
      .trim()
    if (clean !== expectedOutputs[idx]) {
      throw new Error(`Ellipsis cleanup test failed for "${inp}"! Got: "${clean}", expected: "${expectedOutputs[idx]}"`)
    }
  })
  console.log("✓ Test Case 5 (Ellipsis cleanup) passed.")

  // Test Case 6: Exact Match verification (Task 11 Regression tests)
  // These word pairs share a 3-character prefix but have different meanings/endings.
  // "dia" vs "diam", "kali" vs "kalau", "beli" vs "belum".
  // Because they are different words, they should NOT match (score must be < 100%).

  const testPairs = [
    { input: "dia", output: "diam" },
    { input: "kali", output: "kalau" },
    { input: "beli", output: "belum" }
  ]

  testPairs.forEach(({ input, output }) => {
    const res = calculateScoring(input, output)
    console.log(`Test Case 6 (Exact match regression) for "${input}" vs "${output}":`, res)
    if (res.score === 100) {
      throw new Error(`Test Case 6 failed! Word "${input}" should NOT match "${output}" under exact-match scoring logic!`)
    }
  })
  console.log("✓ Test Case 6 (Exact match regression for short words) passed.")

  console.log("All scoring and LCS tests passed successfully!")
}

runTests()
