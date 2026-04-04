import type { AIProvider } from "./ai-keys";

export interface AIResponse {
  content: string;
}

export async function callOpenAI(
  prompt: string,
  apiKey: string,
  model = "gpt-4o-mini"
): Promise<AIResponse> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
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

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as any;
    const msg = err?.error?.message ?? "";
    if (res.status === 401) throw new Error("API key OpenAI tidak valid.");
    if (res.status === 429)
      throw new Error("Rate limit OpenAI. Coba lagi nanti.");
    if (res.status === 402 || res.status === 403)
      throw new Error("Kuota OpenAI habis atau akses ditolak.");
    throw new Error(msg || `OpenAI error ${res.status}`);
  }

  const data = await res.json() as any;
  return { content: data.choices[0].message.content };
}

export async function callGemini(
  prompt: string,
  apiKey: string,
  model = "gemini-2.0-flash"
): Promise<AIResponse> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
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

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as any;
    const msg = err?.error?.message ?? "";
    if (res.status === 400 && msg.includes("API_KEY"))
      throw new Error("API key Gemini tidak valid.");
    if (res.status === 429)
      throw new Error("Rate limit Gemini. Coba lagi nanti.");
    throw new Error(msg || `Gemini error ${res.status}`);
  }

  const data = await res.json() as any;
  const text: string =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) throw new Error("Respons Gemini kosong.");
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
