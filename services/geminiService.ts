
import { GeminiFeedbackSchema } from "../types";

// Helper to access Env Var
const getApiKey = () => import.meta.env.VITE_GEMINI_API_KEY;

// Mock Response Helper
const getMockResponse = (spoken: string, errorMsg: string): GeminiFeedbackSchema => ({
  score: 0,
  mispronounced_words: ["Lỗi", "Kết", "Nối", "API"],
  encouraging_comment: "Hệ thống chưa kết nối được với AI chấm điểm. Vui lòng kiểm tra API Key.",
  teacher_notes: `[CODE_VERSION_8.0_SMART] ${errorMsg}`,
  spoken_text: spoken || "Không nghe thấy gì...",
});

// 1. DYNAMIC DISCOVERY: Get models AND Check Capabilities
const fetchValidModels = async (apiKey: string): Promise<string[]> => {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (!response.ok) return [];

    const data = await response.json();
    if (!data.models) return [];

    // FILTER: Only models that can 'generateContent'
    const validModels = data.models.filter((m: any) =>
      m.supportedGenerationMethods &&
      m.supportedGenerationMethods.includes("generateContent")
    );

    return validModels.map((m: any) => m.name.replace('models/', ''));
  } catch (e) {
    console.warn("ListModels failed", e);
    return [];
  }
};

// 2. SELECT BEST MODEL
const selectBestModel = (validModels: string[]): string => {
  // STRICT Priority list
  const priorities = [
    'gemini-1.5-flash',
    'gemini-1.5-flash-001',
    'gemini-1.5-flash-8b',
    'gemini-1.5-pro',
    'gemini-1.5-pro-001',
    'gemini-1.0-pro-001' // Older but reliable fallback
  ];

  for (const preferred of priorities) {
    if (validModels.includes(preferred)) {
      return preferred;
    }
  }

  // Fallback: Pick the newest looking model from the valid list
  const anyFlash = validModels.find(m => m.includes('flash'));
  if (anyFlash) return anyFlash;

  const anyPro = validModels.find(m => m.includes('pro') && !m.includes('vision')); // avoid vision-only if any
  if (anyPro) return anyPro;

  // Last resort: The first valid text generation model
  return validModels[0] || 'gemini-1.5-flash';
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
    throw new Error(`API Error ${response.status} on ${model}: ${errorBody}`);
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
    console.warn("⚠️ VITE_GEMINI_API_KEY is missing or empty. Checks may fail or return mock data.");
    // We continue anyway, in case the key is shimmed in a way we can't see, or to hit the catch block naturally.
  }

  // STEP 1: Discover Valid Models
  let selectedModel = 'gemini-1.5-flash';
  let discoveryLog = "";

  try {
    const validModels = await fetchValidModels(apiKey);

    // Debug: List top 3 valid models to see what we have
    const top3 = validModels.slice(0, 3).join(", ");
    discoveryLog = `Found ${validModels.length} Valid Models: [${top3}...]`;

    if (validModels.length > 0) {
      selectedModel = selectBestModel(validModels);
      discoveryLog += ` -> Selected: ${selectedModel}`;
    } else {
      discoveryLog += " -> No valid models found, defaulting.";
    }
  } catch (e) {
    discoveryLog = "Discovery Failed";
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

  // 3. ROBUST EXECUTION WITH FALLBACK
  const modelsToTry = [selectedModel, 'gemini-1.5-flash-001', 'gemini-1.5-pro-001', 'gemini-1.0-pro'];
  // Deduplicate models
  const uniqueModels = [...new Set(modelsToTry)];

  for (const model of uniqueModels) {
    try {
      const data = await callGeminiRaw(model, payload, apiKey);
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) throw new Error(`Empty response from ${model}`);

      const result = JSON.parse(text) as GeminiFeedbackSchema;
      return {
        ...result,
        teacher_notes: `${result.teacher_notes} | [Model: ${model}]`
      };

    } catch (error: any) {
      const is429 = error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED');
      console.warn(`Attempt with ${model} failed (Is 429: ${is429}):`, error.message);

      // If it's NOT a 429/overload and NOT a 503/server error, it might be a bad request (400), so stop.
      // But for safety, we try the next model if it's strictly a capacity/availability issue.
      if (!is429 && !error.message?.includes('503') && !error.message?.includes('500') && !error.message?.includes('404') && !error.message?.includes('400')) {
        // Actually, for this "Smart" version, we should try ALL models in the list regardless of error type,
        // because "400 Bad Request" or "404 Not Found" usually means the MODEL NAME is wrong/deprecated.
        // So we should just continue!
        // throw error; // Don't retry for logic errors <--- DISABLED
      }
      // Otherwise, continue to next model in loop
    }
  }

  throw new Error(`All models failed. Last error: ${discoveryLog}`);

};
