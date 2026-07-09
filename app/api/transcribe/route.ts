import { generateText } from "ai"
import { createGroq } from "@ai-sdk/groq"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createOpenAI } from "@ai-sdk/openai"
import { calculateScoring } from "@/lib/scoring"

const PROMPT_SYSTEM = `Kamu editor transkripsi audio. Lakukan DUA hal saja:
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
- Jangan sentuh tanda baca selain "\\" and "\\\\".
- Setiap "\\" and "\\\\" WAJIB diganti, tidak boleh dihapus atau dilewati.
- Jika ragu pilih titik (.) atau koma (,) sesuai struktur gramatikal.

Output: teks hasil saja, tanpa komentar.

Contoh 1 (Durasi & EYD Searah):
Input:  kami baru sampai di stasiun\\\\ kereta sudah berangkat\\ kita telat\\
Output: Kami baru sampai di stasiun. Kereta sudah berangkat, kita telat.

Contoh 2 (Durasi & EYD Bertentangan - EYD Menang):
Input:  meskipun hujan sangat lebat\\\\ kami tetap berangkat ke sekolah\\ hari ini sangat dingin\\
Output: Meskipun hujan sangat lebat, kami tetap berangkat ke sekolah. Hari ini sangat dingin.`

type Provider = "groq" | "google" | "aiml" | "openrouter"

const MODELS = {
  groq: "llama-3.3-70b-versatile",
  google: "gemini-2.5-flash-lite",
  aiml: "google/gemma-3n-e4b-it",
  openrouter: "meta-llama/llama-3.3-70b-instruct:free",
} as const

export async function POST(request: Request) {
  try {
    const { text, provider = "google", systemPrompt } = await request.json() as {
      text: string;
      provider?: Provider;
      systemPrompt?: string;
    }

    if (!text || typeof text !== "string") {
      return Response.json(
        { error: "Input teks diperlukan" },
        { status: 400 }
      )
    }

    // Initialize provider and model based on request
    let model;

    if (provider === "google") {
      const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

      if (!apiKey || apiKey.includes("your_") || apiKey.includes("_here")) {
        return Response.json({ error: "Gemini API Key (GEMINI_API_KEY) belum dikonfigurasi." }, { status: 500 });
      }

      const google = createGoogleGenerativeAI({ apiKey });
      model = google(MODELS.google);
    } else if (provider === "aiml") {
      const apiKey = process.env.AIML_API_KEY;
      if (!apiKey || apiKey.includes("your_") || apiKey.includes("_here")) {
        return Response.json({ error: "AIML API Key belum dikonfigurasi." }, { status: 500 });
      }
      const aiml = createOpenAI({
        apiKey,
        baseURL: "https://api.aimlapi.com/v1",
      });
      model = aiml(MODELS.aiml);
    } else if (provider === "openrouter") {
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey || apiKey.includes("your_") || apiKey.includes("_here")) {
        return Response.json({ error: "OpenRouter API Key belum dikonfigurasi." }, { status: 500 });
      }
      const openrouter = createOpenAI({
        apiKey,
        baseURL: "https://openrouter.ai/api/v1",
      });
      model = openrouter(MODELS.openrouter);
    } else {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey || apiKey.includes("your_") || apiKey.includes("_here")) {
        return Response.json({ error: "Groq API Key belum dikonfigurasi." }, { status: 500 });
      }
      const groq = createGroq({ apiKey });
      model = groq(MODELS.groq);
    }

    const { text: result } = await generateText({
      model,
      system: systemPrompt || PROMPT_SYSTEM,
      prompt: text,
      maxOutputTokens: 1000,
      temperature: 0.1,
    })

    const trimmedResult = result.trim() || "(tidak ada hasil)"
    const scoring = calculateScoring(text, trimmedResult)

    return Response.json({
      result: trimmedResult,
      scoring
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan"
    
    // Check for rate limit error
    if (message.toLowerCase().includes("rate limit") || message.includes("429")) {
      return Response.json({ 
        error: "Rate limit tercapai. Coba ganti model atau tunggu beberapa menit.",
        isRateLimit: true 
      }, { status: 429 })
    }
    
    return Response.json({ error: message }, { status: 500 })
  }
}
