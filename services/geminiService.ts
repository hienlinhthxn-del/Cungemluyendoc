
import { GoogleGenAI, Type } from "@google/genai";
import { GeminiFeedbackSchema } from "../types";

const getClient = () => {
  // FIX: Access Vite environment variable correctly
  // In Vite, process.env is empty in production. Must use import.meta.env.
  // Also, variable MUST start with VITE_ to be exposed to client.
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("API Key not found. Using mock simulation.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const evaluateReading = async (
  targetText: string,
  userSpokenText: string,
  audioBase64?: string,
  mimeType: string = 'audio/webm'
): Promise<GeminiFeedbackSchema> => {
  const ai = getClient();

  // Helper for mock response
  const getMockResponse = (spoken: string): GeminiFeedbackSchema => ({
    score: 0, // Set to 0 to indicate FAILURE/MOCK mode clearly
    mispronounced_words: ["Lỗi", "Kết", "Nối", "API"],
    encouraging_comment: "Hệ thống chưa kết nối được với AI chấm điểm. Vui lòng kiểm tra API Key hoặc mạng.",
    teacher_notes: "DEBUG INFO: Using Mock/Fallback. Logic AI chưa chạy. Nguyên nhân: Không tìm thấy API Key hoặc Lỗi kết nối.",
    spoken_text: spoken || "Không nghe thấy gì...",
  });

  // Fallback for demo if no API key
  if (!ai) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(getMockResponse(userSpokenText));
      }, 1500);
    });
  }

  const schema = {
    type: Type.OBJECT,
    properties: {
      score: { type: Type.INTEGER, description: "Score from 0 to 100 based on phonetic accuracy." },
      mispronounced_words: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "List of words the student mispronounced (wrong tone, wrong vowel/consonant)."
      },
      encouraging_comment: { type: Type.STRING, description: "A short, friendly, encouraging comment in Vietnamese." },
      teacher_notes: { type: Type.STRING, description: "Technical analysis of errors (e.g., 'Ngọng L/N', 'Sai dấu ngã')." },
      spoken_text: { type: Type.STRING, description: "The exact Vietnamese transcription of what was heard." }
    },
    required: ["score", "mispronounced_words", "encouraging_comment", "teacher_notes", "spoken_text"]
  };

  try {
    let parts: any[] = [];

    if (audioBase64) {
      // Multimodal prompt with Audio - STANDARD MODE (Reverted as requested)
      parts = [
        {
          text: `Role: Vietnamese Grade 1 Reading Teacher (Standard Northern Accent).
          
          Task: Evaluate the student's pronunciation of: "${targetText}".
          
          Instructions:
          1. Listen to the audio and compare with target text.
          2. Transcribe what you hear into 'spoken_text'.
          3. Identify clearly mispronounced words in 'mispronounced_words'.
          4. Grading:
             - 90-100: Very good.
             - 80-89: Good.
             - <80: Needs improvement.
          5. Provide encouragement.`
        },
        {
          inlineData: {
            mimeType: mimeType,
            data: audioBase64
          }
        }
      ];
    } else {
      // Text-only fallback
      parts = [
        {
          text: `Role: Vietnamese Grade 1 Reading Teacher.
          Target Text: "${targetText}"
          Student Input: "${userSpokenText}"
          Output JSON matching schema.`
        }
      ];
    }

    const response = await ai.models.generateContent({
      model: 'gemini-pro', // SWITCH TO GEMINI PRO (V1.0) -> MOST STABLE MODEL
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.4 // Standard temperature
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as GeminiFeedbackSchema;
    } else {
      throw new Error("Empty response from AI");
    }

  } catch (error) {
    console.error("Gemini Grading Error:", error);
    // Explicit Fallback to Mock instead of error message
    return {
      ...getMockResponse(userSpokenText),
      teacher_notes: `Error: ${error instanceof Error ? error.message : String(error)}. Switched to Mock mode.`,
      encouraging_comment: "Có lỗi kết nối nên cô chưa chấm chính xác được. (Chế độ giả lập 0 điểm)"
    };
  }
};
