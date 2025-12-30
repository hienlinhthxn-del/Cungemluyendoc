
import { GeminiFeedbackSchema } from "../types";

// Helper to access Env Var
const getApiKey = () => import.meta.env.VITE_GEMINI_API_KEY;

// Mock Response Helper
const getMockResponse = (spoken: string, errorMsg: string): GeminiFeedbackSchema => ({
  score: 0,
  mispronounced_words: ["Lỗi", "Kết", "Nối", "API"],
  encouraging_comment: "Hệ thống chưa kết nối được với AI chấm điểm. Vui lòng kiểm tra API Key.",
  teacher_notes: `[CODE_VERSION_7.0_FINAL] Error: ${errorMsg}. Switched to Mock mode.`,
  spoken_text: spoken || "Không nghe thấy gì...",
});

// 1. DYNAMIC DISCOVERY
const fetchAvailableModels = async (apiKey: string): Promise<string[]> => {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (!response.ok) return [];

    const data = await response.json();
    if (!data.models) return [];

    return data.models.map((m: any) => m.name.replace('models/', ''));
  } catch (e) {
    console.warn("ListModels failed", e);
    return [];
  }
};

// 2. SELECT BEST MODEL - FIXED PRIORITY
const selectBestModel = (availableModels: string[]): string => {
  // STRICT Priority list - ONLY Modern 1.5 Models
  const priorities = [
    'gemini-1.5-flash',      // Primary Goal
    'gemini-1.5-flash-001',
    'gemini-1.5-flash-002',
    'gemini-1.5-flash-8b',   // Lightweight Backup
    'gemini-1.5-pro',        // Premium Backup
    'gemini-1.5-pro-001',
    'gemini-1.5-pro-002'
  ];

  // Logic: Scan priorities and pick first one present in the available list
  for (const preferred of priorities) {
    if (availableModels.includes(preferred)) {
      return preferred;
    }
  }

  // Double Check: Try partial match (e.g. key has 'gemini-1.5-flash-latest' but list is strict)
  const flashMatch = availableModels.find(m => m.includes('1.5-flash'));
  if (flashMatch) return flashMatch;

  // Last Resort: Just return the first available model that is NOT 'gemini-pro' (because gemini-pro is broken)
  const safeFallback = availableModels.find(m => !m.includes('gemini-pro') && !m.includes('1.0'));

  return safeFallback || 'gemini-1.5-flash';
};

// Raw REST API Call Function
const callGeminiRaw = async (model: string, payload: any, apiKey: string) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API Error ${response.status} on model ${model}: ${errorBody}`);
  }

  return response.json();
};

export const evaluateReading = async (
  targetText: string,
  userSpokenText: string,
  audioBase64?: string,
  mimeType: string = 'audio/webm'
): Promise<GeminiFeedbackSchema> => {
  const apiKey = getApiKey();

  if (!apiKey) {
    return new Promise((resolve) => setTimeout(() => resolve(getMockResponse(userSpokenText, "Missing API Key")), 1500));
  }

  // STEP 1: Discover Models
  let selectedModel = 'gemini-1.5-flash';
  let discoveryNote = "Skipped";

  try {
    const available = await fetchAvailableModels(apiKey);
    if (available.length > 0) {
      selectedModel = selectBestModel(available);
      discoveryNote = `Auto-Selected: ${selectedModel} from [${available.length} models]`;
    } else {
      discoveryNote = "ListModels empty/failed -> Defaulting";
    }
  } catch (e) {
    console.warn("Discovery error", e);
  }

  // STEP 2: Construct Payload
  let parts: any[] = [];
  const systemPrompt = `Role: Extremely Strict Vietnamese Grade 1 Reading Teacher (Standard Northern Accent).
    Task: Evaluate the student's pronunciation of: "${targetText}".
    Instructions:
    1. Listen/Read input and compare with target text.
    2. Transcribe EXACTLY what you hear into 'spoken_text'.
    3. STRICTLY check Tones (Dấu) and Initials (L/N, Tr/Ch).
    4. Grading:
       - 100: Perfect.
       - 90: Minor inconsistency.
       - <80: Wrong tone/word.
    5. Output JSON only.`;

  if (audioBase64) {
    parts = [
      { text: systemPrompt },
      { inlineData: { mimeType: mimeType, data: audioBase64 } }
    ];
  } else {
    parts = [
      { text: systemPrompt + `\nStudent Text Input: "${userSpokenText}"` }
    ];
  }

  const payload = {
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.4,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          score: { type: "INTEGER" },
          mispronounced_words: { type: "ARRAY", items: { type: "STRING" } },
          encouraging_comment: { type: "STRING" },
          teacher_notes: { type: "STRING" },
          spoken_text: { type: "STRING" }
        },
        required: ["score", "mispronounced_words", "encouraging_comment", "teacher_notes", "spoken_text"]
      }
    }
  };

  try {
    // ATTEMPT EXECUTION
    const data = await callGeminiRaw(selectedModel, payload, apiKey);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) throw new Error(`Empty response from ${selectedModel}`);

    const result = JSON.parse(text) as GeminiFeedbackSchema;

    // Append debug info
    return {
      ...result,
      teacher_notes: `${result.teacher_notes} | [DEBUG: ${discoveryNote}]`
    };

  } catch (error) {
    console.error("REST Grading Error:", error);
    return getMockResponse(userSpokenText, `${error instanceof Error ? error.message : String(error)} | Discovery: ${discoveryNote}`);
  }
};
