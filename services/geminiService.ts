
import { GeminiFeedbackSchema } from "../types";

// Helper to access Env Var
const getApiKey = () => import.meta.env.VITE_GEMINI_API_KEY;

// Mock Response Helper
const getMockResponse = (spoken: string, errorMsg: string): GeminiFeedbackSchema => ({
  score: 0,
  mispronounced_words: ["Lỗi", "Kết", "Nối", "API"],
  encouraging_comment: "Hệ thống chưa kết nối được với AI chấm điểm. Vui lòng kiểm tra API Key.",
  teacher_notes: `[CODE_VERSION_5.0_REST] Error: ${errorMsg}. Switched to Mock mode.`,
  spoken_text: spoken || "Không nghe thấy gì...",
});

// Raw REST API Call Function
const callGeminiRaw = async (model: string, payload: any, apiKey: string) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API Error ${response.status}: ${errorBody}`);
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
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(getMockResponse(userSpokenText, "Missing API Key"));
      }, 1500);
    });
  }

  // Construct Prompt Parts
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
      {
        inlineData: {
          mimeType: mimeType,
          data: audioBase64
        }
      }
    ];
  } else {
    parts = [
      { text: systemPrompt + `\nStudent Text Input: "${userSpokenText}"` }
    ];
  }

  // Generation Config (JSON Enforced)
  const generationConfig = {
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
  };

  const payload = {
    contents: [{ parts }],
    generationConfig
  };

  try {
    // ATTEMPT 1: Gemini 1.5 Flash
    try {
      const data = await callGeminiRaw('gemini-1.5-flash', payload, apiKey);
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Empty response from Flash");
      return JSON.parse(text) as GeminiFeedbackSchema;
    } catch (flashError: any) {
      console.warn("REST Flash failed, trying Pro...", flashError);

      // ATTEMPT 2: Gemini 1.5 Pro
      const data = await callGeminiRaw('gemini-1.5-pro', payload, apiKey);
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Empty response from Pro");
      return JSON.parse(text) as GeminiFeedbackSchema;
    }

  } catch (error) {
    console.error("REST Grading Error:", error);
    return getMockResponse(userSpokenText, error instanceof Error ? error.message : String(error));
  }
};
