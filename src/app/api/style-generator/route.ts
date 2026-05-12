import { NextRequest, NextResponse } from "next/server";
import { products } from "@/data/products";
import type { ProductCategory, ShoeType } from "@/types";

// ── Occasion → product hints (local, zero API calls) ─────────────────────────
const OCCASION_HINTS: Record<string, { categories: ProductCategory[]; types: ShoeType[] }> = {
  "Kolacja":            { categories: ["shoes", "apparel"], types: ["loafer", "flat", "pant", "jacket"] },
  "Grill":              { categories: ["shoes", "apparel"], types: ["slip-on", "slide", "tee", "pant"] },
  "Wycieczka rowerowa": { categories: ["shoes", "apparel"], types: ["trainer", "runner", "tee", "pant"] },
  "Przyjęcie":          { categories: ["shoes", "apparel"], types: ["loafer", "flat", "hoodie", "jacket"] },
  "Wizyta u rodziny":   { categories: ["shoes", "apparel"], types: ["slip-on", "loafer", "tee", "cardigan"] },
  "Praca":              { categories: ["shoes", "apparel"], types: ["walker", "loafer", "pant", "jacket"] },
  "Klub techno":        { categories: ["shoes", "apparel"], types: ["runner", "trainer", "hoodie", "pant"] },
  "Piwo na mieście":    { categories: ["shoes", "apparel"], types: ["slip-on", "runner", "tee", "hoodie"] },
};

// ── Occasion → image-gen prompt ───────────────────────────────────────────────
const OCCASION_PROMPTS: Record<string, string> = {
  "Kolacja":            "elegant dinner outfit — tailored trousers, blazer, dress shoes",
  "Grill":              "casual summer BBQ outfit — relaxed tee, chinos, slip-on sneakers",
  "Wycieczka rowerowa": "sporty cycling look — technical tee, joggers, running shoes",
  "Przyjęcie":          "stylish party outfit — smart-casual jacket, slim trousers, loafers",
  "Wizyta u rodziny":   "cosy family-visit look — cardigan, relaxed trousers, slip-on shoes",
  "Praca":              "smart office outfit — button-up shirt, tailored pants, oxford shoes",
  "Klub techno":        "edgy club look — black hoodie, cargo pants, chunky trainers",
  "Piwo na mieście":    "relaxed city look — graphic tee, straight jeans, clean sneakers",
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      imageBase64: string;
      mimeType: string;
      occasion: string;
      mock?: boolean;
    };
    const { imageBase64, mimeType, occasion, mock } = body;

    // ── Mock mode ─────────────────────────────────────────────────────────────
    if (mock) {
      const mockProductIds = ["1", "25", "41", "27", "22", "42"];
      const mockProducts = mockProductIds
        .map((id) => products.find((p) => p.id === id))
        .filter(Boolean) as typeof products;
      return NextResponse.json({
        generatedImage: "/images/mock-generated.jpg",
        products: mockProducts,
      });
    }

    if (!imageBase64 || !occasion) {
      return NextResponse.json({ error: "Brak zdjęcia lub okazji." }, { status: 400 });
    }

    // ── Single API call: image generation only ────────────────────────────────
    const { GoogleGenAI } = await import("@google/genai");
    const genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });

    const outfitDesc = OCCASION_PROMPTS[occasion] ?? `stylish outfit for ${occasion}`;
    const prompt = `Restyle this person wearing a ${outfitDesc}. Full body fashion editorial photo. Keep face and hair recognisable. Clean neutral background. Photorealistic.`;

    const imageGenResponse = await genAI.models.generateContent({
      model: "gemini-2.0-flash-exp-image-generation",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: imageBase64 } },
            { text: prompt },
          ],
        },
      ],
      config: { responseModalities: ["IMAGE", "TEXT"] },
    });

    let generatedImage: string | null = null;
    const parts = imageGenResponse.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      if (part.inlineData?.mimeType?.startsWith("image/")) {
        generatedImage = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        break;
      }
    }

    // ── Filter products locally by occasion hints ─────────────────────────────
    const hints = OCCASION_HINTS[occasion];
    const filtered = hints
      ? products.filter(
          (p) =>
            hints.categories.includes(p.productCategory) &&
            hints.types.includes(p.type as ShoeType),
        )
      : [];
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
