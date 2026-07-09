"use client"

import React, { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect } from "react"
import { useLanguage } from "./language-provider"
import { Drawer } from "vaul"
import { HelpIcon } from "./ui/help-icon"
import { cn } from "@/lib/utils"
import { useTheme } from "next-themes"
import {
  applyFormatWithProtection,
  applySentenceCase,
  formatPreservingReplace,
  getRepeatedWordsIndices,
  numberToIndonesianWords,
  wordsToNumber,
} from "@/lib/text-utils"
import { TranslationKey } from "@/lib/translations"
import { Info, HelpCircle, AlertTriangle, Sparkles, Wand2 } from "lucide-react"

interface FilterCustomProps {
  input: string
  setInput: (val: string) => void
  onClear: () => void
}

type FormatMode = "none" | "sentence" | "lower" | "upper" | "capitalize" | "toggle"
type SmartReplaceMode = "format-preserving" | "strict"


export function FilterCustom({ input, setInput, onClear }: FilterCustomProps) {
  const { t } = useLanguage()
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

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

  // Interaction States
  const [activeToken, setActiveToken] = useState<{ word: string, start: number, end: number } | null>(null)
  const [batchSelected, setBatchSelected] = useState<{ word: string, start: number, end: number }[]>([])
  const [batchEditEnabled, setBatchEditEnabled] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 })
  const [replaceTokenInput, setReplaceTokenInput] = useState("")

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

  const [ctrlDragStart, setCtrlDragStart] = useState<number | null>(null)
  const [showMobileSheet, setShowMobileSheet] = useState(false)
  const [isTouchDevice, setIsTouchDevice] = useState(false)
  const pressTimer = useRef<NodeJS.Timeout | null>(null)
  const touchStartPos = useRef<{ x: number, y: number } | null>(null)
  const [isScrolling, setIsScrolling] = useState(false)

  // Refs for editor
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setMounted(true)
    setIsTouchDevice(
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0
    )
  }, [])

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

  const TOKEN_REGEX = /[^a-zA-Z0-9]*[a-zA-Z0-9]+[^a-zA-Z0-9]*/g

  const splitToken = (token: string) => {
    const match = token.match(/^([^a-zA-Z0-9]*)([a-zA-Z0-9]+)([^a-zA-Z0-9]*)$/)
    if (!match) return { leading: '', core: token, trailing: '' }
    return {
      leading: match[1],
      core: match[2],
      trailing: match[3]
    }
  }

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

    // 2. Add Strip
    if (stripEnabled) {
      // Improved Add Strip: Udah udah -> Udah-udah
      result = result.replace(/\b([a-zA-Z0-9]+)\s+\1\b/gi, (match, word1) => {
        // Result = word1 + "-" + lowercase(word2)
        // Here match is "word1 word2" where word1 === word2 (case insensitive)
        const words = match.split(/\s+/)
        return words[0] + '-' + words[1].toLowerCase()
      })
    }

    // 3. Remove Line Break
    if (removeLineBreak) {
      result = result.replace(/\n+/g, ' ')
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

    // 5. Smart Replace (Placeholder for existing UI consistency if needed, though Find/Replace is already there)

    // 6. Auto Capital After .!? (if ON)
    if (autoCapital) {
      result = applyFormatWithProtection(result, (t) => {
        return t.replace(/([.!?]\s+)([a-z])/g, (_, punct, char) =>
          punct + char.toUpperCase()
        )
      })
    }

    // 7. Auto Sentence Case (if ON)
    if (autoSentence) {
      result = applySentenceCase(result)
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

    // 9. Auto Fix Space (ALWAYS LAST)
    if (autoFixSpace) {
      const isCursorAtEnd = textareaRef.current ? (textareaRef.current.selectionEnd === text.length) : false
      if (isCursorAtEnd) {
        // Jangan trim() trailing whitespace di akhir jika kursor sedang aktif di sana
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

    return result
  }, [findValue, replaceValue, smartReplaceMode, stripEnabled, removeLineBreak, formatMode, autoCapital, autoSentence, autoLowercase, autoFixSpace])

  // Live Auto-apply
  const lastInput = useRef(input)
  const isInternalUpdate = useRef(false)

  useEffect(() => {
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false
      return
    }

    const processed = runEngine(input)
    if (processed !== input) {
      // Save cursor position
      const el = textareaRef.current
      const start = el ? el.selectionStart : null
      const end = el ? el.selectionEnd : null

      isInternalUpdate.current = true
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

  // Sync editor with engine result (optional, but requested by VISION: single editor)
  // We apply the transformation when requested or auto-apply?
  // Let's have a button "Apply Transformations" or just live update?
  // VISION says "Everything happens in one unified editor space."
  // For now, let's show the result and allow "Sync to Editor" or auto-apply if toggled.
  // Given the "Text Processing Engine" description, we'll make it live update.

  const handleCopy = () => {
    navigator.clipboard.writeText(input)
  }

  const handlePaste = async () => {
    const text = await navigator.clipboard.readText()
    setInput(text)
  }

  const getTokenInfoAtPos = (pos: number) => {
    const matches = Array.from(input.matchAll(TOKEN_REGEX))
    for (const match of matches) {
      const start = match.index!
      const end = start + match[0].length
      if (pos >= start && pos <= end) {
        return { word: match[0], start, end }
      }
    }
    return null
  }

  const [isCtrlDragging, setIsCtrlDragging] = useState(false)
  const [ctrlDragStartPos, setCtrlDragStartPos] = useState<number | null>(null)

  const isValidTokenClick = useCallback((pos: number) => {
    const info = getTokenInfoAtPos(pos)
    if (!info) return false
    const text = info.word || ''
    if (/^\s*$/.test(text)) return false
    return true
  }, [input])

  const closeSuggestionPanel = useCallback(() => {
    setPopoverOpen(false)
    setActiveToken(null)
    setBatchSelected([])
  }, [])

  const getSmartPosition = (tokenRect: { top: number, bottom: number, left: number, right: number }, popupWidth: number, popupHeight: number) => {
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    }

    const MARGIN = 8

    let top = tokenRect.bottom + MARGIN
    let left = tokenRect.left

    // Flip vertical: not enough space below → show above
    if (top + popupHeight > viewport.height - MARGIN) {
      top = tokenRect.top - popupHeight - MARGIN
    }

    // Flip horizontal: not enough space on right → shift left
    if (left + popupWidth > viewport.width - MARGIN) {
      left = viewport.width - popupWidth - MARGIN
    }

    // Never go off left edge
    if (left < MARGIN) left = MARGIN

    // Never go off top edge
    if (top < MARGIN) top = MARGIN

    return { top, left }
  }

  const panelRef = useRef<HTMLDivElement>(null)

  const selectAllIdenticalTokens = useCallback((word: string) => {
    const matches: { word: string, start: number, end: number }[] = []
    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Match word with surrounding punctuation if needed, or just core?
    // Usually "identical tokens" means the whole token including punct.
    const regex = new RegExp(`(?<=\\s|^)${escapedWord}(?=\\s|$)`, 'g')
    let match
    while ((match = regex.exec(input)) !== null) {
      matches.push({ word: match[0], start: match.index, end: match.index + match[0].length })
    }
    setBatchSelected(matches)
  }, [input])

  const handleEditorClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLTextAreaElement
    const pos = target.selectionStart

    if (!isValidTokenClick(pos)) {
      closeSuggestionPanel()
      return
    }

    if (e.altKey) return // handled by mousedown

    const info = getTokenInfoAtPos(pos)!
    setActiveToken(info)
    setReplaceTokenInput(info.word)

    const tokenRect = {
      bottom: e.clientY,
      top: e.clientY,
      left: e.clientX,
      right: e.clientX
    }

    const pos_smart = getSmartPosition(tokenRect, 320, 400)
    setPopoverPosition(pos_smart)
    setPopoverOpen(true)
  }

  const handleEditorMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLTextAreaElement
    const pos = target.selectionStart

    // ALT + Click → batch select
    if (e.altKey) {
      e.preventDefault()
      const info = getTokenInfoAtPos(pos)
      if (info) {
        selectAllIdenticalTokens(info.word)
        setActiveToken(info)
        const tokenRect = { bottom: e.clientY, top: e.clientY, left: e.clientX, right: e.clientX }
        const pos_smart = getSmartPosition(tokenRect, 320, 400)
        setPopoverPosition(pos_smart)
        setPopoverOpen(true)
      }
      return
    }

    // CTRL + mousedown → start range selection
    if (e.ctrlKey) {
      e.preventDefault()
      const info = getTokenInfoAtPos(pos)
      if (info) {
        setCtrlDragStartPos(pos)
        setIsCtrlDragging(true)
      }
      return
    }
  }

  const handleEditorMouseMove = (e: React.MouseEvent) => {
    if (isCtrlDragging && e.ctrlKey) {
      // visual feedback could be implemented here
    }
  }

  const handleEditorMouseUp = (e: React.MouseEvent) => {
    if (isCtrlDragging) {
      setIsCtrlDragging(false)
      const target = e.target as HTMLTextAreaElement
      const endPos = target.selectionEnd
      if (ctrlDragStartPos !== null) {
        const start = Math.min(ctrlDragStartPos, endPos)
        const end = Math.max(ctrlDragStartPos, endPos)

        const matches: { word: string, start: number, end: number }[] = []
        const tokenMatches = Array.from(input.matchAll(TOKEN_REGEX))
        for (const m of tokenMatches) {
          if (m.index! >= start && m.index! + m[0].length <= end) {
            matches.push({ word: m[0], start: m.index!, end: m.index! + m[0].length })
          }
        }

        if (matches.length > 0) {
          setBatchSelected(matches)
          setActiveToken(matches[0])
          const tokenRect = { bottom: e.clientY, top: e.clientY, left: e.clientX, right: e.clientX }
          const pos_smart = getSmartPosition(tokenRect, 320, 400)
          setPopoverPosition(pos_smart)
          setPopoverOpen(true)
        }
      }
      setCtrlDragStartPos(null)
    }
  }

  const handleEditorDoubleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLTextAreaElement
    const pos = target.selectionStart
    const info = getTokenInfoAtPos(pos)
    if (info) {
      selectAllIdenticalTokens(info.word)
      setActiveToken(info)
      const tokenRect = { bottom: e.clientY, top: e.clientY, left: e.clientX, right: e.clientX }
      const pos_smart = getSmartPosition(tokenRect, 320, 400)
      setPopoverPosition(pos_smart)
      setPopoverOpen(true)
    }
  }

  const handleEditorTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length >= 2) return
    const touch = e.touches[0]
    touchStartPos.current = { x: touch.clientX, y: touch.clientY }
    setIsScrolling(false)

    const target = e.target as HTMLTextAreaElement
    const pos = target.selectionStart
    const tokenInfo = getTokenInfoAtPos(pos)

    if (tokenInfo) {
      pressTimer.current = setTimeout(() => {
        if ('vibrate' in navigator) navigator.vibrate(30)
        selectAllIdenticalTokens(tokenInfo.word)
        setActiveToken(tokenInfo)
        setReplaceTokenInput(tokenInfo.word)
        setPopoverOpen(true)
      }, 500)
    }
  }

  const handleEditorTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPos.current) return
    const touch = e.touches[0]
    const dx = Math.abs(touch.clientX - touchStartPos.current.x)
    const dy = Math.abs(touch.clientY - touchStartPos.current.y)
    if (dx > 10 || dy > 10) {
      setIsScrolling(true)
      if (pressTimer.current) clearTimeout(pressTimer.current)
    }
  }

  const handleEditorTouchEnd = (e: React.TouchEvent) => {
    if (pressTimer.current) clearTimeout(pressTimer.current)

    if (isTouchDevice && !isScrolling) {
      const target = e.target as HTMLTextAreaElement
      const pos = target.selectionStart
      const tokenInfo = getTokenInfoAtPos(pos)

      if (!tokenInfo) {
        setShowMobileSheet(false)
        setBatchSelected([])
        setActiveToken(null)
        return
      }

      if (batchEditEnabled) {
        selectAllIdenticalTokens(tokenInfo.word)
      } else {
        setBatchSelected([tokenInfo])
      }

      setActiveToken(tokenInfo)
      setReplaceTokenInput(tokenInfo.word)
      setShowMobileSheet(true)
    }
  }

  const applyReplacement = useCallback((newWord: string) => {
    if (!activeToken) return
    let newText = input

    if (batchSelected.length > 1) {
      // Sort matches in reverse to avoid index shifting
      const sortedMatches = [...batchSelected].sort((a, b) => b.start - a.start)
      for (const m of sortedMatches) {
        newText = newText.substring(0, m.start) + newWord + newText.substring(m.end)
      }
    } else {
      newText = newText.substring(0, activeToken.start) + newWord + newText.substring(activeToken.end)
    }

    setInput(newText)
    pushHistory(newText)
    setPopoverOpen(false)
    setShowMobileSheet(false)
    setBatchSelected([])
    setActiveToken(null)
  }, [input, activeToken, batchSelected, setInput, pushHistory])

  const deleteToken = useCallback((token: { word: string, start: number, end: number }) => {
    let newText = input.substring(0, token.start) + input.substring(token.end)
    // normalize spaces
    newText = newText.replace(/\s{2,}/g, ' ').trim()
    setInput(newText)
    pushHistory(newText)
    setPopoverOpen(false)
    setShowMobileSheet(false)
    setActiveToken(null)
    setBatchSelected([])
  }, [input, setInput, pushHistory])

  const getAlgoSuggestions = useCallback((token: string) => {
    const { leading, core, trailing } = splitToken(token)
    const suggestions: { category: string, text: string, reason: string }[] = []

    // Kategori 1: Format
    const formatSuggestions = [
      { text: leading + core.toLowerCase() + trailing, reason: 'lowercase' },
      { text: leading + core.toUpperCase() + trailing, reason: 'UPPERCASE' },
      { text: leading + core[0].toUpperCase() + core.slice(1).toLowerCase() + trailing, reason: 'Capitalize' },
    ].filter(s => s.text !== leading + core + trailing)

    formatSuggestions.forEach(s => suggestions.push({ category: "Format", ...s }))

    // Kategori 2: Tanda Baca — Tambah
    const puncts = ['.', ',', '!', '?']
    puncts
      .filter(p => p !== trailing)
      .forEach(p => suggestions.push({
        category: "Tanda Baca",
        text: leading + core + p,
        reason: `tambah ${p}`
      }))

    // Kategori 3: Tanda Baca — Hapus
    if (trailing || leading) {
      suggestions.push({
        category: "Tanda Baca",
        text: core,
        reason: 'hapus tanda baca'
      })
    }

    // Kategori 6: Angka ⇄ Terbilang
    if (/^\d+$/.test(core)) {
      suggestions.push({ category: "Angka", text: leading + numberToIndonesianWords(core) + trailing, reason: 'terbilang' })
    } else {
      const asNumber = wordsToNumber(core)
      if (asNumber !== null) {
        suggestions.push({ category: "Angka", text: leading + String(asNumber) + trailing, reason: 'ke angka' })
      }
    }

    return suggestions
  }, [])

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
            onClick={handleEditorClick}
            onMouseDown={handleEditorMouseDown}
            onMouseUp={handleEditorMouseUp}
            onTouchStart={handleEditorTouchStart}
            onTouchMove={handleEditorTouchMove}
            onTouchEnd={handleEditorTouchEnd}
            placeholder={t("inputPlaceholder")}
            className="w-full h-full min-h-[300px] p-6 bg-transparent border-none outline-none font-mono text-sm leading-relaxed text-foreground resize-none placeholder:text-muted-foreground relative z-30 scrollbar-thin"
          />
        </div>

        {/* Custom Suggestion Panel */}
        {popoverOpen && activeToken && (
          <div
            ref={panelRef}
            className="fixed z-[100] w-80 shadow-2xl bg-card border border-border overflow-hidden rounded-xl animate-in fade-in zoom-in duration-200"
            style={{
              top: popoverPosition.top,
              left: popoverPosition.left,
            }}
          >
            <div className={cn("px-4 py-3 border-b border-border flex items-center justify-between", batchSelected.length > 1 ? "bg-yellow-500/5" : "bg-primary/5")}>
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest leading-none mb-1">
                  Token:
                </span>
                <span className="font-mono text-sm font-bold text-primary leading-none">
                  {activeToken.word}
                </span>
              </div>
              {batchSelected.length > 1 && (
                <span className="text-[10px] font-bold uppercase bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded-full">
                  {batchSelected.length} match
                </span>
              )}
              <button onClick={closeSuggestionPanel} className="text-muted-foreground hover:text-foreground">
                <span className="sr-only">Close</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-3 flex flex-col gap-3 max-h-80 overflow-y-auto scrollbar-thin">
              {/* Category 4: Replace (Direct Edit) */}
              <div className="flex flex-col gap-1.5 pb-2 border-b border-border/50">
                <p className="text-[9px] font-bold text-slate-400 uppercase px-1">Replace</p>
                <div className="flex gap-2">
                  <input
                    autoFocus
                    type="text"
                    value={replaceTokenInput}
                    onChange={(e) => setReplaceTokenInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && applyReplacement(replaceTokenInput)}
                    className="flex-1 bg-secondary border border-border rounded-lg px-2 py-1.5 font-mono text-xs outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Ganti dengan..."
                  />
                  <button
                    onClick={() => applyReplacement(replaceTokenInput)}
                    className="bg-yellow-400 text-black px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase hover:bg-yellow-500 transition-colors"
                  >
                    OK
                  </button>
                </div>
              </div>

              {/* Algorithm Suggestions grouped by category */}
              {Object.entries(
                getAlgoSuggestions(activeToken.word).reduce((acc, s) => {
                  if (!acc[s.category]) acc[s.category] = []
                  acc[s.category].push(s)
                  return acc
                }, {} as Record<string, any[]>)
              ).map(([category, items]) => (
                <div key={category} className="flex flex-col gap-1">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase px-1">{category}</p>
                  {items.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => applyReplacement(s.text)}
                      className="w-full text-left px-3 py-1.5 bg-secondary/30 hover:bg-primary/5 rounded font-mono text-xs flex justify-between items-center transition-colors group"
                    >
                      <span>{s.text}</span>
                      <span className="text-[9px] text-muted-foreground opacity-70 group-hover:opacity-100">{s.reason}</span>
                    </button>
                  ))}
                </div>
              ))}

              {/* Category 5: Delete Token */}
              <div className="pt-1 mt-1 border-t border-border/50">
                <button
                  onClick={() => deleteToken(activeToken)}
                  className="w-full py-2 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-lg text-xs font-bold uppercase hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors flex items-center justify-center gap-2"
                >
                  ❌ Hapus kata
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mobile Bottom Sheet (Vaul) */}
        <Drawer.Root open={showMobileSheet} onOpenChange={setShowMobileSheet}>
          <Drawer.Portal>
            <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50" />
            <Drawer.Content className="bg-card flex flex-col rounded-t-[20px] h-auto max-h-[85vh] fixed bottom-0 left-0 right-0 z-50 outline-none border-t border-border shadow-2xl">
              <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-muted-foreground/20 my-4" />

              <div className="p-4 pt-0 overflow-y-auto scrollbar-none">

                <div className="flex flex-col gap-4 pb-8">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex flex-col">
                       <span className="text-[10px] text-muted-foreground uppercase tracking-widest leading-none mb-1">Token:</span>
                       <span className="font-mono text-lg font-bold text-primary leading-none">{activeToken?.word}</span>
                    </div>
                    {batchEditEnabled && (
                      <span className="text-xs font-bold uppercase bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 px-3 py-1 rounded-full">
                        {batchSelected.length} match
                      </span>
                    )}
                  </div>

                  {batchEditEnabled && (
                    <div className="flex flex-col gap-2 p-1">
                      <p className="text-[10px] font-bold text-yellow-600 uppercase">Manual Edit</p>
                      <div className="flex gap-3">
                        <input
                          type="text"
                          value={replaceTokenInput}
                          onChange={(e) => setReplaceTokenInput(e.target.value)}
                          className="flex-1 bg-secondary border border-border rounded-xl px-4 py-3 font-mono text-sm outline-none focus:ring-1 focus:ring-primary"
                        />
                        <button
                          onClick={() => applyReplacement(replaceTokenInput)}
                          className="bg-primary text-primary-foreground px-6 py-3 rounded-xl text-sm font-bold uppercase"
                        >
                          OK
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="h-px bg-border/50" />

                  {activeToken && (
                    <>
                      {/* Mobile Replace */}
                      <div className="flex flex-col gap-2 p-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Replace</p>
                        <div className="flex gap-3">
                          <input
                            type="text"
                            value={replaceTokenInput}
                            onChange={(e) => setReplaceTokenInput(e.target.value)}
                            className="flex-1 bg-secondary border border-border rounded-xl px-4 py-3 font-mono text-sm outline-none focus:ring-1 focus:ring-primary"
                            placeholder="Ganti dengan..."
                          />
                          <button
                            onClick={() => applyReplacement(replaceTokenInput)}
                            className="bg-yellow-400 text-black px-6 py-3 rounded-xl text-sm font-bold uppercase"
                          >
                            OK
                          </button>
                        </div>
                      </div>

                      <div className="h-px bg-border/50" />

                      {/* Algorithm Suggestions grouped by category */}
                      {Object.entries(
                        getAlgoSuggestions(activeToken.word).reduce((acc, s) => {
                          if (!acc[s.category]) acc[s.category] = []
                          acc[s.category].push(s)
                          return acc
                        }, {} as Record<string, any[]>)
                      ).map(([category, items]) => (
                        <div key={category} className="flex flex-col gap-2">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{category}</p>
                          <div className="grid grid-cols-1 gap-2">
                            {items.map((s, i) => (
                              <button
                                key={i}
                                onClick={() => applyReplacement(s.text)}
                                className="w-full text-left px-4 py-3 bg-secondary/50 active:bg-secondary rounded-xl font-mono text-sm flex justify-between items-center transition-all border border-border/50"
                              >
                                <span>{s.text}</span>
                                <span className="text-xs text-muted-foreground opacity-60">{s.reason}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}


                      <div className="pt-2 border-t border-border/30 flex flex-col gap-2">
                        <button
                          onClick={() => deleteToken(activeToken)}
                          className="w-full py-4 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-xl font-bold text-sm uppercase transition-all"
                        >
                          ❌ Hapus kata
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="p-4 pt-2 border-t border-border bg-card">
                 <button
                  onClick={() => setShowMobileSheet(false)}
                  className="w-full py-4 bg-secondary text-muted-foreground font-bold rounded-xl active:scale-[0.98] transition-transform"
                 >
                   Tutup
                 </button>
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>

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

              <label className="flex items-center gap-3 p-3 rounded-lg bg-card/50 border border-border cursor-pointer hover:bg-card transition-colors select-none">
                <input
                  type="checkbox"
                  checked={batchEditEnabled}
                  onChange={(e) => setBatchEditEnabled(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                <div className="flex items-center gap-1">
                  <span className="font-mono text-xs font-bold uppercase whitespace-nowrap">Batch Edit</span>
                  <HelpIcon>
                    Batch Edit
                    {"\n"}Aktifkan untuk mengedit semua kata identik sekaligus.
                    {"\n"}Klik kata → semua yang sama terpilih → edit satu → semua berubah.
                    {"\n"}Tanpa Batch Edit: ALT+Click untuk select massal.
                  </HelpIcon>
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

      {/* Shortcuts Hint */}
      <div className="flex flex-wrap items-center gap-6 text-[10px] text-muted-foreground font-mono uppercase tracking-[0.2em] px-1 opacity-60">
        <div className="flex items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 rounded bg-secondary border border-border">ALT</kbd>
          <span>+ CLICK: Batch Select</span>
          <HelpIcon>{t("tutorialAltClick")}</HelpIcon>
        </div>
        <div className="flex items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 rounded bg-secondary border border-border">CTRL</kbd>
          <span>+ Drag: Range</span>
          <HelpIcon>{t("tutorialCtrlDrag")}</HelpIcon>
        </div>
        <div className="flex items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 rounded bg-secondary border border-border">Click</kbd>
          <span>: Suggestion</span>
          <HelpIcon>{t("tutorialSuggestions")}</HelpIcon>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Sparkles className="w-3 h-3 text-primary" />
          <span>100% Deterministic Engine</span>
        </div>
      </div>
    </div>
  )
}
