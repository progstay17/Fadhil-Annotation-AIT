import { generateText } from "ai"
import { createGroq } from "@ai-sdk/groq"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
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
- Jangan ubah, hapus, atau terjemahkan token berbentuk __ENTITY_N__ (garis bawah + angka) — biarkan persis apa adanya, itu placeholder yang akan direstore otomatis.
- Jangan pernah menggunakan tanda elipsis (...) dalam bentuk apapun — baik tiga titik berurutan (...) maupun karakter unicode elipsis tunggal (…). Setiap jeda atau kalimat yang belum selesai harus tetap diselesaikan menjadi kalimat gramatikal yang utuh, atau menggunakan tanda baca standar EYD (koma, titik, tanda tanya, tanda seru) sesuai konteks — bukan dipotong dengan elipsis.

Output: teks hasil saja, tanpa komentar.

Contoh 1 (Durasi & EYD Searah):
Input:  kami baru sampai di stasiun\\\\ kereta sudah berangkat\\ kita telat\\
Output: Kami baru sampai di stasiun. Kereta sudah berangkat, kita telat.

Contoh 2 (Durasi & EYD Bertentangan - EYD Menang):
Input:  meskipun hujan sangat lebat\\\\ kami tetap berangkat ke sekolah\\ hari ini sangat dingin\\
Output: Meskipun hujan sangat lebat, kami tetap berangkat ke sekolah. Hari ini sangat dingin.`

type Provider = "groq" | "google"

const MODELS = {
  groq: "llama-3.3-70b-versatile",
  google: "gemini-flash-lite-latest",
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

    // Process based on provider
    if (provider === "google") {
      // 1. Parse GEMINI_API_KEYS
      let keys: string[] = [];
      const multiKeys = process.env.GEMINI_API_KEYS;
      if (multiKeys) {
        keys = multiKeys
          .split(",")
          .map((k) => k.trim())
          .filter((k) => k.length > 0);
      }

      // Fallback to single-key
      if (keys.length === 0) {
        const singleKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        if (singleKey && !singleKey.includes("your_") && !singleKey.includes("_here")) {
          keys = [singleKey.trim()];
        }
      }

      // 2. If completely empty, return error
      if (keys.length === 0) {
        return Response.json(
          { error: "Gemini API Key (GEMINI_API_KEY) belum dikonfigurasi." },
          { status: 500 }
        );
      }

      // 3. Choose starting index randomly
      const startIndex = Math.floor(Math.random() * keys.length);
      const errors: string[] = [];
      let finalResult = "";
      let success = false;

      // 4. Try keys starting from the random index
      for (let i = 0; i < keys.length; i++) {
        const currentIndex = (startIndex + i) % keys.length;
        const currentKey = keys[currentIndex];

        try {
          const google = createGoogleGenerativeAI({ apiKey: currentKey });
          const model = google(MODELS.google);

          const { text: result } = await generateText({
            model,
            system: systemPrompt || PROMPT_SYSTEM,
            prompt: text,
            maxOutputTokens: 1000,
            temperature: 0.1,
          });

          finalResult = result;
          success = true;
          break; // Stop loop on success
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : "Terjadi kesalahan";
          errors.push(errMsg);
        }
      }

      // 5. If all keys failed, handle errors
      if (!success) {
        const lastErrorMsg = errors[errors.length - 1] || "Semua Gemini API Key gagal dicoba";

        // Check if any error in the loop matches rate limit keyword
        const isAnyRateLimit = errors.some(
          (err) => err.toLowerCase().includes("rate limit") || err.includes("429")
        );

        if (isAnyRateLimit) {
          return Response.json(
            {
              error: "Rate limit tercapai. Coba ganti model atau tunggu beberapa menit.",
              isRateLimit: true,
            },
            { status: 429 }
          );
        }

        return Response.json({ error: lastErrorMsg }, { status: 500 });
      }

      const trimmedResult = finalResult.trim() || "(tidak ada hasil)";
      const scoring = calculateScoring(text, trimmedResult);

      return Response.json({
        result: trimmedResult,
        scoring,
      });

    } else {
      // Groq implementation
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey || apiKey.includes("your_") || apiKey.includes("_here")) {
        return Response.json({ error: "Groq API Key belum dikonfigurasi." }, { status: 500 });
      }
      const groq = createGroq({ apiKey });
      const model = groq(MODELS.groq);

      const { text: result } = await generateText({
        model,
        system: systemPrompt || PROMPT_SYSTEM,
        prompt: text,
        maxOutputTokens: 1000,
        temperature: 0.1,
      });

      const trimmedResult = result.trim() || "(tidak ada hasil)";
      const scoring = calculateScoring(text, trimmedResult);

      return Response.json({
        result: trimmedResult,
        scoring,
      });
    }
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
