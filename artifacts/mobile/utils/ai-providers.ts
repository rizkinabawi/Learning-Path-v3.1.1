import type { AIProvider } from "./ai-keys";

export interface AIResponse {
  content: string;
}

export async function callOpenAI(
  prompt: string,
  apiKey: string,
  model = "gpt-4o-mini"
): Promise<AIResponse> {
  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "Return ONLY valid JSON. No explanation. No markdown. No extra text outside JSON.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
      }),
    });
  } catch (netErr: any) {
    throw new Error("Tidak bisa terhubung ke OpenAI. Periksa koneksi internet.");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as any;
    const rawMsg: string = err?.error?.message ?? "";
    const code: string = err?.error?.code ?? "";

    if (res.status === 401) {
      throw new Error("API key OpenAI tidak valid atau sudah kadaluarsa.");
    }
    if (res.status === 429) {
      if (rawMsg.toLowerCase().includes("quota") || rawMsg.toLowerCase().includes("billing") || code === "insufficient_quota") {
        throw new Error("Kuota/kredit OpenAI habis. Tambah kredit di platform.openai.com/settings/billing.");
      }
      const detail = rawMsg ? `\n\nDetail: ${rawMsg}` : "";
      throw new Error(`Rate limit OpenAI — terlalu banyak request. Coba lagi sebentar.${detail}`);
    }
    if (res.status === 402 || res.status === 403) {
      throw new Error("Akses ditolak OpenAI. Periksa kuota atau izin API key.");
    }
    if (res.status === 404) {
      throw new Error(`Model "${model}" tidak ditemukan di OpenAI. Ganti model di pengaturan AI Keys.`);
    }
    if (res.status === 400) {
      throw new Error(`Request tidak valid: ${rawMsg || "bad request"}`);
    }
    throw new Error(rawMsg || `OpenAI error ${res.status}`);
  }

  const data = await res.json() as any;
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Respons OpenAI kosong atau tidak terduga.");
  return { content };
}

export async function callGemini(
  prompt: string,
  apiKey: string,
  model = "gemini-2.0-flash"
): Promise<AIResponse> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text:
                  "Return ONLY valid JSON. No explanation. No markdown. No extra text outside JSON.\n\n" +
                  prompt,
              },
            ],
          },
        ],
        generationConfig: { temperature: 0.7 },
      }),
    });
  } catch (netErr: any) {
    throw new Error("Tidak bisa terhubung ke Gemini. Periksa koneksi internet.");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as any;
    const rawMsg: string = err?.error?.message ?? "";
    const status: string = err?.error?.status ?? "";

    if (res.status === 400) {
      if (rawMsg.includes("API_KEY") || rawMsg.toLowerCase().includes("api key")) {
        throw new Error("API key Gemini tidak valid.");
      }
      if (rawMsg.toLowerCase().includes("not found") || status === "NOT_FOUND") {
        throw new Error(`Model "${model}" tidak ditemukan. Ganti model di pengaturan AI Keys.`);
      }
      throw new Error(`Request tidak valid: ${rawMsg || "bad request"}`);
    }
    if (res.status === 403) {
      throw new Error("API key Gemini tidak memiliki izin. Pastikan Gemini API sudah diaktifkan di Google Cloud Console.");
    }
    if (res.status === 429) {
      if (status === "RESOURCE_EXHAUSTED" || rawMsg.toLowerCase().includes("quota") || rawMsg.toLowerCase().includes("exhausted")) {
        throw new Error(`Kuota Gemini habis untuk hari ini.\n\nCoba model lain (misal: gemini-1.5-flash-8b) yang punya limit lebih longgar, atau tunggu besok.`);
      }
      throw new Error(`Rate limit Gemini — terlalu banyak request. Tunggu beberapa detik lalu coba lagi.\n\nDetail: ${rawMsg}`);
    }
    if (res.status === 404) {
      throw new Error(`Model "${model}" tidak ditemukan di Gemini. Ganti model di pengaturan AI Keys.`);
    }
    throw new Error(rawMsg || `Gemini error ${res.status}`);
  }

  const data = await res.json() as any;

  const blockReason = data?.promptFeedback?.blockReason;
  if (blockReason) {
    throw new Error(`Konten diblokir Gemini (${blockReason}). Coba ubah topik atau catatan tambahan.`);
  }

  const finishReason = data?.candidates?.[0]?.finishReason;
  if (finishReason === "RECITATION") {
    throw new Error("Respons Gemini diblokir karena RECITATION. Coba topik yang berbeda.");
  }
  if (finishReason === "SAFETY") {
    throw new Error("Respons Gemini diblokir oleh filter keamanan. Coba ubah topik.");
  }

  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) throw new Error("Respons Gemini kosong. Coba lagi atau ganti model.");
  return { content: text };
}

export async function callAI(
  provider: AIProvider,
  prompt: string,
  apiKey: string,
  model?: string
): Promise<AIResponse> {
  switch (provider) {
    case "openai":
      return callOpenAI(prompt, apiKey, model);
    case "gemini":
      return callGemini(prompt, apiKey, model);
    default:
      throw new Error("Provider tidak dikenal.");
  }
}
