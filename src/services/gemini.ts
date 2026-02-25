import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  return new GoogleGenAI({ apiKey });
};

export async function transcribeMedia(
  fileBase64: string,
  mimeType: string,
  prompt: string = "Please provide a high-quality, verbatim transcription of this media file. Include speaker labels if there are multiple speakers. Format the output clearly with timestamps if possible."
): Promise<string> {
  const ai = getAI();
  
  const mediaPart = {
    inlineData: {
      data: fileBase64,
      mimeType: mimeType,
    },
  };

  const textPart = {
    text: prompt,
  };

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts: [mediaPart, textPart] },
  });

  return response.text || "No transcription generated.";
}

export async function generateBRD(
  transcription: string,
  notes: string,
  sampleFiles: { data?: string; text?: string; mimeType: string; name: string }[]
): Promise<string> {
  const ai = getAI();

  const parts: any[] = [
    {
      text: `You are an expert Business Analyst. I will provide you with a transcription of a meeting/discussion, some additional notes, and sample Business Requirements Documents (BRDs).
      
      Your task is to create a comprehensive, professional BRD based on the transcription and the notes. 
      
      FORMATTING REQUIREMENTS:
      1. Use high-quality Markdown formatting.
      2. Use clear headings (H1, H2, H3).
      3. Use TABLES for structured data like stakeholder lists, functional requirements, and project timelines.
      4. Use bullet points for lists.
      5. Maintain a professional, formal tone.
      
      CRITICAL: You MUST follow the structure, level of detail, tone, and language style of the attached sample documents if provided. If no samples are provided, use a standard professional BRD structure (Executive Summary, Project Scope, Stakeholders, Functional Requirements, Non-Functional Requirements, etc.).
      
      Transcription:
      ${transcription}
      
      Additional Notes:
      ${notes}
      
      Please generate the professional BRD now, strictly adhering to the style of the samples provided and using markdown tables where appropriate.`
    }
  ];

  // Add sample files as parts
  sampleFiles.forEach((file) => {
    if (file.text) {
      parts.push({
        text: `Sample Document (${file.name}):\n${file.text}`
      });
    } else if (file.data && file.mimeType === "application/pdf") {
      parts.push({
        inlineData: {
          data: file.data,
          mimeType: file.mimeType,
        },
      });
    }
  });

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts },
  });

  return response.text || "Failed to generate BRD.";
}
