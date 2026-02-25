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
  language: 'en' | 'ar' = 'en'
): Promise<string> {
  const ai = getAI();
  
  const prompt = language === 'ar' 
    ? "يرجى تقديم نسخة مكتوبة عالية الجودة وحرفية لملف الوسائط هذا باللغة العربية. قم بتضمين تسميات المتحدثين إذا كان هناك عدة متحدثين. قم بتنسيق المخرجات بوضوح مع الطوابع الزمنية إن أمكن."
    : "Please provide a high-quality, verbatim transcription of this media file in English. Include speaker labels if there are multiple speakers. Format the output clearly with timestamps if possible.";

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
  sampleFiles: { data?: string; text?: string; mimeType: string; name: string }[],
  language: 'en' | 'ar' = 'en'
): Promise<string> {
  const ai = getAI();

  const systemInstruction = language === 'ar'
    ? `أنت محلل أعمال خبير. سأزودك بنسخة مكتوبة من اجتماع/مناقشة، وبعض الملاحظات الإضافية، ونماذج من وثائق متطلبات العمل (BRDs).
      
      مهمتك هي إنشاء وثيقة متطلبات عمل (BRD) شاملة واحترافية بناءً على النسخة المكتوبة والملاحظات باللغة العربية.
      
      متطلبات التنسيق:
      1. استخدم تنسيق Markdown عالي الجودة.
      2. استخدم عناوين واضحة (H1, H2, H3).
      3. استخدم الجداول للبيانات المنظمة مثل قوائم أصحاب المصلحة، والمتطلبات الوظيفية، والجداول الزمنية للمشروع.
      4. استخدم النقاط للقوائم.
      5. حافظ على نبرة مهنية ورسمية.
      
      هام جداً: يجب عليك اتباع الهيكل ومستوى التفاصيل والنبرة وأسلوب اللغة الخاص بالنماذج المرفقة إذا تم توفيرها. إذا لم يتم توفير نماذج، فاستخدم هيكل BRD احترافي قياسي (ملخص تنفيذي، نطاق المشروع، أصحاب المصلحة، المتطلبات الوظيفية، المتطلبات غير الوظيفية، إلخ).
      
      يرجى إنشاء وثيقة متطلبات العمل الاحترافية الآن باللغة العربية، مع الالتزام الصارم بأسلوب النماذج المقدمة واستخدام جداول markdown حيثما كان ذلك مناسباً.`
    : `You are an expert Business Analyst. I will provide you with a transcription of a meeting/discussion, some additional notes, and sample Business Requirements Documents (BRDs).
      
      Your task is to create a comprehensive, professional BRD based on the transcription and the notes in English. 
      
      FORMATTING REQUIREMENTS:
      1. Use high-quality Markdown formatting.
      2. Use clear headings (H1, H2, H3).
      3. Use TABLES for structured data like stakeholder lists, functional requirements, and project timelines.
      4. Use bullet points for lists.
      5. Maintain a professional, formal tone.
      
      CRITICAL: You MUST follow the structure, level of detail, tone, and language style of the attached sample documents if provided. If no samples are provided, use a standard professional BRD structure (Executive Summary, Project Scope, Stakeholders, Functional Requirements, Non-Functional Requirements, etc.).
      
      Please generate the professional BRD now in English, strictly adhering to the style of the samples provided and using markdown tables where appropriate.`;

  const parts: any[] = [
    {
      text: `${systemInstruction}
      
      Transcription:
      ${transcription}
      
      Additional Notes:
      ${notes}`
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
