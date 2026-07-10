export type Language = "id" | "en" | "zh"

export const translations = {
  id: {
    // Header
    appName: "DingTag Annotation tool",
    tagline: "Fast Text Processing for Annotation & QC",
    
    // Form
    inputLabel: "input",
    inputHint: "gunakan",
    inputHintSuffix: "sebagai penanda jeda suara",
    inputPlaceholder: "mbaknya bilang akun dananya kena freeze\\\\ lah gimana coba gue\\",
    outputLabel: "hasil",
    outputPlaceholder: "hasil akan muncul di sini...",
    charCount: "karakter",
    
    // Buttons
    processButton: "Proses",
    flatTextButton: "Teks Datar",
    processingButton: "Memproses...",
    copyButton: "salin",
    editButton: "edit ulang",
    clearButton: "bersihkan",
    pasteButton: "tempel",
    insertPromptButton: "Insert Prompt",
    promptCopied: "Tersalin!",
    
    // Status
    statusReady: "siap",
    statusProcessing: "memproses...",
    statusDone: "selesai",
    statusCopied: "tersalin ke clipboard",
    statusMoved: "teks dipindah ke input",
    statusEmptyInput: "input kosong",
    statusCopyFailed: "gagal menyalin",
    statusError: "Terjadi kesalahan",
    statusNoFilter: "Tidak ada filter atau format yang dipilih",
    
    // Scoring
    accuracyScore: "Skor Akurasi",
    showDiff: "Lihat Detail Perbedaan",
    perfectScore: "Sempurna!",
    goodScore: "Bagus, periksa sedikit.",
    lowScore: "Banyak ketidaksesuaian.",

    // Model selector
    modelLabel: "model",
    modelGroq: "Groq (Llama 3.3)",
    modelGoogle: "Google Gemini",
    modelAiml: "Gemma 3 (AIML API)",
    modelOpenRouter: "Llama 3.3 (OpenRouter Free)",

    // Mode
    modeLabel: "Mode Transkripsi",
    biasaTitle: "Mode Biasa",
    biasaDesc: "Koreksi tanda baca & EYD standar tanpa metode backslash.",
    v1Title: "V1 — Standar",
    v1Desc: "Proses langsung. Cepat, tanpa validasi tambahan.",
    v2Title: "V2.2 — Beta",
    v2Desc: "Proses + validasi + algorithmic fixer otomatis. Lebih akurat, sedikit lebih lambat.",
    v3Title: "Filter Custom",
    v3Desc: "Hapus elemen tertentu atau ubah format teks secara manual.",
    tagAnnotator: "[Recommended for Annotator]",
    tagQC: "[Recommended for QC]",
    tagLessRecommended: "[Less Recommended for Annotation]",
    tagRecommended: "[Recommended for Annotation]",

    // Tutorial Popup
    tutorialTitle: "Cara pakai metode Backslash",
    tutorialBody: "Mode ini menggunakan tanda \\ untuk jeda pendek dan \\\\ untuk jeda panjang.\n\nKetik atau paste transkripsi, lalu tambahkan \\ (jeda pendek) atau \\\\ (jeda panjang) di setiap posisi jeda. Penentuan tanda baca akan diproses otomatis oleh AI berdasarkan prioritas EYD dan durasi jeda.\n\nContoh:\nInput: gue lagi di warung\\\\ mau beli nasi uduk\\ abis deh\\\nOutput: Gue lagi di warung. Mau beli nasi uduk, abis deh.",
    tutorialButton: "Mengerti",

    tutorialModeBiasa: "Mode Biasa\nTombol Proses bekerja seperti AI pada umumnya, tanpa perlu prompt manual — lebih cepat digunakan.\n\nFlat Text:\nMenghapus kapitalisasi, tanda baca, dan simbol → menghasilkan teks polos (clean text)",
    tutorialModeV1: "Mode V1\nBasic annotation processing.\n\nFlat Text:\nMenghapus kapitalisasi, tanda baca, dan simbol → menghasilkan teks polos (clean text)",
    tutorialModeV2: "Mode V2 — Rekomendasi untuk Annotator\n\n🎧 Audio:\n- Gunakan kecepatan 1x (normal)\n- Usahakan audio hanya didengarkan 1 kali\n- Fokus pada: perbaikan typing & penandaan jeda (\\ atau \\\\)\n\n⚡ Workflow Cepat:\n- Setelah output keluar → langsung submit\n- Tidak perlu re-check ulang\n- Tujuan: maksimalkan kecepatan anotasi\n\n⚠️ Kondisi Khusus:\n- Jika output AI ditandai merah:\n  → lakukan pengecekan ulang\n  → gunakan kecepatan 2x (double speed)\n\n🧠 Intinya:\nDefault: speed over perfection\nException: kalau flagged → baru audit",
    tutorialFlatText: "Flat Text\nMenghapus semua format dari teks:\n- Kapitalisasi → dihilangkan\n- Tanda baca → dihapus\n- Simbol → dihapus\n\n→ Hasil: teks bersih tanpa formatting",

    v2BadgeProcessing: "memproses...",
    v2BadgeValid: "✓ valid",
    v2BadgeFixed_algo: "✓ difix otomatis",
    v2BadgeFixed_warning: "⚠ difix otomatis · cek kata",
    v2BadgeError: "✗ perlu review",
    v2FixerTitle: "Perubahan oleh fixer",
    v2Warning: "Peringatan: jumlah kata berubah. Hasil perlu dicek ulang.",
    v2MissingWords: "⚠ Beberapa kata dari input hilang/berubah.",
    filterFindLabel: "Masukkan target yang ingin dihapus atau diganti.\nPisahkan dengan spasi untuk multiple target.\nJika Replace kosong → target dihapus.\nJika Replace diisi → target diganti.\nCase-sensitive (Aku ≠ aku).",
    filterReplaceLabel: "Target pengganti untuk Find.",
    filterReplacePlaceholder: "Ganti dengan...",
    filterReplaceWarning: "Replace butuh Find terisi",
    filterAddStrip: "Mengubah kata berulang menjadi kata berulang berstrip.\nContoh: kata kata → kata-kata\nBerlaku juga untuk: teman teman → teman-teman",
    filterFormatLabel: "Format Huruf:\n- Sentence case\n- lowercase\n- UPPERCASE\n- Capitalize Each Word\n- Toggle Case\n\nAkronim (KTP, NPWP) akan terlindungi.",
    filterReplaceAllWith: "Ganti semua \"{part}\" dengan:",
    filterDeterministic: "Format-Preserving (default):\n  Menjaga kapitalisasi dan tanda baca asli.\n  Aku → Aki, AKU → AKI, aku → aki\n\nCase Sensitive Strict:\n  Hanya mengganti exact match.",
    filterNoBreak: "Menghapus semua enter/newline.\nSeluruh teks menjadi satu paragraf.",
    filterAutoCapital: "Setelah tanda . ! ? → huruf berikutnya otomatis kapital.\nAkronim (KTP, KRIS) tetap terlindungi.",
    tutorialAltClick: "Klik token sambil tahan ALT.\nSemua token identik akan terpilih.\nEdit satu → semua berubah (batch edit).",
    tutorialCtrlDrag: "Tahan CTRL + drag untuk blok area tertentu.\nPerubahan hanya berlaku di area yang dipilih.",
    tutorialSuggestions: "AI sebagai alat bedah, bukan otak.\nPresisi. Terbatas. Terkendali.\n\nHanya muncul jika terdeteksi anomali (typo, angka, tanda baca kurang).",
    filterNoAi: "Tanpa AI",
    filterRealtime: "Real-time",
    footerSignature: "for AIT from Fadhil Ghifarion 法迪",

    // Footer
    footerInstructions: "cara pakai: ketik transkripsi → tandai jeda suara dengan",
    footerInstructionsSuffix: "→ klik proses",
    footerPoweredBy: "gratis. ganti model jika limit.",
  },
  en: {
    // Header
    appName: "DingTag Annotation tool",
    tagline: "Fast Text Processing for Annotation & QC",
    
    // Form
    inputLabel: "input",
    inputHint: "use",
    inputHintSuffix: "as pause marker",
    inputPlaceholder: "she said the account got frozen\\\\ so what am I supposed to do now\\",
    outputLabel: "result",
    outputPlaceholder: "result will appear here...",
    charCount: "characters",
    
    // Buttons
    processButton: "Process",
    flatTextButton: "Flat Text",
    processingButton: "Processing...",
    copyButton: "copy",
    editButton: "edit again",
    clearButton: "clear",
    pasteButton: "paste",
    insertPromptButton: "Insert Prompt",
    promptCopied: "Copied!",
    
    // Status
    statusReady: "ready",
    statusProcessing: "processing...",
    statusDone: "done",
    statusCopied: "copied to clipboard",
    statusMoved: "text moved to input",
    statusEmptyInput: "input is empty",
    statusCopyFailed: "failed to copy",
    statusError: "An error occurred",
    statusNoFilter: "No filter or format selected",
    
    // Scoring
    accuracyScore: "Accuracy Score",
    showDiff: "Show Diff Details",
    perfectScore: "Perfect!",
    goodScore: "Good, check slightly.",
    lowScore: "Many inconsistencies.",

    // Model selector
    modelLabel: "model",
    modelGroq: "Groq (Llama 3.3)",
    modelGoogle: "Google Gemini",
    modelAiml: "Gemma 3 (AIML API)",
    modelOpenRouter: "Llama 3.3 (OpenRouter Free)",

    // Mode
    modeLabel: "Transcription Mode",
    biasaTitle: "Normal Mode",
    biasaDesc: "Standard punctuation & grammar correction without backslash method.",
    v1Title: "V1 — Standard",
    v1Desc: "Direct process. Fast, no additional validation.",
    v2Title: "V2.2 — Beta",
    v2Desc: "Process + validation + automatic algorithmic fixer. More accurate, slightly slower.",
    v3Title: "Custom Filter",
    v3Desc: "Remove specific elements or change text format manually.",
    tagAnnotator: "[Recommended for Annotator]",
    tagQC: "[Recommended for QC]",
    tagLessRecommended: "[Less Recommended for Annotation]",
    tagRecommended: "[Recommended for Annotation]",

    // Tutorial Popup
    tutorialTitle: "How to use the Backslash method",
    tutorialBody: "This mode uses the \\ sign for short pauses and \\\\ for long pauses.\n\nType or paste the transcription, then add \\ (short pause) or \\\\ (long pause) at each pause position — punctuation marks will be automatically determined by the AI based on grammar rules (EYD) and pause duration.\n\nExample:\nInput: i'm at the shop\\\\ want to buy breakfast\\ it's gone\\\nOutput: I'm at the shop. Want to buy breakfast, it's gone.",
    tutorialButton: "Understood",

    tutorialModeBiasa: "Normal Mode\nThe Process button works like standard AI, without needing manual prompts — faster to use.\n\nFlat Text:\nRemoves capitalization, punctuation, and symbols → produces plain text (clean text)",
    tutorialModeV1: "Mode V1\nBasic annotation processing.\n\nFlat Text:\nRemoves capitalization, punctuation, and symbols → produces plain text (clean text)",
    tutorialModeV2: "Mode V2 — Recommended for Annotators\n\n🎧 Audio:\n- Use 1x speed (normal)\n- Try to listen to the audio only once\n- Focus on: fixing typing & marking pauses (\\ or \\\\)\n\n⚡ Fast Workflow:\n- After output appears → submit immediately\n- No need to re-check\n- Goal: maximize annotation speed\n\n⚠️ Special Conditions:\n- If AI output is flagged red:\n  → perform a re-check\n  → use 2x speed (double speed)\n\n🧠 Key Point:\nDefault: speed over perfection\nException: if flagged → then audit",
    tutorialFlatText: "Flat Text\nRemoves all formatting from text:\n- Capitalization → removed\n- Punctuation → deleted\n- Symbols → deleted\n\n→ Result: clean text without formatting",

    v2BadgeProcessing: "processing...",
    v2BadgeValid: "✓ valid",
    v2BadgeFixed_algo: "✓ fixed (algo)",
    v2BadgeFixed_warning: "⚠ fixed (algo) · check words",
    v2BadgeError: "✗ needs review",
    v2FixerTitle: "Changes by fixer",
    v2Warning: "Warning: word count changed. Result may need manual check.",
    v2MissingWords: "⚠ Some words from input are missing/changed.",
    filterFindLabel: "Enter targets to delete or replace.\nSeparate with spaces for multiple targets.\nIf Replace is empty → target is deleted.\nIf Replace is filled → target is replaced.\nCase-sensitive (Aku ≠ aku).",
    filterReplaceLabel: "Replacement target for Find.",
    filterReplacePlaceholder: "Replace with...",
    filterReplaceWarning: "Replace requires Find to be filled",
    filterAddStrip: "Converts repeated words to hyphenated form.\nExample: kata kata → kata-kata\nAlso applies to: teman teman → teman-teman",
    filterFormatLabel: "Letter Format:\n- Sentence case\n- lowercase\n- UPPERCASE\n- Capitalize Each Word\n- Toggle Case\n\nAcronyms (KTP, NPWP) are protected.",
    filterReplaceAllWith: "Replace all \"{part}\" with:",
    filterDeterministic: "Format-Preserving (default):\n  Maintains original capitalization and punctuation.\n  Aku → Aki, AKU → AKI, aku → aki\n\nCase Sensitive Strict:\n  Only replaces exact matches.",
    filterNoBreak: "Removes all enters/newlines.\nThe entire text becomes a single paragraph.",
    filterAutoCapital: "After . ! ? marks → the next character automatically becomes uppercase.\nAcronyms (KTP, KRIS) remain protected.",
    tutorialAltClick: "Click a token while holding ALT.\nAll identical tokens will be selected.\nEdit one → all change (batch edit).",
    tutorialCtrlDrag: "Hold CTRL + drag to block a specific area.\nChanges only apply to the selected area.",
    tutorialSuggestions: "AI as a surgical tool, not a brain.\nPrecision. Limited. Controlled.\n\nOnly appears if an anomaly is detected (typo, number, missing punctuation).",
    filterNoAi: "No AI",
    filterRealtime: "Real-time",
    footerSignature: "for AIT from Fadhil Ghifarion 法迪",

    // Footer
    footerInstructions: "how to use: type transcription → mark pauses with",
    footerInstructionsSuffix: "→ click process",
    footerPoweredBy: "free. switch model if limited.",
  },
  zh: {
    // Header
    appName: "DingTag Annotation tool",
    tagline: "用于标注和质检的高效文本处理 (Fast Text Processing for Annotation & QC)",
    
    // Form
    inputLabel: "输入",
    inputHint: "使用",
    inputHintSuffix: "作为停顿标记",
    inputPlaceholder: "她说账户被冻结了\\\\ 那我现在该怎么办\\",
    outputLabel: "结果",
    outputPlaceholder: "结果将显示在这里...",
    charCount: "字符",
    
    // Buttons
    processButton: "处理",
    flatTextButton: "平展文本",
    processingButton: "处理中...",
    copyButton: "复制",
    editButton: "重新编辑",
    clearButton: "清除",
    pasteButton: "粘贴",
    insertPromptButton: "插入提示词",
    promptCopied: "已复制！",
    
    // Status
    statusReady: "就绪",
    statusProcessing: "处理中...",
    statusDone: "完成",
    statusCopied: "已复制到剪贴板",
    statusMoved: "文本已移至输入框",
    statusEmptyInput: "输入为空",
    statusCopyFailed: "复制失败",
    statusError: "发生错误",
    statusNoFilter: "未选择过滤器或格式",
    
    // Scoring
    accuracyScore: "准确率得分",
    showDiff: "显示差异细节",
    perfectScore: "完美！",
    goodScore: "不错，稍作检查。",
    lowScore: "存在较多不一致。",

    // Model selector
    modelLabel: "模型",
    modelGroq: "Groq (Llama 3.3)",
    modelGoogle: "Google Gemini",
    modelAiml: "Gemma 3 (AIML API)",
    modelOpenRouter: "Llama 3.3 (OpenRouter Free)",

    // Mode
    modeLabel: "转录模式",
    biasaTitle: "普通模式",
    biasaDesc: "标准标点和语法纠正，不使用反斜杠方法。",
    v1Title: "V1 — 标准",
    v1Desc: "直接处理。快速，无需额外验证。",
    v2Title: "V2.2 — Beta",
    v2Desc: "处理 + 验证 + 自动算法修复。更准确，速度稍慢。",
    v3Title: "自定义过滤器",
    v3Desc: "手动删除特定元素或更改文本格式。",
    tagAnnotator: "[Recommended for Annotator]",
    tagQC: "[Recommended for QC]",
    tagLessRecommended: "[Less Recommended for Annotation]",
    tagRecommended: "[Recommended for Annotation]",

    // Tutorial Popup
    tutorialTitle: "如何使用反斜杠方法",
    tutorialBody: "此模式使用 \\ 符号表示短停顿，使用 \\\\ 表示长停顿。\n\n输入或粘贴转录内容，然后在每个停顿位置添加 \\（短停顿）或 \\\\（长停顿）。标点符号将由 AI 根据语法规范（EYD）和停顿时间自动确定。\n\n示例：\n输入：我在店里\\\\ 想买早餐\\ 卖完了\\\n输出：我在店里。想买早餐，卖完了。",
    tutorialButton: "明白了",

    tutorialModeBiasa: "普通模式\n“处理”按钮的工作方式与普通 AI 类似，无需手动输入提示词——使用更快捷。\n\n平展文本：\n删除大写、标点符号和符号 → 生成纯文本（清洗后的文本）",
    tutorialModeV1: "V1 模式\n基础标注处理。\n\n平展文本：\n删除大写、标点符号和符号 → 生成纯文本（清洗后的文本）",
    tutorialModeV2: "V2 模式 — 标注员推荐\n\n🎧 音频：\n- 使用 1x 倍速（正常）\n- 尽量只听一遍音频\n- 重点关注：修正打字错误 and 标记停顿 (\\ 或 \\\\)\n\n⚡ 快速工作流：\n- 输出结果后 → 立即提交\n- 无需重新检查\n- 目标：最大化标注速度\n\n⚠️ 特殊情况：\n- 如果 AI 输出被标记为红色：\n  → 进行重新检查\n  → 使用 2x 倍速（双倍速）\n\n🧠 核心理念：\n默认：速度胜过完美\n例外：如果被标记 → 才进行审计",
    tutorialFlatText: "平展文本\n删除文本中的所有格式：\n- 大写 → 移除\n- 标点符号 → 删除\n- 符号 → 删除\n\n→ 结果：无格式的干净文本",

    v2BadgeProcessing: "处理中...",
    v2BadgeValid: "✓ 有效",
    v2BadgeFixed_algo: "✓ 自动修复",
    v2BadgeFixed_warning: "⚠ 自动修复 · 检查字数",
    v2BadgeError: "✗ 需要审核",
    v2FixerTitle: "修复程序所做的更改",
    v2Warning: "警告：字数已更改。结果可能需要手动检查。",
    v2MissingWords: "⚠ 输入中的某些单词缺失/已更改。",
    filterFindLabel: "输入要删除或替换的目标。\n使用空格分隔多个目标。\n如果“替换”为空 → 目标将被删除。\n如果“替换”已填写 → 目标将被替换。\n区分大小写（Aku ≠ aku）。",
    filterReplaceLabel: "查找内容的替换目标。",
    filterReplacePlaceholder: "替换为...",
    filterReplaceWarning: "替换需要填写查找内容",
    filterAddStrip: "将重复词转换为连字符形式。\n示例：kata kata → kata-kata\n也适用于：teman teman → teman-teman",
    filterFormatLabel: "字母格式：\n- 句首大写 (Sentence case)\n- 小写 (lowercase)\n- 大写 (UPPERCASE)\n- 每个单词首字母大写 (Capitalize Each Word)\n- 反转大小写 (Toggle Case)\n\n首字母缩略词（如 KTP, NPWP）将受到保护。",
    filterReplaceAllWith: "将所有 \"{part}\" 替换为：",
    filterDeterministic: "保持格式（默认）：\n  保持原始的大小写和标点符号。\n  Aku → Aki, AKU → AKI, aku → aki\n\n区分大小写：\n  仅替换精确匹配项。",
    filterNoBreak: "删除所有换行符。\n整个文本变为一个段落。",
    filterAutoCapital: "在 . ! ? 符号之后 → 下一个字符自动变为大写。\n首字母缩略词（如 KTP, KRIS）保持受保护状态。",
    tutorialAltClick: "按住 ALT 的同时点击词项。\n所有相同的词项都将被选中。\n编辑一个 → 全部更改（批量编辑）。",
    tutorialCtrlDrag: "按住 CTRL + 拖动以选中特定区域。\n更改仅适用于选定区域。",
    tutorialSuggestions: "AI 是手术工具，而不是大脑。\n精准。有限。受控。\n\n仅在检测到异常（拼写错误、数字、缺失标点）时出现。",
    filterNoAi: "无 AI",
    filterRealtime: "实时",
    footerSignature: "for AIT from Fadhil Ghifarion 法迪",

    // Footer
    footerInstructions: "使用方法：输入转录内容 → 用",
    footerInstructionsSuffix: "标记停顿 → 点击处理",
    footerPoweredBy: "免费。限制时请切换模型。",
  },
} as const

export type TranslationKey = keyof typeof translations.id
