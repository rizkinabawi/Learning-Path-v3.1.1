import * as SecureStore from "expo-secure-store";

const STORE_KEY = "lp_ai_keys_v2";

export type AIProvider = "openai" | "gemini";

export interface AIKey {
  id: string;
  provider: AIProvider;
  apiKey: string;
  label: string;
  createdAt: string;
}

const genId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function readStore(): Promise<AIKey[]> {
  try {
    const raw = await SecureStore.getItemAsync(STORE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AIKey[];
  } catch {
    return [];
  }
}

async function writeStore(keys: AIKey[]): Promise<void> {
  await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(keys), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function getApiKeys(): Promise<AIKey[]> {
  return readStore();
}

export async function getApiKeyByProvider(
  provider: AIProvider
): Promise<AIKey | null> {
  const keys = await readStore();
  return keys.find((k) => k.provider === provider) ?? null;
}

export async function saveApiKey(data: {
  provider: AIProvider;
  apiKey: string;
  label?: string;
}): Promise<AIKey> {
  const keys = await readStore();
  const existingIdx = keys.findIndex((k) => k.provider === data.provider);
  const entry: AIKey = {
    id: existingIdx >= 0 ? keys[existingIdx].id : genId(),
    provider: data.provider,
    apiKey: data.apiKey.trim(),
    label:
      data.label ??
      (data.provider === "openai" ? "OpenAI GPT" : "Google Gemini"),
    createdAt:
      existingIdx >= 0
        ? keys[existingIdx].createdAt
        : new Date().toISOString(),
  };
  if (existingIdx >= 0) {
    keys[existingIdx] = entry;
  } else {
    keys.push(entry);
  }
  await writeStore(keys);
  return entry;
}

export async function deleteApiKey(id: string): Promise<void> {
  const keys = await readStore();
  await writeStore(keys.filter((k) => k.id !== id));
}

export function maskKey(key: string): string {
  if (!key || key.length <= 8) return "••••••••";
  return "••••••••••••" + key.slice(-6);
}

export const PROVIDER_META: Record<
  AIProvider,
  { label: string; color: string; bg: string; model: string }
> = {
  openai: {
    label: "OpenAI GPT",
    color: "#10A37F",
    bg: "#10A37F18",
    model: "gpt-4o-mini",
  },
  gemini: {
    label: "Google Gemini",
    color: "#4285F4",
    bg: "#4285F418",
    model: "gemini-2.0-flash",
  },
};
