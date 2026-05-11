import { NextRequest, NextResponse } from "next/server";
import { products } from "@/data/products";
import type { ProductCategory, ShoeType } from "@/types";

interface StyleAnalysis {
  gender?: "men" | "women" | "unisex";
  productCategories?: ProductCategory[];
  productTypes?: ShoeType[];
  imagePrompt?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      imageBase64: string;
      mimeType: string;
      occasion: string;
      mock?: boolean;
    };
    const { imageBase64, mimeType, occasion, mock } = body;

    // ── Mock mode — returns sample data without touching the AI APIs ──────────
    if (mock) {
      return NextResponse.json({ generatedImage: null, products: products.slice(0, 6) });
    }

    if (!imageBase64 || !occasion) {
      return NextResponse.json({ error: "Brak zdjęcia lub okazji." }, { status: 400 });
    }

    // Dynamic import — loaded at runtime, never touched by webpack at build time
    const { GoogleGenAI } = await import("@google/genai");
    const genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });

    // Step 1: Analyse the photo — get style recommendations + image prompt
    const analysisResponse = await genAI.models.generateContent({
      model: "gemini-2.5-flash-preview-05-20",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: imageBase64 } },
            {
              text: `You are a professional fashion stylist. Analyse this person and create a styled outfit for the occasion: "${occasion}".

Return ONLY valid JSON (no markdown, no code fences):
{
  "gender": "men" or "women" or "unisex",
  "productCategories": array — pick relevant values from ["shoes","socks","apparel","accessories"],
  "productTypes": array — pick relevant values from ["runner","walker","trainer","hiker","slip-on","flat","slide","loafer","tee","hoodie","pant","jacket","cardigan"],
  "imagePrompt": "Photorealistic full-body fashion editorial. [Describe: hair colour, build, skin tone of the person in the photo]. Wearing [describe a complete, stylish outfit perfectly suited for ${occasion}]. Clean neutral background. Natural studio lighting. Sharp focus."
}`,
            },
          ],
        },
      ],
    });

    let analysis: StyleAnalysis = {};
    try {
      const raw = analysisResponse.text ?? "";
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) analysis = JSON.parse(match[0]) as StyleAnalysis;
    } catch {
      // fallback — continue without analysis
    }

    // Step 2: Generate outfit visualisation (person in new clothes)
    const imageGenResponse = await genAI.models.generateContent({
      model: "gemini-2.0-flash-exp-image-generation",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: imageBase64 } },
            {
              text:
                analysis.imagePrompt ??
                `Restyle this person for "${occasion}". Full body fashion photo, clean background, keep the face and hair recognisable. Photorealistic.`,
            },
          ],
        },
      ],
      config: {
        responseModalities: ["IMAGE", "TEXT"],
      },
    });

    let generatedImage: string | null = null;
    const parts = imageGenResponse.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      if (part.inlineData?.mimeType?.startsWith("image/")) {
        generatedImage = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        break;
      }
    }

    // Step 3: Filter catalog products by the recommended categories / types / gender
    const filtered = products.filter((p) => {
      const catOk =
        !analysis.productCategories?.length ||
        analysis.productCategories.includes(p.productCategory);
      const typeOk =
        !analysis.productTypes?.length ||
        analysis.productTypes.includes(p.type);
      const genderOk =
        !analysis.gender ||
        p.category === analysis.gender ||
        p.category === "unisex";
      return catOk && genderOk && typeOk;
    });

    // Fallback: if nothing matched, return first 6 products
    const recommended = filtered.length >= 2 ? filtered.slice(0, 6) : products.slice(0, 6);

    return NextResponse.json({ generatedImage, products: recommended });
  } catch (err) {
    console.error("[style-generator]", err);
    const raw = String(err);
    const isQuota = raw.includes("429") || raw.includes("quota") || raw.includes("RESOURCE_EXHAUSTED");
    const message = isQuota
      ? "Przekroczono limit API Google AI. Sprawdź swoje quota na aistudio.google.com i spróbuj ponownie."
      : "Nie udało się wygenerować stylizacji. Spróbuj ponownie.";
    return NextResponse.json({ error: message }, { status: isQuota ? 429 : 500 });
  }
}
