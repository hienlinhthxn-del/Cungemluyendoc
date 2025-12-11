
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
      // Multimodal prompt with Audio - TUNED FOR VIETNAMESE ACCURACY
      parts = [
        {
          text: `Role: Strict Vietnamese Grade 1 Reading Teacher (Standard Northern Accent / Giọng Miền Bắc).
          
          Task: Evaluate the pronunciation of the following student recording against the target text: "${targetText}".
          
          Instructions:
          1. Transcribe EXACTLY what the student said into 'spoken_text'. Do not auto-correct. If they said "lói" instead of "nói", transcribe "lói".
          2. Listen carefully for Tones (Dấu thanh). Incorrect tones (hỏi/ngã, sắc/nặng) are errors.
          3. Compare the transcription with the Target Text.
          4. Grading Criteria:
             - 95-100: Perfect pronunciation, native Northern tones.
             - 85-94: Clear, understandable, maybe 1 minor tone slip.
             - 70-84: Understandable but several tone/consonant errors (ngọng).
             - <70: Hard to understand, wrong words, or mostly silence.
          5. Return 'mispronounced_words' as the words from the TARGET text that were read incorrectly.
          6. Provide a 'encouraging_comment' for a 6-year-old child.
          7. Provide 'teacher_notes' identifying specific phonetic errors (e.g., "Sai dấu hỏi/ngã", "Ngọng l/n").`
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
          
          1. Compare Student Input to Target Text.
          2. Check for missing words or typos that indicate mispronunciation.
          3. Grade strictness: High.
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
        temperature: 0.2 // Lower temperature for more consistent/strict grading
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
