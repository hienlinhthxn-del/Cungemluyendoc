
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
      // Multimodal prompt with Audio - TUNED FOR VIETNAMESE ACCURACY (STRICT MODE V2)
      parts = [
        {
          text: `Role: Extremely Strict Vietnamese Grade 1 Reading Teacher (Standard Northern Accent).
          
          Task: Evaluate the student's pronunciation of: "${targetText}".
          
          CRITICAL INSTRUCTION: You must be UNFORGIVING with errors.
          
          1. **ZERO TOLERANCE for Tone Errors**:
             - Target: "Ngã" -> Student: "Ngả" (Hỏi) => WRONG. mark "Ngã" as mispronounced.
             - Target: "Lá" -> Student: "La" (No tone) => WRONG.
          
          2. **ZERO TOLERANCE for Initial Consonants**:
             - Target: "Lúa" -> Student: "Núa" => WRONG. mark "Lúa" as mispronounced.
             - Target: "Trâu" -> Student: "Châu" => WRONG.
          
          3. **Transcribe EXACTLY**:
             - If student says "Nàm", write "Nàm". Do not correct it to "Làm".
          
          4. **Output Criteria**:
             - 'score': 100 (Perfect), 90 (1 minor error), <80 (Any tone/consonant error).
             - 'mispronounced_words': List EVERY word from the target text that wasn't perfect.
               - Example: Target "Bé ngủ ngon". Student says "Bé ngủ ngonn". If "ngon" sounds weird, list it.
               - Example: Target "Con Hổ". Student says "Con Hố". List "Hổ".
          
          5. **Feedback**:
             - Be kind in the 'encouraging_comment' but brutal in the 'mispronounced_words' list.`
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
          
          Compare word-for-word. Any difference (typo, missing word) is a WRONG word.
          Output JSON.`
        }
      ];
    }

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash', // Revert to Flash for stability
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
      encouraging_comment: "Có lỗi kết nối nên cô chưa chấm chính xác được. (Chế độ giả lập 0 điểm)"
    };
  }
};
