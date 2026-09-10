"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { useLanguage } from "./language-provider"
import { HelpIcon } from "./ui/help-icon"
import { cn } from "@/lib/utils"
import {
  applyFormatWithProtection,
  applySentenceCase,
  formatPreservingReplace,
} from "@/lib/text-utils"
import { AlertTriangle, Sparkles, Wand2, Book } from "lucide-react"
import { protectKnownEntities, restoreKnownEntities } from "@/lib/known-entities"
import { DictionaryModal } from "./dictionary-modal"

interface FilterCustomProps {
  input: string
  setInput: (val: string) => void
  onClear: () => void
}

type FormatMode = "none" | "sentence" | "lower" | "upper" | "capitalize" | "toggle"
type SmartReplaceMode = "format-preserving" | "strict"

export function FilterCustom({ input, setInput, onClear }: FilterCustomProps) {
  const { t } = useLanguage()
  const [showDictionaryModal, setShowDictionaryModal] = useState(false)

  // Engine States
  const [findValue, setFindValue] = useState("")
  const [replaceValue, setReplaceValue] = useState("")
  const [stripEnabled, setStripEnabled] = useState(false)
  const [removeLineBreak, setRemoveLineBreak] = useState(false)
  const [formatMode, setFormatMode] = useState<FormatMode>("none")
  const [smartReplaceMode, setSmartReplaceMode] = useState<SmartReplaceMode>("format-preserving")
  const [autoCapital, setAutoCapital] = useState(false)
  const [autoLowercase, setAutoLowercase] = useState(false)
  const [autoSentence, setAutoSentence] = useState(false)
  const [autoFixSpace, setAutoFixSpace] = useState(false)

  // History State
  const MAX_HISTORY = 100
  const historyStack = useRef<string[]>([])
  const historyIndex = useRef(-1)

  const pushHistory = useCallback((text: string) => {
    // Remove any forward history
    historyStack.current = historyStack.current.slice(0, historyIndex.current + 1)
    // Push new state
    historyStack.current.push(text)
    // Limit size
    if (historyStack.current.length > MAX_HISTORY) {
      historyStack.current.shift()
    }
    historyIndex.current = historyStack.current.length - 1
  }, [])

  const undo = useCallback(() => {
    if (historyIndex.current > 0) {
      historyIndex.current--
      setInput(historyStack.current[historyIndex.current])
    }
  }, [setInput])

  const redo = useCallback(() => {
    if (historyIndex.current < historyStack.current.length - 1) {
      historyIndex.current++
      setInput(historyStack.current[historyIndex.current])
    }
  }, [setInput])

  // Refs for editor
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Keyboard binding for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        redo()
        return
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        undo()
        return
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

  // Engine Implementation
  const runEngine = useCallback((text: string) => {
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
    const { protectedText, entities } = protectKnownEntities(result)
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

    // 6. Auto Capital After .!? (if ON)
    if (autoCapital) {
      result = applyFormatWithProtection(result, (t) => {
        return t.replace(/(^|[.!?]\s+|\n+\s*)([a-z])/g, (_, punct, char) =>
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
      result = result.replace(/\n+/g, ' ')
    }

    // 9. Auto Fix Space (ALWAYS LAST)
    if (autoFixSpace) {
      const isCursorAtEnd = textareaRef.current ? (textareaRef.current.selectionEnd === text.length) : false
      if (isCursorAtEnd) {
        result = result
          .replace(/[ \t]{2,}/g, ' ')
          .replace(/\n{3,}/g, '\n\n')
          .trimStart()
      } else {
        result = result
          .replace(/[ \t]{2,}/g, ' ')
          .replace(/\n{3,}/g, '\n\n')
          .trim()
      }
    }

    // 9.5. Restore Known Entities
    result = restoreKnownEntities(result, entities)

    return result
  }, [findValue, replaceValue, smartReplaceMode, stripEnabled, removeLineBreak, formatMode, autoCapital, autoSentence, autoLowercase, autoFixSpace])

  // Live Auto-apply
  useEffect(() => {
    const processed = runEngine(input)

    if (processed !== input) {
      // Save cursor position
      const el = textareaRef.current
      const start = el ? el.selectionStart : null
      const end = el ? el.selectionEnd : null

      setInput(processed)

      if (el && start !== null && end !== null) {
        const offset = processed.length - input.length
        const newStart = start === input.length ? processed.length : Math.max(0, Math.min(processed.length, start + offset))
        const newEnd = end === input.length ? processed.length : Math.max(0, Math.min(processed.length, end + offset))

        requestAnimationFrame(() => {
          el.setSelectionRange(newStart, newEnd)
        })
      }

      // Debounced push history for typing
      const timer = setTimeout(() => {
        pushHistory(processed)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [input, runEngine, setInput, pushHistory])

  // Initial history push
  useEffect(() => {
    if (historyIndex.current === -1 && input) {
      pushHistory(input)
    }
  }, [input, pushHistory])

  const handleCopy = () => {
    navigator.clipboard.writeText(input)
  }

  const handlePaste = async () => {
    const text = await navigator.clipboard.readText()
    setInput(text)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Editor Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
            <Wand2 className="w-4 h-4" />
            V3.3 Engine
            <HelpIcon>{t("tutorialSuggestions")}</HelpIcon>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDictionaryModal(true)}
            className="font-mono text-[10px] bg-secondary text-muted-foreground border border-border px-2 py-1 rounded hover:text-foreground hover:border-muted-foreground transition-colors uppercase tracking-tighter font-bold cursor-pointer flex items-center gap-1"
            title="Buka Dictionary"
          >
            <Book className="w-3 h-3 text-primary" />
            <span>Dictionary</span>
          </button>
          <button
            onClick={handleCopy}
            className="font-mono text-[10px] bg-secondary text-muted-foreground border border-border px-2 py-1 rounded hover:text-foreground hover:border-muted-foreground transition-colors uppercase tracking-tighter font-bold cursor-pointer"
          >
            Salin
          </button>
          <button
            onClick={handlePaste}
            className="font-mono text-[10px] bg-secondary text-muted-foreground border border-border px-2 py-1 rounded hover:text-foreground hover:border-muted-foreground transition-colors uppercase tracking-tighter font-bold cursor-pointer"
          >
            Tempel
          </button>
          <button
            onClick={onClear}
            className="font-mono text-[10px] bg-secondary text-muted-foreground border border-border px-2 py-1 rounded hover:text-foreground hover:border-muted-foreground transition-colors uppercase tracking-tighter font-bold cursor-pointer"
          >
            Bersihkan
          </button>
        </div>
      </div>

      {/* Unified Editor */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm relative group">
        <div className="relative min-h-[300px]">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onBlur={() => {
              if (autoFixSpace) {
                const trimmed = input.trim()
                if (trimmed !== input) {
                  setInput(trimmed)
                }
              }
            }}
            placeholder={t("inputPlaceholder")}
            className="w-full h-full min-h-[300px] p-6 bg-transparent border-none outline-none font-mono text-sm leading-relaxed text-foreground resize-none placeholder:text-muted-foreground relative z-30 scrollbar-thin"
          />
        </div>
      </div>

      {/* Control Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-secondary/20 p-6 rounded-2xl border border-border">
        {/* Left Col: Replacement & Selection */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-1">
              Find
              <HelpIcon>{t("filterFindLabel")}</HelpIcon>
            </label>
            <input
              type="text"
              value={findValue}
              onChange={(e) => setFindValue(e.target.value)}
              className="w-full bg-card border border-border rounded-lg px-4 py-2.5 font-mono text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
              placeholder=". , ! a b kata"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-1">
              Replace
              <HelpIcon>{t("filterReplaceLabel")}</HelpIcon>
            </label>
            <input
              type="text"
              value={replaceValue}
              onChange={(e) => setReplaceValue(e.target.value)}
              className="w-full bg-card border border-border rounded-lg px-4 py-2.5 font-mono text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
              placeholder={t("filterReplacePlaceholder")}
            />
            {!findValue && replaceValue && (
              <span className="text-[10px] text-red-500 font-bold ml-1 flex items-center gap-1 animate-pulse">
                <AlertTriangle className="w-3 h-3" />
                {t("filterReplaceWarning")}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between bg-card/50 p-3 rounded-lg border border-border mt-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold uppercase text-muted-foreground">Smart Replace Mode</span>
              <HelpIcon>{t("filterDeterministic")}</HelpIcon>
            </div>
            <button
              onClick={() => setSmartReplaceMode(prev => prev === "format-preserving" ? "strict" : "format-preserving")}
              className={cn(
                "px-3 py-1.5 rounded-md font-mono text-[10px] font-bold uppercase transition-all",
                smartReplaceMode === "format-preserving" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              )}
            >
              {smartReplaceMode === "format-preserving" ? "Format-Preserving" : "Strict"}
            </button>
          </div>
        </div>

        {/* Right Col: Toggles & Formats */}
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-center gap-3 p-3 rounded-lg bg-card/50 border border-border cursor-pointer hover:bg-card transition-colors select-none">
              <input
                type="checkbox"
                checked={stripEnabled}
                onChange={(e) => setStripEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <div className="flex items-center gap-1">
                <span className="font-mono text-xs font-bold uppercase">Add Strip</span>
                <HelpIcon>{t("filterAddStrip")}</HelpIcon>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-lg bg-card/50 border border-border cursor-pointer hover:bg-card transition-colors select-none">
              <input
                type="checkbox"
                checked={removeLineBreak}
                onChange={(e) => setRemoveLineBreak(e.target.checked)}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <div className="flex items-center gap-1">
                <span className="font-mono text-xs font-bold uppercase">No Break</span>
                <HelpIcon>{t("filterNoBreak")}</HelpIcon>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-lg bg-card/50 border border-border cursor-pointer hover:bg-card transition-colors select-none">
              <input
                type="checkbox"
                checked={autoCapital}
                onChange={(e) => setAutoCapital(e.target.checked)}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <div className="flex items-center gap-1">
                <span className="font-mono text-xs font-bold uppercase whitespace-nowrap">Auto Capital</span>
                <HelpIcon>{t("filterAutoCapital")}</HelpIcon>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-lg bg-card/50 border border-border cursor-pointer hover:bg-card transition-colors select-none">
              <input
                type="checkbox"
                checked={autoLowercase}
                onChange={(e) => setAutoLowercase(e.target.checked)}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <div className="flex items-center gap-1">
                <span className="font-mono text-xs font-bold uppercase whitespace-nowrap">Auto Lower</span>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-lg bg-card/50 border border-border cursor-pointer hover:bg-card transition-colors select-none">
              <input
                type="checkbox"
                checked={autoSentence}
                onChange={(e) => setAutoSentence(e.target.checked)}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <div className="flex items-center gap-1">
                <span className="font-mono text-xs font-bold uppercase whitespace-nowrap">Auto Sentence</span>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-lg bg-card/50 border border-border cursor-pointer hover:bg-card transition-colors select-none">
              <input
                type="checkbox"
                checked={autoFixSpace}
                onChange={(e) => setAutoFixSpace(e.target.checked)}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <div className="flex items-center gap-1">
                <span className="font-mono text-xs font-bold uppercase whitespace-nowrap">Auto Fix Space</span>
              </div>
            </label>
          </div>

          <div className="flex flex-col gap-2">
            <label className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-1">
              Format Huruf
              <HelpIcon>{t("filterFormatLabel")}</HelpIcon>
            </label>
            <select
              value={formatMode}
              onChange={(e) => setFormatMode(e.target.value as FormatMode)}
              className="w-full bg-card border border-border rounded-lg px-4 py-2.5 font-mono text-xs focus:ring-1 focus:ring-primary outline-none transition-all cursor-pointer"
            >
              <option value="none">None</option>
              <option value="sentence">Sentence case</option>
              <option value="lower">lowercase</option>
              <option value="upper">UPPERCASE</option>
              <option value="capitalize">Capitalize Each Word</option>
              <option value="toggle">Toggle Case</option>
            </select>
          </div>
        </div>
      </div>

      {/* Dictionary Modal */}
      <DictionaryModal open={showDictionaryModal} onOpenChange={setShowDictionaryModal} />

      {/* Footer Badge */}
      <div className="flex items-center justify-end text-[10px] text-muted-foreground font-mono uppercase tracking-[0.2em] px-1 opacity-60">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3 h-3 text-primary" />
          <span>100% Deterministic Engine</span>
        </div>
      </div>
    </div>
  )
}
