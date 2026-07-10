"use client"

import { useState, useCallback, useEffect } from "react"
import { TranscriptionCard } from "./transcription-card"
import { FilterCustom } from "./filter-custom"
import { StatusIndicator, StatusState } from "./status-indicator"
import { calculateScoring, ScoringResult } from "@/lib/scoring"
import { protectAcronyms, restoreAcronyms } from "@/lib/text-utils"
import { Kbd } from "@/components/ui/kbd"
import { useLanguage } from "./language-provider"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { TranslationKey } from "@/lib/translations"
import { HelpIcon } from "./ui/help-icon"
import { protectKnownEntities, restoreKnownEntities, getKnownEntities, addKnownEntity, removeKnownEntity, exportKnownEntities, importKnownEntities, KnownEntity } from "@/lib/known-entities"
import { Book, Trash2, Download, Upload, Plus } from "lucide-react"

type Provider = "groq" | "google" | "aiml" | "openrouter"

const PROMPT_BIASA = `Perbaiki teks input. Semua output dalam satu paragraf.

ATURAN:
- Larangan eksplisit: Jangan tambah kata, kalimat, atau informasi baru yang tidak ada di input. Jangan hapus makna asli kalimat.
- Pertahankan gaya santai (gue, lu, nggak, dll) sesuai input.
- Tulis kata apa adanya — jangan ubah ke bentuk baku.
- Perbaiki typo, kapitalkan nama diri dan merek.
- Penulisan angka dan nama merek/brand asing: pertahankan penulisan asli, jangan diterjemahkan atau diformat ulang kecuali kapitalisasi nama diri.
- Gabungkan kata ulang dengan hubung (pelan pelan → pelan-pelan).
- Tambah atau ganti tanda baca sesuai EYD.
- Hapus dash (—), ganti dengan titik atau koma.
- Akhir kalimat hanya . ? !.
- Pertahankan kalimat menggantung jika ada di input.
- Jangan ubah, hapus, atau terjemahkan token berbentuk __ENTITY_N__ (garis bawah + angka) — biarkan persis apa adanya, itu placeholder yang akan direstore otomatis.
- Jangan pernah menggunakan tanda elipsis (...) dalam bentuk apapun — baik tiga titik berurutan (...) maupun karakter unicode elipsis tunggal (…). Setiap jeda atau kalimat yang belum selesai harus tetap diselesaikan menjadi kalimat gramatikal yang utuh, atau menggunakan tanda baca standar EYD (koma, titik, tanda tanya, tanda seru) sesuai konteks — bukan dipotong dengan elipsis.

Output: teks hasil saja, tanpa komentar.

Contoh:
Input:  gue lagi di warung mau beli nasi uduk abis deh
Output: Gue lagi di warung, mau beli nasi uduk. Abis deh.`

const INSERT_PROMPT_TEMPLATE = PROMPT_BIASA

const PROMPT_1 = `Kamu editor transkripsi audio. Lakukan DUA hal saja:
1. Ganti setiap jeda suara ("\\" atau "\\\\") dengan tanda baca (. , ! atau ?) sesuai konteks dan prioritas aturan di bawah.
2. Kapitalkan awal kalimat dan nama diri (orang, tempat, merek).

PRIORITAS ATURAN (WAJIB DIPATUHI BERDASARKAN URUTAN PRIORITAS):

PRIORITAS 1 — Tata bahasa & EYD (WAJIB dicek lebih dulu):
Tentukan dulu apakah posisi jeda itu batas kalimat gramatikal yang lengkap (subjek-predikat-objek/ide selesai) atau cuma jeda di tengah klausa yang masih menyambung ke kalimat sebelumnya. Keputusan tanda baca HARUS mengikuti struktur gramatikal ini sebagai acuan utama.

PRIORITAS 2 — Durasi jeda sebagai sinyal tambahan (dipakai kalau gramatikal ambigu):
- "\\" (satu backslash, jeda pendek) → cenderung koma (,) kalau EYD tidak memberikan sinyal jelas.
- "\\\\" (dua backslash, jeda panjang) → cenderung titik (.) kalau EYD tidak memberikan sinyal jelas.
Durasi ini BUKAN aturan mutlak — kalau EYD jelas menunjukkan kalimat belum selesai meski jedanya panjang, tetap pakai koma. Sebaliknya kalau EYD jelas menunjukkan kalimat sudah selesai meski jedanya pendek, tetap pakai titik.

PRIORITAS 3 — Tanda tanya/seru:
Kalau konteks kalimat jelas menunjukkan pertanyaan atau seruan, override semua di atas and pakai (?) atau (!).

LARANGAN:
- Jangan ubah, tambah, atau hapus kata apapun.
- Jangan ubah ejaan kata — baku maupun tidak baku, biarkan apa adanya.
- Jangan sentuh tanda baca selain "\\" dan "\\\\".
- Setiap "\\" dan "\\\\" WAJIB diganti, tidak boleh dihapus atau dilewati.
- Jika ragu pilih titik (.) atau koma (,) sesuai struktur gramatikal.
- Jangan ubah, hapus, atau terjemahkan token berbentuk __ENTITY_N__ (garis bawah + angka) — biarkan persis apa adanya, itu placeholder yang akan direstore otomatis.
- Jangan pernah menggunakan tanda elipsis (...) dalam bentuk apapun — baik tiga titik berurutan (...) maupun karakter unicode elipsis tunggal (…). Setiap jeda atau kalimat yang belum selesai harus tetap diselesaikan menjadi kalimat gramatikal yang utuh, atau menggunakan tanda baca standar EYD (koma, titik, tanda tanya, tanda seru) sesuai konteks — bukan dipotong dengan elipsis.

Output: teks hasil saja, tanpa komentar.

Contoh 1 (Durasi & EYD Searah):
Input:  kami baru sampai di stasiun\\\\ kereta sudah berangkat\\ kita telat\\
Output: Kami baru sampai di stasiun. Kereta sudah berangkat, kita telat.

Contoh 2 (Durasi & EYD Bertentangan - EYD Menang):
Input:  meskipun hujan sangat lebat\\\\ kami tetap berangkat ke sekolah\\ hari ini sangat dingin\\
Output: Meskipun hujan sangat lebat, kami tetap berangkat ke sekolah. Hari ini sangat dingin.`


function normalizeInput(text: string): string {
  // kata \kata selanjutnya  → kata\ kata selanjutnya
  // kata \ kata selanjutnya → kata\ kata selanjutnya
  // word\word -> word\ word
  // Fix dangling backslashes at start or multi-slashes
  return text
    .replace(/^\\+/, "")
    .replace(/\\{3,}/g, "\\\\")
    .replace(/([^\\\s])(\\{1,2})([^\\\s])/g, "$1$2 $3")
    .replace(/\s+(\\{1,2})([^\\\s])/g, "$1 $2")
    .replace(/\s+(\\{1,2})\s+/g, " $1 ")
}

function stripExtraText(text: string): string {
  const markers = ["catatan:", "note:", "output:", "hasil:", "penjelasan:"]
  const lines = text.split("\n")
  const filteredLines = lines.filter((line) => {
    const trimmedLine = line.trim().toLowerCase()
    if (markers.some((marker) => trimmedLine.startsWith(marker))) return false
    if (trimmedLine.startsWith("- ") || trimmedLine.startsWith("* ")) return false
    return true
  })
  return filteredLines.join("\n").trim()
}

function validator(input: string, output: string): { ok: boolean; masalah: string[]; missingWords?: boolean } {
  const masalah: string[] = []
  const inputWords = input.split(/\s+/).filter(w => w.length > 0)
  const outputWords = output.split(/\s+/).filter(w => w.length > 0)

  // 1. Word Preservation Check (Fuzzy)
  const outputTokens = outputWords.map(w => w.replace(/[.,!?]$/, "").toLowerCase())
  let missingWords = false
  for (const inWordWithSlash of inputWords) {
    const inWord = inWordWithSlash.replace(/\\+$/, "").toLowerCase()
    if (inWord.length < 2) continue

    const hasMatch = outputTokens.some(outWord =>
      outWord.startsWith(inWord.slice(0, 3)) || inWord.startsWith(outWord.slice(0, 3))
    )

    if (!hasMatch) {
      missingWords = true
      break
    }
  }

  const anchors: { word: string; pos: number }[] = []
  inputWords.forEach((word, index) => {
    if (word.endsWith("\\\\")) {
      anchors.push({ word: word.slice(0, -2).toLowerCase(), pos: index })
    } else if (word.endsWith("\\")) {
      anchors.push({ word: word.slice(0, -1).toLowerCase(), pos: index })
    }
  })

  const slashCount = (input.match(/\\{1,2}/g) || []).length
  const punctuationRegex = /[.,!?]$/

  // Find words in output that carry punctuation
  const outputPunctuationWords = outputWords
    .map((word, index) => (punctuationRegex.test(word) ? { word, index } : null))
    .filter((item): item is { word: string; index: number } => item !== null)

  if (outputPunctuationWords.length !== slashCount) {
    masalah.push(`jumlah tanda baca tidak sesuai jumlah penanda jeda (ada ${outputPunctuationWords.length}, seharusnya ${slashCount})`)
    return { ok: false, masalah, missingWords }
  }

  anchors.forEach((anchor, i) => {
    const item = outputPunctuationWords[i]
    if (!item) return

    const outputWord = item.word
    const baseOutputWord = outputWord.replace(/[.,!?]$/, "").toLowerCase()

    const isMatch = baseOutputWord.startsWith(anchor.word.slice(0, 3)) || anchor.word.startsWith(baseOutputWord.slice(0, 3))

    if (item.index !== anchor.pos) {
      masalah.push(`tanda baca ke-${i + 1} ("${baseOutputWord}") berada di posisi ${item.index + 1}, seharusnya di posisi ${anchor.pos + 1} ("${anchor.word}")`)
    } else if (!isMatch) {
      masalah.push(`tanda baca ke-${i + 1} berada di kata "${baseOutputWord}", seharusnya di sekitar "${anchor.word}"`)
    }
  })

  // Ellipsis Check
  if (output.includes("...") || output.includes("…")) {
    masalah.push("output mengandung tanda baca elipsis (...) yang dilarang")
  }

  return { ok: masalah.length === 0, masalah, missingWords }
}

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

export function TranscriptionForm() {
  const { t } = useLanguage()
  const [input, setInput] = useState("")
  const [result, setResult] = useState("")
  const [processTime, setProcessTime] = useState<string | null>(null)
  const [scoring, setScoring] = useState<ScoringResult | null>(null)
  const [showDiff, setShowDiff] = useState(false)
  const [provider, setProvider] = useState<Provider>("google")
  const [version, setVersion] = useState<"biasa" | "v1" | "v2.2" | "v3">("biasa")
  const [status, setStatus] = useState<{ state: StatusState; messageKey: string }>({
    state: "idle",
    messageKey: "statusReady",
  })
  const [isProcessing, setIsProcessing] = useState(false)
  const [v2Status, setV2Status] = useState<{
    state: "idle" | "loading" | "valid" | "fixed_algo" | "fixed_warning" | "error"
    retryCount: number
    masalah: string[]
    totalSlashes: number
    fixerChanges: FixerChange[]
    wordCountMismatch: boolean
    missingWords?: boolean
  }>({
    state: "idle",
    retryCount: 0,
    masalah: [],
    totalSlashes: 0,
    fixerChanges: [],
    wordCountMismatch: false,
    missingWords: false
  })
  const [showFixerDiff, setShowFixerDiff] = useState(false)
  const [showTutorial, setShowTutorial] = useState(false)

  const [batchEditWord, setBatchEditWord] = useState<string | null>(null)

  // Dictionary UI state
  const [showDictionaryModal, setShowDictionaryModal] = useState(false)
  const [dictionaryEntities, setDictionaryEntities] = useState<KnownEntity[]>([])
  const [newKey, setNewKey] = useState("")
  const [newCanonical, setNewCanonical] = useState("")
  const [showImportConfirm, setShowImportConfirm] = useState(false)
  const [pendingImportJson, setPendingImportJson] = useState("")
  const [importMessage, setImportMessage] = useState<{ text: string; type: "success" | "error" } | null>(null)

  useEffect(() => {
    if (showDictionaryModal) {
      setDictionaryEntities(getKnownEntities())
      setImportMessage(null)
    }
  }, [showDictionaryModal])

  const handleAddEntity = () => {
    if (!newKey.trim() || !newCanonical.trim()) return
    const updated = addKnownEntity(newKey, newCanonical)
    setDictionaryEntities(updated)
    setNewKey("")
    setNewCanonical("")
  }

  const handleRemoveEntity = (key: string) => {
    const updated = removeKnownEntity(key)
    setDictionaryEntities(updated)
  }

  const handleExport = () => {
    exportKnownEntities()
  }

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      const existing = getKnownEntities()
      if (existing.length === 0) {
        // Direct import without confirmation
        const res = importKnownEntities(content, "merge")
        if (res.success) {
          setDictionaryEntities(getKnownEntities())
          setImportMessage({ text: `Berhasil import ${res.count} entry`, type: "success" })
        } else {
          setImportMessage({ text: res.error || "Gagal import file", type: "error" })
        }
      } else {
        setPendingImportJson(content)
        setShowImportConfirm(true)
      }
    }
    reader.readAsText(file)
    // Clear input so same file can be selected again
    e.target.value = ""
  }

  const executeImport = (mode: "merge" | "replace") => {
    const res = importKnownEntities(pendingImportJson, mode)
    setShowImportConfirm(false)
    setPendingImportJson("")
    if (res.success) {
      setDictionaryEntities(getKnownEntities())
      setImportMessage({ text: `Berhasil import ${res.count} entry`, type: "success" })
    } else {
      setImportMessage({ text: res.error || "Gagal import file", type: "error" })
    }
  }

  useEffect(() => {
    const hasSeen = localStorage.getItem("tb_tutorial_seen")
    if ((version === "v1" || version === "v2.2") && !hasSeen) {
      setShowTutorial(true)
    }
  }, [version])

  const dismissTutorial = () => {
    localStorage.setItem("tb_tutorial_seen", "true")
    setShowTutorial(false)
  }

  const clearAll = useCallback(() => {
    setInput("")
    setResult("")
    setScoring(null)
    setShowDiff(false)
    setStatus({ state: "idle", messageKey: "statusReady" })
    setV2Status({ state: "idle", retryCount: 0, masalah: [], totalSlashes: 0, fixerChanges: [], wordCountMismatch: false })
    setShowFixerDiff(false)
    setProcessTime(null)
    setBatchEditWord(null)
  }, [])

  const pasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      setInput(text)
      setStatus({ state: "success", messageKey: "statusMoved" })
      setTimeout(() => setStatus({ state: "idle", messageKey: "statusReady" }), 1500)
    } catch {
      setStatus({ state: "error", messageKey: "statusCopyFailed" })
    }
  }, [])

  const [promptCopied, setPromptCopied] = useState(false)
  const insertPrompt = useCallback(async () => {
    if (!input.trim()) {
      setStatus({ state: "error", messageKey: "statusEmptyInput" })
      return
    }
    const fullText = `${INSERT_PROMPT_TEMPLATE}\n\n${input}`
    try {
      await navigator.clipboard.writeText(fullText)
      setPromptCopied(true)
      setTimeout(() => setPromptCopied(false), 1500)
    } catch {
      setStatus({ state: "error", messageKey: "statusCopyFailed" })
    }
  }, [input])

  const process = useCallback(async () => {
    if (!input.trim()) {
      setStatus({ state: "error", messageKey: "statusEmptyInput" })
      return
    }

    const start = performance.now()

    if (version === "v3") {
      setStatus({ state: "idle", messageKey: "statusReady" })
      return
    }

    const isBackslashMode = version === "v1" || version === "v2.2"
    const normalizedInputText = isBackslashMode ? normalizeInput(input.trim()) : input.trim()

    // Task 6: Protect known entities
    const { protectedText, entities: protectedEntities } = protectKnownEntities(normalizedInputText)

    setIsProcessing(true)
    setStatus({ state: "loading", messageKey: "statusProcessing" })
    setResult("")
    setProcessTime(null)
    setShowFixerDiff(false)
    const totalSlashes = (normalizedInputText.match(/\\{1,2}/g) || []).length
    setV2Status({
      state: "loading",
      retryCount: 0,
      masalah: [],
      totalSlashes,
      fixerChanges: [],
      wordCountMismatch: false,
      missingWords: false
    })

    try {
      let currentResult = ""
      let currentRetry = 0
      let isValid = false
      let currentMasalah: string[] = []
      let missingWords = false

      // Initial Call
      const response = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: protectedText,
          provider,
          systemPrompt: version === "biasa" ? PROMPT_BIASA : PROMPT_1
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || t("statusError"))

      currentResult = stripExtraText(data.result)

      if (version === "v2.2") {
        const validation = validator(protectedText, currentResult)
        isValid = validation.ok
        currentMasalah = validation.masalah
        missingWords = !!validation.missingWords

        let finalState: "valid" | "fixed_algo" | "fixed_warning" = "valid"
        let fixerChanges: FixerChange[] = []
        let wordCountMismatch = false

        if (isValid) {
          finalState = "valid"
        } else {
          // STEP 4: ALGORITHMIC FIXER (no AI retry call, skip directly to fixer)
          const fixResult = algorithmicFixer(protectedText, currentResult)
          currentResult = fixResult.result
          fixerChanges = fixResult.changes
          wordCountMismatch = fixResult.wordCountMismatch
          finalState = wordCountMismatch ? "fixed_warning" : "fixed_algo"
        }

        setV2Status({
          state: finalState,
          retryCount: 0,
          masalah: currentMasalah,
          totalSlashes,
          fixerChanges,
          wordCountMismatch,
          missingWords
        })
      }

      // Restore protected entities at the very end
      const restoredResult = restoreKnownEntities(currentResult, protectedEntities)

      const finalScoring = isBackslashMode ? calculateScoring(normalizedInputText, restoredResult) : null
      const elapsed = ((performance.now() - start) / 1000).toFixed(1)
      setProcessTime(elapsed)
      setResult(restoredResult)
      setScoring(finalScoring)
      setStatus({ state: "success", messageKey: "statusDone" })
    } catch (error) {
      const elapsed = ((performance.now() - start) / 1000).toFixed(1)
      setProcessTime(elapsed)
      const message = error instanceof Error ? error.message : t("statusError")
      setResult("")
      // Truncate long error messages for display
      const displayMessage = message.length > 80 ? message.slice(0, 80) + "..." : message
      setStatus({ state: "error", messageKey: displayMessage })
      if (version === "v2.2") {
        setV2Status(prev => ({
          ...prev,
          state: "error",
          masalah: [message]
        }))
      } else {
        setV2Status(prev => ({ ...prev, state: "idle" }))
      }
    } finally {
      setIsProcessing(false)
    }
  }, [input, provider, version, t])

  const copyToClipboard = useCallback(async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result)
      setStatus({ state: "success", messageKey: "statusCopied" })
      setTimeout(() => setStatus({ state: "idle", messageKey: "statusReady" }), 2000)
    } catch {
      setStatus({ state: "error", messageKey: "statusCopyFailed" })
    }
  }, [result])

  const moveToInput = useCallback(() => {
    if (!result) return
    setInput(result)
    setResult("")
    setStatus({ state: "idle", messageKey: "statusMoved" })
  }, [result])

  const flatten = useCallback(() => {
    if (!input.trim()) return
    const flattened = input
      .toLowerCase()
      // Replace punctuation with space first to ensure word separation, then normalize spaces
      .replace(/[\\.,!?;:]/g, " ")
      // Remove Quotation marks
      .replace(/["''""]/g, "")
      .replace(/[''']/g, "")
      // Remove Ellipsis
      .replace(/\.\.\.|\u2026/g, "")
      // Remove Parentheses and brackets
      .replace(/[()\[\]]/g, "")
      // Remove standalone dashes and hyphens (surrounded by spaces or at start/end)
      // but keep intra-word hyphens like "benar-benar"
      .replace(/(^|\s)[-\u2013\u2014](\s|$)/g, "$1$2")
      .replace(/\s+/g, " ")
      .trim()
    setResult(flattened)
    setScoring(null)
    setStatus({ state: "success", messageKey: "statusDone" })
    setTimeout(() => setStatus({ state: "idle", messageKey: "statusReady" }), 1500)
  }, [input])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault()
        process()
      }
    },
    [process]
  )

  return (
    <div className="w-full max-w-3xl lg:max-w-4xl xl:max-w-5xl flex flex-col gap-4">
      {version !== "v3" && (
      <TranscriptionCard
        label={
          <div className="flex items-center gap-2">
            <span>{t("inputLabel")}</span>
            <span className="text-[9px] text-muted-foreground/60 normal-case">
              {input.length} {t("charCount")}
            </span>
          </div>
        }
        hint={
          version !== "biasa" && (
            <span className="flex items-center gap-1 flex-wrap">
              {t("inputHint")}
              <Kbd>\</Kbd>
              <span className="text-[10px] text-muted-foreground mr-1">(pendek)</span>
              <span>/</span>
              <Kbd>\\</Kbd>
              <span className="text-[10px] text-muted-foreground mr-1">(panjang)</span>
              {t("inputHintSuffix")}
            </span>
          )
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={pasteFromClipboard}
              className="font-mono text-[10px] bg-secondary text-muted-foreground border border-border px-2 py-1 rounded hover:text-foreground hover:border-muted-foreground transition-colors uppercase tracking-tighter font-bold cursor-pointer"
            >
              {t("pasteButton")}
            </button>
            <button
              onClick={clearAll}
              className="font-mono text-[10px] bg-secondary text-muted-foreground border border-border px-2 py-1 rounded hover:text-foreground hover:border-muted-foreground transition-colors uppercase tracking-tighter font-bold cursor-pointer"
            >
              {t("clearButton")}
            </button>
          </div>
        }
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("inputPlaceholder")}
          className="w-full bg-transparent border-none outline-none font-mono text-sm leading-relaxed text-foreground resize-none min-h-40 placeholder:text-muted-foreground"
        />
      </TranscriptionCard>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider font-semibold">
            {t("modeLabel")}
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div
              onClick={() => !isProcessing && setVersion("biasa")}
              className={`flex flex-col items-start p-3 rounded-md border transition-all text-left cursor-pointer ${
                version === "biasa"
                  ? "bg-primary/5 border-primary ring-1 ring-primary"
                  : "bg-card border-border hover:bg-secondary/50"
              } ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <span className="font-mono text-sm font-bold flex flex-col items-start gap-1 w-full">
                <div className="flex items-center justify-between w-full">
                  {t("biasaTitle")}
                  <HelpIcon>{t("tutorialModeBiasa")}</HelpIcon>
                </div>
                <span className="text-[9px] font-bold text-primary/70 bg-primary/5 px-1.5 py-0.5 rounded border border-primary/10">
                  {t("tagAnnotator")}
                </span>
              </span>
              <span className="font-mono text-[10px] text-muted-foreground mt-1">
                {t("biasaDesc")}
              </span>
            </div>
            <div
              onClick={() => !isProcessing && setVersion("v1")}
              className={`flex flex-col items-start p-3 rounded-md border transition-all text-left cursor-pointer ${
                version === "v1"
                  ? "bg-primary/5 border-primary ring-1 ring-primary"
                  : "bg-card border-border hover:bg-secondary/50"
              } ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <span className="font-mono text-sm font-bold flex flex-col items-start gap-1 w-full">
                <div className="flex items-center justify-between w-full">
                  {t("v1Title")}
                  <HelpIcon>{t("tutorialModeV1")}</HelpIcon>
                </div>
                <span className="text-[9px] font-bold text-muted-foreground/60 bg-secondary px-1.5 py-0.5 rounded border border-border">
                  {t("tagLessRecommended")}
                </span>
              </span>
              <span className="font-mono text-[10px] text-muted-foreground mt-1">
                {t("v1Desc")}
              </span>
            </div>
            <div
              onClick={() => !isProcessing && setVersion("v2.2")}
              className={`flex flex-col items-start p-3 rounded-md border transition-all text-left cursor-pointer ${
                version === "v2.2"
                  ? "bg-primary/5 border-primary ring-1 ring-primary"
                  : "bg-card border-border hover:bg-secondary/50"
              } ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <span className="font-mono text-sm font-bold flex flex-col items-start gap-1 w-full">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    {t("v2Title")}
                  </div>
                  <HelpIcon>{t("tutorialModeV2")}</HelpIcon>
                </div>
                <span className="text-[9px] font-bold text-primary/70 bg-primary/5 px-1.5 py-0.5 rounded border border-primary/10">
                  {t("tagRecommended")}
                </span>
              </span>
              <span className="font-mono text-[10px] text-muted-foreground mt-1">
                {t("v2Desc")}
              </span>
            </div>
            <div
              onClick={() => !isProcessing && setVersion("v3")}
              className={`flex flex-col items-start p-3 rounded-md border transition-all text-left cursor-pointer ${
                version === "v3"
                  ? "bg-primary/5 border-primary ring-1 ring-primary"
                  : "bg-card border-border hover:bg-secondary/50"
              } ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <span className="font-mono text-sm font-bold flex flex-col items-start gap-1">
                <div className="flex items-center gap-2">
                  {t("v3Title")}
                  <span className="text-xs bg-yellow-400 text-black px-1 rounded">Beta</span>
                </div>
                <span className="text-[9px] font-bold text-purple-600/70 bg-purple-500/5 px-1.5 py-0.5 rounded border border-purple-500/10">
                  {t("tagQC")}
                </span>
              </span>
              <span className="font-mono text-[10px] text-muted-foreground mt-1">
                {t("v3Desc")}
              </span>
            </div>
          </div>
        </div>

        <div className={version === "v3" ? "block" : "hidden"}>
          <FilterCustom
            input={input}
            setInput={setInput}
            onClear={clearAll}
          />
        </div>

        <div className={version !== "v3" ? "flex flex-wrap items-center gap-3" : "hidden"}>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{t("modelLabel")}:</span>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as Provider)}
              disabled={isProcessing}
              className="font-mono text-xs bg-secondary text-foreground border border-border rounded-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-primary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <option value="google">Google Gemini</option>
              <option value="aiml">{t("modelAiml")}</option>
              <option value="openrouter">{t("modelOpenRouter")}</option>
              <option value="groq">{t("modelGroq")}</option>
            </select>
          </div>
        <button
          onClick={() => setShowDictionaryModal(true)}
          className="font-mono text-xs bg-secondary hover:bg-secondary/80 border border-border hover:border-muted-foreground px-2 py-1.5 rounded-md text-foreground flex items-center gap-1.5 transition-colors cursor-pointer"
          title="Buka Dictionary"
        >
          <Book className="w-3.5 h-3.5 text-primary" />
          <span>Dictionary</span>
        </button>
          <button
            onClick={process}
            disabled={isProcessing}
            className="font-mono text-sm font-medium bg-primary text-primary-foreground px-5 py-2.5 rounded-md hover:bg-primary/90 active:scale-[0.97] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none whitespace-nowrap cursor-pointer"
          >
            {isProcessing ? t("processingButton") : `${t("processButton")} \u2192`}
          </button>
          {version === "biasa" && (
            <button
              onClick={insertPrompt}
              disabled={isProcessing || !input.trim()}
              className="font-mono text-xs font-medium bg-secondary text-foreground border border-border px-4 py-2.5 rounded-md hover:bg-secondary/80 active:scale-[0.97] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none whitespace-nowrap cursor-pointer"
            >
              {promptCopied ? t("promptCopied") : t("insertPromptButton")}
            </button>
          )}
          {(version === "v1" || version === "v2.2") && (
            <div className="flex items-center gap-2">
              <button
                onClick={flatten}
                disabled={isProcessing || !input.trim()}
                className="font-mono text-xs font-medium bg-white text-black border border-black px-4 py-2.5 rounded-md hover:bg-gray-100 active:scale-[0.97] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none whitespace-nowrap dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800 cursor-pointer"
              >
                {t("flatTextButton")}
              </button>
              <HelpIcon>{t("tutorialFlatText")}</HelpIcon>
            </div>
          )}
        </div>
      </div>

      {version !== "v3" && <div className="w-full h-px bg-border" />}

      {version !== "v3" && (
      <TranscriptionCard
        label={
          <div className="flex items-center gap-2">
            <span>{t("outputLabel")}</span>
            <span className="text-[9px] text-muted-foreground/60 normal-case">
              {result.length} {t("charCount")}
            </span>
          </div>
        }
        hint={
          version === "v2.2" && v2Status.state !== "idle" && (
            <div className="flex flex-wrap items-center gap-2">
              {v2Status.state === "loading" && (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 border border-purple-500/20 animate-pulse font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce" />
                  {t("v2BadgeProcessing")}
                </span>
              )}
              {v2Status.state === "valid" && (
                <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 border border-green-500/20 font-bold">
                  {t("v2BadgeValid")} · {v2Status.totalSlashes}/{v2Status.totalSlashes}
                </span>
              )}
              {v2Status.state === "fixed_algo" && (
                <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20 font-bold">
                  {t("v2BadgeFixed_algo")}
                </span>
              )}
              {v2Status.state === "fixed_warning" && (
                <span className="px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 border border-orange-500/20 font-bold">
                  {t("v2BadgeFixed_warning")}
                </span>
              )}
              {v2Status.state === "error" && (
                <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 border border-red-500/20 font-bold">
                  {t("v2BadgeError")}
                </span>
              )}
            </div>
          )
        }
        actions={
          result && (
            <div className="flex items-center gap-2">
              {scoring && (
                <button
                  onClick={() => setShowDiff(!showDiff)}
                  className={`font-mono text-[10px] border px-2 py-1 rounded transition-colors uppercase tracking-tighter font-bold cursor-pointer ${
                    showDiff
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary text-muted-foreground border-border hover:text-foreground hover:border-muted-foreground"
                  }`}
                >
                  {t("showDiff")}
                </button>
              )}
              <button
                onClick={copyToClipboard}
                className="font-mono text-[10px] bg-secondary text-muted-foreground border border-border px-2 py-1 rounded hover:text-foreground hover:border-muted-foreground transition-colors uppercase tracking-tighter font-bold cursor-pointer"
              >
                {t("copyButton")}
              </button>
              <button
                onClick={moveToInput}
                className="font-mono text-[10px] bg-secondary text-muted-foreground border border-border px-2 py-1 rounded hover:text-foreground hover:border-muted-foreground transition-colors uppercase tracking-tighter font-bold cursor-pointer"
              >
                {t("editButton")}
              </button>
            </div>
          )
        }
      >
        <div className="font-mono text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words min-h-14 relative pb-6">
          {result ? (
            showDiff && scoring ? (
              <div className="flex flex-wrap gap-x-1 gap-y-1">
                {scoring.highlights.map((seg, i) => (
                  <span
                    key={i}
                    className={
                      seg.type === "correct" ? "bg-green-500/20 text-green-600 px-0.5 rounded" :
                      seg.type === "added" ? "bg-blue-500/20 text-blue-600 px-0.5 rounded border border-blue-500/30" :
                      seg.type === "missing" ? "bg-red-500/20 text-red-600 px-0.5 rounded italic border border-dashed border-red-500/50" :
                      seg.type === "changed" ? "bg-yellow-500/20 text-yellow-600 px-0.5 rounded" :
                      ""
                    }
                  >
                    {seg.text}
                  </span>
                ))}
              </div>
            ) : result
          ) : (
            <span className="text-muted-foreground">
              {t("outputPlaceholder")}
            </span>
          )}

          {(isProcessing || processTime || (version === "v2.2" && v2Status.state !== "idle")) && (
            <div className="absolute bottom-0 left-0 right-0 pt-2 border-t border-border/50 flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground italic">
                  {isProcessing ? (
                    <>{t("statusProcessing")}</>
                  ) : version === "v2.2" && v2Status.state !== "idle" ? (
                    <>
                      {v2Status.state === "valid" && `selesai. semua ${v2Status.totalSlashes} tanda baca sesuai posisi.`}
                      {v2Status.state === "fixed_algo" && `selesai. algorithmic fixer digunakan.`}
                      {v2Status.state === "fixed_warning" && `selesai. algorithmic fixer digunakan dengan peringatan.`}
                      {v2Status.state === "error" && `perlu review manual: ${v2Status.masalah[0]}`}
                    </>
                  ) : (
                    <span>{status.state === "error" ? status.messageKey : t("statusDone")}</span>
                  )}
                </span>
                {!isProcessing && processTime && (
                  <span className="text-[9px] font-mono text-muted-foreground/40 tabular-nums">
                    · {processTime}s
                  </span>
                )}
              </div>
              {version === "v2.2" && v2Status.wordCountMismatch && (
                <span className="text-[10px] text-orange-600 font-bold uppercase tracking-tight">
                  {t("v2Warning")}
                </span>
              )}
              {version === "v2.2" && v2Status.missingWords && (
                <span className="text-[10px] text-red-600 font-bold uppercase tracking-tight">
                  {t("v2MissingWords")}
                </span>
              )}
            </div>
          )}
        </div>
      </TranscriptionCard>
      )}

      {version === "v2.2" && v2Status.fixerChanges.length > 0 && (
        <div className="bg-secondary/50 border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setShowFixerDiff(!showFixerDiff)}
            className="w-full px-4 py-2 flex items-center justify-between hover:bg-secondary transition-colors cursor-pointer"
          >
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {t("v2FixerTitle")} ({v2Status.fixerChanges.length})
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">
              {showFixerDiff ? "▲" : "▼"}
            </span>
          </button>
          {showFixerDiff && (
            <div className="px-4 py-3 border-t border-border flex flex-col gap-1.5 max-h-60 overflow-y-auto">
              {v2Status.fixerChanges.map((change, i) => (
                <div key={i} className="font-mono text-[11px] flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 line-through decoration-red-600/50">
                    {change.original}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <span className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-600 font-bold">
                    {change.fixed}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {scoring && version !== "v3" && (
        <div className="bg-secondary/30 border border-border rounded-lg p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t("accuracyScore")}
            </span>
            <span className={`font-mono text-lg font-bold ${
              scoring.score > 90 ? "text-green-500" :
              scoring.score > 70 ? "text-yellow-500" :
              "text-red-500"
            }`}>
              {scoring.score}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ${
                scoring.score > 90 ? "bg-green-500" :
                scoring.score > 70 ? "bg-yellow-500" :
                "bg-red-500"
              }`}
              style={{ width: `${scoring.score}%` }}
            />
          </div>
          <p className="font-mono text-[11px] text-muted-foreground italic">
            {scoring.score > 90 ? t("perfectScore") :
             scoring.score > 70 ? t("goodScore") :
             t("lowScore")}
          </p>
        </div>
      )}

      <StatusIndicator state={status.state} messageKey={status.messageKey} />

      <footer className="font-mono text-[11px] text-muted-foreground leading-relaxed mt-2">
        {version !== "biasa" && (
          <p>
            {t("footerInstructions")}{" "}
            <span className="inline-block bg-secondary border border-border rounded px-1.5 text-primary">
              \
            </span>{" "}
            {t("footerInstructionsSuffix")}
          </p>
        )}
        <p>{t("footerPoweredBy")}</p>
      </footer>

      {/* Known Entities Dictionary Dialog */}
      <Dialog open={showDictionaryModal} onOpenChange={setShowDictionaryModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-mono text-primary flex items-center gap-2">
              <Book className="w-5 h-5 text-primary" />
              Kelola Dictionary (Brand/Tempat)
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Form Tambah Entry */}
            <div className="flex flex-col gap-2 bg-secondary/30 p-3 rounded-lg border border-border">
              <p className="font-mono text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Tambah Entry Baru</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Kata asli (contoh: shopee)"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  className="font-mono text-xs bg-card border border-border rounded px-3 py-2 outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  type="text"
                  placeholder="Bentuk benar (contoh: Shopee)"
                  value={newCanonical}
                  onChange={(e) => setNewCanonical(e.target.value)}
                  className="font-mono text-xs bg-card border border-border rounded px-3 py-2 outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <button
                onClick={handleAddEntity}
                disabled={!newKey.trim() || !newCanonical.trim()}
                className="font-mono text-xs font-bold uppercase bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 px-4 py-2 rounded flex items-center justify-center gap-1 transition-all cursor-pointer mt-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah
              </button>
            </div>

            {/* List Entry */}
            <div className="border border-border rounded-lg overflow-hidden flex flex-col">
              <p className="font-mono text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-secondary/50 px-3 py-2 border-b border-border">List Entry ({dictionaryEntities.length})</p>
              <div className="max-h-48 overflow-y-auto divide-y divide-border/60 scrollbar-thin">
                {dictionaryEntities.length === 0 ? (
                  <p className="font-mono text-xs text-muted-foreground italic text-center py-6">Belum ada entry dictionary.</p>
                ) : (
                  dictionaryEntities.map((entity) => (
                    <div key={entity.key} className="flex items-center justify-between px-3 py-2 bg-card hover:bg-secondary/10 transition-colors">
                      <div className="flex items-center gap-2 font-mono text-xs">
                        <span className="text-muted-foreground line-through decoration-muted-foreground/30">{entity.key}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-bold text-foreground">{entity.canonical}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveEntity(entity.key)}
                        className="text-red-500 hover:text-red-600 p-1 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Export / Import */}
            <div className="flex items-center justify-between gap-4 border-t border-border pt-3">
              <button
                onClick={handleExport}
                className="font-mono text-xs font-bold uppercase bg-secondary text-foreground hover:bg-secondary/80 border border-border px-3 py-2 rounded flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Export JSON
              </button>

              <label className="font-mono text-xs font-bold uppercase bg-secondary text-foreground hover:bg-secondary/80 border border-border px-3 py-2 rounded flex items-center gap-1.5 transition-all cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                Import JSON
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportFileChange}
                  className="hidden"
                />
              </label>
            </div>

            {/* Import Status Message */}
            {importMessage && (
              <p className={`font-mono text-xs text-center font-bold p-2 rounded ${
                importMessage.type === "success" ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"
              }`}>
                {importMessage.text}
              </p>
            )}
          </div>

          <DialogFooter>
            <button
              onClick={() => setShowDictionaryModal(false)}
              className="w-full font-mono text-xs font-bold uppercase bg-secondary text-foreground hover:bg-secondary/80 px-4 py-2.5 rounded border border-border transition-all cursor-pointer"
            >
              Tutup
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Merge vs Replace */}
      <Dialog open={showImportConfirm} onOpenChange={setShowImportConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono text-primary">Konfirmasi Import Dictionary</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="font-mono text-xs text-foreground leading-relaxed">
              Ditemukan data dictionary yang sudah ada di browser ini. Pilih bagaimana Anda ingin memasukkan file dictionary yang baru:
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <div className="p-2.5 bg-blue-500/5 border border-blue-500/10 rounded">
                <p className="font-mono text-xs font-bold text-blue-600">Gabung (Merge)</p>
                <p className="font-mono text-[10px] text-muted-foreground mt-0.5">Menambahkan entry baru dan memperbarui kata asli yang sama tanpa menghapus entry yang sudah ada.</p>
              </div>
              <div className="p-2.5 bg-red-500/5 border border-red-500/10 rounded">
                <p className="font-mono text-xs font-bold text-red-600">Timpa Semua (Replace)</p>
                <p className="font-mono text-[10px] text-muted-foreground mt-0.5">MENGHAPUS seluruh entry dictionary saat ini dan menggantinya dengan yang ada di file.</p>
              </div>
            </div>
          </div>
          <DialogFooter className="flex flex-row items-center gap-2 justify-end">
            <button
              onClick={() => setShowImportConfirm(false)}
              className="font-mono text-xs font-bold uppercase bg-secondary text-foreground hover:bg-secondary/80 px-4 py-2 rounded border border-border transition-all cursor-pointer"
            >
              Batal
            </button>
            <button
              onClick={() => executeImport("merge")}
              className="font-mono text-xs font-bold uppercase bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded transition-all cursor-pointer"
            >
              Gabung (Merge)
            </button>
            <button
              onClick={() => executeImport("replace")}
              className="font-mono text-xs font-bold uppercase bg-red-600 text-white hover:bg-red-700 px-4 py-2 rounded transition-all cursor-pointer"
            >
              Timpa (Replace)
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showTutorial} onOpenChange={setShowTutorial}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono text-primary flex items-center gap-2">
              <span className="p-1 rounded bg-primary/10 text-primary">
                \
              </span>
              {t("tutorialTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-2">
            <div className="font-mono text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {t("tutorialBody")}
            </div>
            <div className="w-full h-px bg-border my-4" />
            <div className="font-mono text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {t("tutorialModeV2")}
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={dismissTutorial}
              className="w-full font-mono text-sm font-medium bg-primary text-primary-foreground px-4 py-2.5 rounded-md hover:bg-primary/90 transition-all cursor-pointer"
            >
              {t("tutorialButton")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
