import { calculateScoring } from "../lib/scoring";

function normalizeInput(text: string): string {
  return text
    .replace(/^\\+/, "")
    .replace(/\\{3,}/g, "\\\\")
    .replace(/([^\\\s])(\\{1,2})([^\\\s])/g, "$1$2 $3")
    .replace(/\s+(\\{1,2})([^\\\s])/g, "$1 $2")
    .replace(/\s+(\\{1,2})\s+/g, " $1 ");
}

function runTests() {
  console.log("=== Running Backslash and Scoring Regression Tests ===");

  // 1. normalizeInput tests
  const n1 = normalizeInput("warung\\\\nasi\\uduk\\\\\\abis\\\\");
  const expected_n1 = "warung\\\\ nasi\\ uduk\\\\ abis\\\\";
  if (n1 !== expected_n1) {
    throw new Error(`normalizeInput failed! Got: ${n1}, expected: ${expected_n1}`);
  }
  console.log("✓ normalizeInput test passed successfully.");

  // 2. calculateScoring test (fuzzy checks, multiple slashes, highlights)
  const scoreResult = calculateScoring("warung\\\\ nasi\\ uduk\\\\ abis\\", "Warung. Nasi, uduk. Abis.");
  if (scoreResult.score !== 100) {
    throw new Error(`calculateScoring failed! Score: ${scoreResult.score}, expected: 100`);
  }
  console.log("✓ calculateScoring test passed successfully.");
  console.log("All tests passed perfectly!");
}

runTests();
