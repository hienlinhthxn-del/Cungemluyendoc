
import { GoogleGenAI, Type } from "@google/genai";
import { GeminiFeedbackSchema } from "../types";

const getClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
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
    score: Math.floor(Math.random() * 20) + 80, // Random score 80-100
    mispronounced_words: [],
    encouraging_comment: "Giả lập: Con đọc rất tốt! (Vui lòng kiểm tra lại API Key hoặc kết nối mạng)",
    teacher_notes: "Used Mock/Fallback due to missing API Key or Connection Error.",
    spoken_text: spoken || "Nội dung giả lập...",
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
      // Multimodal prompt with Audio - TUNED FOR VIETNAMESE ACCURACY (STRICT MODE)
      parts = [
        {
          text: `Role: Extremely Strict Vietnamese Grade 1 Reading Teacher (Standard Northern Accent / Giọng Miền Bắc).
          
          Task: Evaluate the pronunciation of the following student recording against the target text: "${targetText}".
          
          Instructions:
          1. Transcribe EXACTLY what the student said into 'spoken_text'. Capturing every error (e.g., "Hà Lội" instead of "Hà Nội").
          2. STRICTLY check for Tones (Dấu thanh). Dấu Hỏi vs Dấu Ngã must be perfect.
          3. STRICTLY check for Initial Consonants (L/N, Tr/Ch, S/X, R/D/Gi). ANY deviation is an error.
          4. Compare the transcription with the Target Text **Word-by-Word**.
          5. Grading Criteria:
             - 100: Absolute perfection, native standard.
             - 90-99: Very good, maybe 1 very subtle imperfection.
             - 80-89: Good, but 1 clear error (wrong tone or consonant).
             - <80: Multiple errors (ngọng, sai dấu).
             - <50: Wrong text or unintelligible.
          6. 'mispronounced_words': List ALL words from the TARGET text that were not pronounced perfectly. Matches must be exact.
          7. 'encouraging_comment': Short, specific encouragement in Vietnamese.
          8. 'teacher_notes': List the specific errors found (e.g., "Sai từ 'Hà' thành 'Hả'", "Ngọng L/N ở từ 'Lúa'").`
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
          text: `Role: Strict Vietnamese Grade 1 Reading Teacher.
          Target Text: "${targetText}"
          Student Input: "${userSpokenText}"
          
          1. Compare Student Input to Target Text word-for-word.
          2. Identify any mismatch as a mispronunciation.
          3. Grade strictness: 10/10.
          4. Output JSON matching the schema.`
        }
      ];
    }

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.1 // Ultra low temperature for determinism
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
      encouraging_comment: "Có lỗi kết nối nên cô chưa chấm chính xác được. Nhưng con đọc tốt lắm! (Chế độ giả lập)"
    };
  }
};
