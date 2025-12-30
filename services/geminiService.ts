
import { GoogleGenerativeAI, Part } from "@google/generative-ai";
import { GeminiFeedbackSchema } from "../types";

const getClient = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("API Key not found. Using mock simulation.");
    return null;
  }
  return new GoogleGenerativeAI(apiKey);
};

export const evaluateReading = async (
  targetText: string,
  userSpokenText: string,
  audioBase64?: string,
  mimeType: string = 'audio/webm'
): Promise<GeminiFeedbackSchema> => {
  const genAI = getClient();

  // Helper for mock response
  const getMockResponse = (spoken: string): GeminiFeedbackSchema => ({
    score: 0,
    mispronounced_words: ["Lỗi", "Kết", "Nối", "API"],
    encouraging_comment: "Hệ thống chưa kết nối được với AI chấm điểm. Vui lòng kiểm tra API Key hoặc mạng.",
    teacher_notes: "DEBUG INFO: Using Mock/Fallback. Logic AI chưa chạy. Nguyên nhân: Không tìm thấy API Key hoặc Lỗi kết nối.",
    spoken_text: spoken || "Không nghe thấy gì...",
  });

  if (!genAI) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(getMockResponse(userSpokenText));
      }, 1500);
    });
  }

  const schema = {
    type: "OBJECT",
    properties: {
      score: { type: "INTEGER", description: "Score from 0 to 100 based on phonetic accuracy." },
      mispronounced_words: {
        type: "ARRAY",
        items: { type: "STRING" },
        description: "List of words the student mispronounced."
      },
      encouraging_comment: { type: "STRING", description: "A short, friendly, encouraging comment in Vietnamese." },
      teacher_notes: { type: "STRING", description: "Technical analysis of errors." },
      spoken_text: { type: "STRING", description: "The exact Vietnamese transcription of what was heard." }
    },
    required: ["score", "mispronounced_words", "encouraging_comment", "teacher_notes", "spoken_text"]
  };

  try {
    let promptParts: any[] = [];

    if (audioBase64) {
      promptParts = [
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
      promptParts = [
        {
          text: `Role: Vietnamese Grade 1 Reading Teacher.
          Target Text: "${targetText}"
          Student Input: "${userSpokenText}"
          Output JSON matching schema.`
        }
      ];
    }

    // PRIMARY ATTEMPT: Gemini 1.5 Flash-8B (Newest, Lightweight, less likely to 404 on beta)
    try {
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash-8b",
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schema as any,
          temperature: 0.4
        }
      });

      const result = await model.generateContent(promptParts);
      const response = result.response;
      return JSON.parse(response.text()) as GeminiFeedbackSchema;

    } catch (primaryError: any) {
      console.warn("Primary Flash-8B Failed, trying Fallback (Standard Flash)...", primaryError);

      // FALLBACK ATTEMPT: Gemini 1.5 Flash (Standard)
      const fallbackModel = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schema as any,
          temperature: 0.4
        }
      });

      const fallbackResult = await fallbackModel.generateContent(promptParts);
      const fallbackResponse = fallbackResult.response;

      const cleanText = fallbackResponse.text().replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleanText) as GeminiFeedbackSchema;
    }

  } catch (error) {
    console.error("Gemini Grading Error (All Models Failed):", error);
    return {
      ...getMockResponse(userSpokenText),
      teacher_notes: `[CODE_VERSION_4.0] Error: ${error instanceof Error ? error.message : String(error)}. Both Flash-8B and Standard Flash models failed.`,
      encouraging_comment: "Có lỗi kết nối nên cô chưa chấm chính xác được. (Chế độ giả lập 0 điểm)"
    };
  }
};
