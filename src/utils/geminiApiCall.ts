import { GoogleGenAI } from "@google/genai";

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is required");
  }
  
  return new GoogleGenAI({
    apiKey: apiKey,
  });
};

interface GeminiCallOptions {
  model?: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}


export async function callGeminiAPI(options: GeminiCallOptions): Promise<string> {
  const {
    model = "gemini-2.5-flash",
    prompt,
    maxTokens,
    temperature,
  } = options;

  try {
    const ai = getGeminiClient();
    
    const generationConfig: Record<string, unknown> = {};
    if (maxTokens) generationConfig.maxOutputTokens = maxTokens;
    if (temperature !== undefined) generationConfig.temperature = temperature;

    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }],
      ...(Object.keys(generationConfig).length > 0 && { generationConfig }),
    });

    if (!response.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error("No response text received from Gemini API");
    }

    return response.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw new Error(`Gemini API call failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}


export async function generateText(prompt: string): Promise<string> {
  return callGeminiAPI({ prompt });
}
 