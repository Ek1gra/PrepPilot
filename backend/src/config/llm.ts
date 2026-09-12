import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey && process.env.NODE_ENV === 'production') {
  throw new Error('GEMINI_API_KEY is required in production');
}

let aiPromise: Promise<any> | null = null;

async function getAI() {
  if (!aiPromise) {
    aiPromise = import('@google/genai').then(({ GoogleGenAI }) => {
      return new GoogleGenAI({
        apiKey: apiKey || 'development-placeholder',
      });
    });
  }

  return aiPromise;
}

export async function generateContentWithRetry(
  prompt: string,
  modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash',
  retries = 4
): Promise<string> {
  let delay = 2500;

  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const ai = await getAI();

      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      return response.text || '{}';
    } catch (error: any) {
      const message = String(error?.message || '');

      const retryable =
        [429, 500, 502, 503, 504].includes(Number(error?.status)) ||
        /429|RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded/i.test(message);

      if (!retryable || attempt === retries - 1) {
        throw error;
      }

      const wait = Math.min(
        30000,
        Math.max(delay, Number(error?.retryDelayMs || 0))
      );

      await new Promise((resolve) => setTimeout(resolve, wait));

      delay *= 1.8;
    }
  }

  throw new Error('LLM retry limit exceeded');
}