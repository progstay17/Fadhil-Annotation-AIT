export interface KnownEntity {
  key: string       // bentuk lowercase yang dicari, misal "shopee"
  canonical: string // bentuk yang benar, misal "Shopee"
}

const STORAGE_KEY = "dingtag_known_entities"

export function getKnownEntities(): KnownEntity[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveKnownEntities(entities: KnownEntity[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entities))
}

export function addKnownEntity(key: string, canonical: string): KnownEntity[] {
  const entities = getKnownEntities()
  const normalizedKey = key.trim().toLowerCase()
  const existingIndex = entities.findIndex(e => e.key === normalizedKey)
  if (existingIndex >= 0) {
    entities[existingIndex] = { key: normalizedKey, canonical: canonical.trim() }
  } else {
    entities.push({ key: normalizedKey, canonical: canonical.trim() })
  }
  saveKnownEntities(entities)
  return entities
}

export function removeKnownEntity(key: string): KnownEntity[] {
  const entities = getKnownEntities().filter(e => e.key !== key.trim().toLowerCase())
  saveKnownEntities(entities)
  return entities
}

export function protectKnownEntities(text: string): { protectedText: string; entities: string[] } {
  const entities = getKnownEntities()
  if (entities.length === 0) return { protectedText: text, entities: [] }

  const sorted = [...entities].sort((a, b) => b.key.length - a.key.length)
  const restoreList: string[] = []
  let protectedText = text

  sorted.forEach(({ key, canonical }) => {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`\\b${escapedKey}\\b`, "gi")
    protectedText = protectedText.replace(regex, () => {
      restoreList.push(canonical)
      return `__ENTITY_${restoreList.length - 1}__`
    })
  })

  return { protectedText, entities: restoreList }
}

export function restoreKnownEntities(text: string, entities: string[]): string {
  return text.replace(/__ENTITY_(\d+)__/g, (_, i) => entities[parseInt(i)] || "")
}

export function exportKnownEntities(): void {
  const entities = getKnownEntities()
  const dataStr = JSON.stringify(entities, null, 2)
  const blob = new Blob([dataStr], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  const dateStr = new Date().toISOString().slice(0, 10)
  link.href = url
  link.download = `dingtag-dictionary-${dateStr}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function importKnownEntities(jsonString: string, mode: "merge" | "replace" = "merge"): { success: boolean; count: number; error?: string } {
  try {
    const parsed = JSON.parse(jsonString)
    if (!Array.isArray(parsed)) {
      return { success: false, count: 0, error: "Format tidak valid: harus berupa array" }
    }

    const validEntities: KnownEntity[] = []
    for (const item of parsed) {
      if (
        typeof item === "object" &&
        item !== null &&
        typeof item.key === "string" &&
        typeof item.canonical === "string" &&
        item.key.trim() !== "" &&
        item.canonical.trim() !== ""
      ) {
        validEntities.push({
          key: item.key.trim().toLowerCase(),
          canonical: item.canonical.trim()
        })
      }
    }

    if (validEntities.length === 0) {
      return { success: false, count: 0, error: "Tidak ada entry valid ditemukan dalam file" }
    }

    if (mode === "replace") {
      saveKnownEntities(validEntities)
      return { success: true, count: validEntities.length }
    }

    const existing = getKnownEntities()
    const merged = [...existing]
    validEntities.forEach(newEntity => {
      const idx = merged.findIndex(e => e.key === newEntity.key)
      if (idx >= 0) {
        merged[idx] = newEntity
      } else {
        merged.push(newEntity)
      }
    })
    saveKnownEntities(merged)
    return { success: true, count: validEntities.length }
  } catch {
    return { success: false, count: 0, error: "File JSON tidak bisa dibaca / rusak" }
  }
}
