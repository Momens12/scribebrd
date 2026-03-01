import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";

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
    ? `يرجى تقديم نسخة مكتوبة احترافية وعالية الجودة وحرفية لملف الوسائط هذا باللغة العربية.
       يجب أن يتبع التنسيق هذا الهيكل الدقيق:
       1. العنوان: (اسم الملف أو موضوعه)
       2. اللغة: (العربية مع تحديد اللهجة إن وجدت)
       3. الطوابع الزمنية: استخدم تنسيق [MM:SS] في بداية كل فقرة حديث أو تغيير متحدث.
       4. تسميات المتحدثين: (الاسم: النص).
       5. توثيق فترات الصمت أو الضجيج بوضوح (مثلاً: [00:00 - 00:10] صمت).
       6. تأكد من أن النص منسق بشكل جيد وسهل القراءة.`
    : `Please provide a professional, high-quality verbatim transcription of this media file in English.
       The format MUST follow this exact structure:
       1. Title: (File name or topic)
       2. Language: (English and context)
       3. Timestamps: Use [MM:SS] format at the start of every speech segment or speaker change.
       4. Speaker Labels: (Name: Text).
       5. Document silence or background noise clearly (e.g., [00:00 - 00:10] Silence).
       6. Ensure the output is well-structured and easy to read.`;

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

export async function refineBRD(
  currentContent: string,
  command: string,
  language: 'en' | 'ar' = 'en'
): Promise<string> {
  const ai = getAI();

  const systemInstruction = language === 'ar'
    ? `أنت محلل أعمال خبير. مهمتك هي تعديل وثيقة متطلبات العمل (BRD) الحالية بناءً على تعليمات المستخدم.
      
      يجب عليك:
      1. الحفاظ على تنسيق Markdown والجداول المستخدمة في الوثيقة الأصلية.
      2. تطبيق التعديلات المطلوبة بدقة مع الحفاظ على اتساق الوثيقة بالكامل.
      3. الرد بالوثيقة المعدلة بالكامل فقط. لا تضف أي شرح أو تعليقات خارج الوثيقة.
      4. استخدام اللغة العربية.`
    : `You are an expert Business Analyst. Your task is to modify the current Business Requirements Document (BRD) based on the user's instructions.
      
      You MUST:
      1. Maintain the Markdown formatting and tables used in the original document.
      2. Apply the requested modifications precisely while keeping the entire document consistent.
      3. Respond with the FULL modified document only. Do not add any explanations or comments outside the document.
      4. Use English.`;

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        role: 'user',
        parts: [
          { text: `${systemInstruction}\n\nCurrent BRD Content:\n${currentContent}\n\nUser Command:\n${command}` }
        ]
      }
    ]
  });

  return response.text || currentContent;
}

export async function generateWorkflowXML(
  steps: string,
  language: 'en' | 'ar' = 'en'
): Promise<string> {
  const ai = getAI();

  const systemInstruction = `You are a professional workflow architect. Convert the following steps into a high-quality, semantic Draw.io mxGraphModel XML.
  
  STRICT VISUAL RULES:
  1. Start/End Nodes: Use style="ellipse;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;" and vertex="1".
  2. Decision Nodes: Use style="rhombus;whiteSpace=wrap;html=1;" and vertex="1".
  3. Process Nodes: Use style="rounded=0;whiteSpace=wrap;html=1;" and vertex="1".
  4. Semantic Colors:
     - Rejected/Error: fillColor=#f8cecc;strokeColor=#b85450;
     - In Progress/Approved: fillColor=#dae8fc;strokeColor=#6c8ebf;
     - Warning/Alert: fillColor=#fff2cc;strokeColor=#d6b656;
  5. Edges: Use style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;" and edge="1".
     - CRITICAL: Edges MUST use 'source' and 'target' attributes referring to node IDs.
     - DO NOT use <mxPoint> or <Array> tags for edges.
  6. Labels: ALL decision branches MUST have labels (e.g., "Yes", "No", "Approve", "Reject") using the value attribute on the edge cell.
  7. Layout: 
     - Vertical top-to-bottom flow.
     - Start at x=100, y=40.
     - Space nodes vertically by at least 100 units.
     - Keep all x coordinates between 0 and 800.
     - Keep all y coordinates between 0 and 2000.
     - Branch decisions to the sides (left/right) to avoid overlapping.

  STRICT XML RULES:
  1. Return ONLY the XML string starting with <mxGraphModel>.
  2. NO markdown code blocks. NO explanations.
  3. NO <Array> tags. NO <mxPoint> tags.
  4. Use standard IDs (0 for root, 1 for layer).
  5. Use UNIQUE alphanumeric IDs for all other nodes and edges (e.g., "node1", "edge1").
  6. Language: ${language}.
  
  TEMPLATE:
  <mxGraphModel>
    <root>
      <mxCell id="0" />
      <mxCell id="1" parent="0" />
      <mxCell id="start" value="Start" style="ellipse;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;" vertex="1" parent="1">
        <mxGeometry x="100" y="40" width="80" height="80" as="geometry" />
      </mxCell>
      <mxCell id="edge1" value="Next Step" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;" edge="1" parent="1" source="start" target="process1">
        <mxGeometry relative="1" as="geometry" />
      </mxCell>
      <mxCell id="process1" value="Process" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="1">
        <mxGeometry x="100" y="200" width="120" height="60" as="geometry" />
      </mxCell>
    </root>
  </mxGraphModel>
  
  Input Steps:
  ${steps}`;

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: 'user', parts: [{ text: systemInstruction }] }],
  });

  let xml = response.text || "";
  xml = xml.replace(/```xml/g, "").replace(/```/g, "").trim();
  
  // If the AI outputted a JSON array or object, try to extract XML from it
  if (xml.startsWith('[') || xml.startsWith('{')) {
    try {
      // This is a last resort if the AI ignored the "ONLY XML" rule
      const parsed = JSON.parse(xml);
      if (typeof parsed === 'string') xml = parsed;
      else if (Array.isArray(parsed)) xml = parsed.join('');
    } catch (e) {
      // Not JSON, continue with string processing
    }
  }
  
  const startTag = '<mxGraphModel';
  const endTag = '</mxGraphModel>';
  const startIndex = xml.indexOf(startTag);
  const endIndex = xml.lastIndexOf(endTag);
  
  if (startIndex !== -1 && endIndex !== -1) {
    xml = xml.substring(startIndex, endIndex + endTag.length);
  } else {
    console.error("Failed to find <mxGraphModel> in AI response:", xml);
  }

  // Brute-force remove any <Array> or <mxPoint> tags which cause Draw.io to fail in this environment
  xml = xml.replace(/<Array[^>]*>/g, '').replace(/<\/Array>/g, '');
  xml = xml.replace(/<mxPoint[^>]*>/g, '').replace(/<\/mxPoint>/g, '');
  
  return xml;
}

export async function extractWorkflowsFromBRD(
  brdContent: string,
  language: 'en' | 'ar' = 'en'
): Promise<string[]> {
  const ai = getAI();

  const systemInstruction = language === 'ar'
    ? `أنت خبير في تحليل العمليات. استخرج جميع مسارات العمل (Workflows) المذكورة في وثيقة متطلبات العمل (BRD) التالية.
       لكل مسار عمل، قدم وصفاً تسلسلياً واضحاً للخطوات.
       يجب أن تكون المخرجات بتنسيق JSON كقائمة من النصوص.`
    : `You are a process analysis expert. Extract all workflows mentioned in the following Business Requirements Document (BRD).
       For each workflow, provide a clear sequential description of the steps.
       The output MUST be a JSON array of strings.`;

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: 'user', parts: [{ text: `${systemInstruction}\n\nBRD Content:\n${brdContent}` }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });

  try {
    const text = response.text || "[]";
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse workflows JSON:", e);
    return [];
  }
}
