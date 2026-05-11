"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useCart } from "@/components/cart-provider";
import type { Product } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const OCCASIONS = [
  { id: "Kolacja", label: "Kolacja", emoji: "🍽️" },
  { id: "Grill", label: "Grill", emoji: "🔥" },
  { id: "Wycieczka rowerowa", label: "Wycieczka rowerowa", emoji: "🚴" },
  { id: "Przyjęcie", label: "Przyjęcie", emoji: "🎉" },
  { id: "Wizyta u rodziny", label: "Wizyta u rodziny", emoji: "🏠" },
  { id: "Praca", label: "Praca", emoji: "💼" },
  { id: "Klub techno", label: "Klub techno", emoji: "🎵" },
  { id: "Piwo na mieście", label: "Piwo na mieście", emoji: "🍺" },
] as const;

const STATUS_MESSAGES = [
  "Analizuję Twoje zdjęcie...",
  "Wybieram styl na okazję...",
  "Generuję wizualizację stylizacji...",
  "Dobieram produkty z katalogu...",
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = "upload" | "occasion" | "generating" | "result";

interface StyleResult {
  generatedImage: string | null;
  products: Product[];
}

// ─── Image helpers ────────────────────────────────────────────────────────────

async function resizeToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve) => {
    const img = document.createElement("img");
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1024;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width >= height) {
          height = Math.round((height * MAX) / width);
          width = MAX;
        } else {
          width = Math.round((width * MAX) / height);
          height = MAX;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(objectUrl);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      resolve({ base64: dataUrl.split(",")[1], mimeType: "image/jpeg" });
    };
    img.src = objectUrl;
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StyleGeneratorPage() {
  const [step, setStep] = useState<Step>("upload");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [selectedOccasion, setSelectedOccasion] = useState<string | null>(null);
  const [statusIndex, setStatusIndex] = useState(0);
  const [result, setResult] = useState<StyleResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addedToCart, setAddedToCart] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const statusTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { addItem, openCart } = useCart();

  // ── File handling ──────────────────────────────────────────────────────────

  const acceptFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setStep("occasion");
    setError(null);
  }, [photoPreview]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) acceptFile(file);
  }, [acceptFile]);

  // ── Generation ─────────────────────────────────────────────────────────────

  const startGeneration = useCallback(async (occasion: string, mockMode = false) => {
    if (!mockMode && !photoFile) return;

    setSelectedOccasion(occasion);
    setStep("generating");
    setStatusIndex(0);
    setError(null);

    let idx = 0;
    statusTimerRef.current = setInterval(() => {
      idx = Math.min(idx + 1, STATUS_MESSAGES.length - 1);
      setStatusIndex(idx);
    }, 4500);

    try {
      let base64 = "";
      let mimeType = "image/jpeg";
      if (!mockMode && photoFile) {
        ({ base64, mimeType } = await resizeToBase64(photoFile));
      }

      const res = await fetch("/api/style-generator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType, occasion, mock: mockMode }),
      });

      const data = (await res.json()) as StyleResult & { error?: string };

      if (!res.ok) throw new Error(data.error ?? (res.status === 429 ? "Przekroczono limit API. Sprawdź quota na aistudio.google.com." : "Błąd serwera"));

      setResult(data);
      setStep("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Coś poszło nie tak.");
      setStep("occasion");
    } finally {
      if (statusTimerRef.current) {
        clearInterval(statusTimerRef.current);
        statusTimerRef.current = null;
      }
    }
  }, [photoFile]);

  // ── Cart ───────────────────────────────────────────────────────────────────

  const handleAddToCart = useCallback((product: Product) => {
    addItem(product, product.colors[0], product.sizes[0]);
    setAddedToCart(product.id);
    setTimeout(() => setAddedToCart(null), 2000);
    openCart();
  }, [addItem, openCart]);

  // ── Reset ──────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
    setSelectedOccasion(null);
    setResult(null);
    setError(null);
    setStatusIndex(0);
    setStep("upload");
  }, [photoPreview]);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-cream-light">
      {/* Top bar */}
      <div className="border-b border-black/10 bg-white sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="text-[11px] font-medium uppercase tracking-wider text-warm-gray hover:text-charcoal transition-colors"
          >
            ← Powrót
          </Link>
          <span className="text-[13px] font-medium uppercase tracking-[1px]">
            Generator Stylu ✨
          </span>
          <div className="w-20" />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12">

        {/* ── UPLOAD ──────────────────────────────────────────────────────── */}
        {step === "upload" && (
          <div className="max-w-lg mx-auto">
            <div className="text-center mb-10">
              <p className="text-[11px] font-medium uppercase tracking-wider text-warm-gray mb-3">
                Powered by Gemini AI
              </p>
              <h1 className="text-3xl font-light tracking-wide mb-3">
                Generator Stylu
              </h1>
              <p className="text-warm-gray text-sm leading-relaxed">
                Wgraj swoje zdjęcie, wybierz okazję i zobacz siebie w nowej stylizacji.
                <br />AI dobierze też pasujące produkty z naszego katalogu.
              </p>
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={[
                "border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all duration-200",
                isDragging
                  ? "border-charcoal bg-charcoal/5 scale-[1.01]"
                  : "border-black/20 hover:border-black/40 hover:bg-white",
              ].join(" ")}
            >
              <div className="text-5xl mb-5">📸</div>
              <p className="text-[14px] font-medium mb-1">Przeciągnij zdjęcie tutaj</p>
              <p className="text-sm text-warm-gray">lub kliknij, aby wybrać z dysku</p>
              <p className="text-xs text-warm-gray/50 mt-4">JPG, PNG, WEBP · maks. 10 MB</p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) acceptFile(file);
                e.target.value = "";
              }}
            />

            {/* Dev shortcut — visible on upload step too */}
            <div className="mt-6 text-center">
              <button
                onClick={() => startGeneration("Kolacja", true)}
                className="text-xs font-medium text-warm-gray/50 hover:text-charcoal underline underline-offset-2 transition-colors"
              >
                🧪 Testuj bez AI (dane mockowe)
              </button>
            </div>
          </div>
        )}

        {/* ── OCCASION ────────────────────────────────────────────────────── */}
        {step === "occasion" && (
          <div className="max-w-2xl mx-auto">
            {/* Photo preview row */}
            <div className="flex items-center gap-4 mb-8">
              <button
                onClick={() => setStep("upload")}
                className="text-[11px] font-medium uppercase tracking-wider text-warm-gray hover:text-charcoal transition-colors"
              >
                ← Zmień zdjęcie
              </button>
              {photoPreview && (
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-black/10 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoPreview} alt="podgląd" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            <div className="text-center mb-8">
              <h2 className="text-2xl font-light tracking-wide mb-2">Na jaką okazję?</h2>
              <p className="text-sm text-warm-gray">
                AI dopasuje stylizację i produkty do wybranej okazji
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 text-center">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {OCCASIONS.map((occ) => (
                <button
                  key={occ.id}
                  onClick={() => startGeneration(occ.id)}
                  className="flex flex-col items-center gap-2 p-5 rounded-2xl border border-black/10 bg-white hover:border-charcoal hover:shadow-md transition-all duration-150 active:scale-95"
                >
                  <span className="text-3xl">{occ.emoji}</span>
                  <span className="text-[12px] font-medium text-center leading-tight">
                    {occ.label}
                  </span>
                </button>
              ))}
            </div>

            {/* Dev shortcut — skips AI entirely */}
            <div className="mt-8 text-center">
              <p className="text-xs text-warm-gray/50 mb-2">Chcesz przetestować widok wyników bez zużywania tokenów AI?</p>
              <button
                onClick={() => startGeneration("Kolacja", true)}
                className="text-xs font-medium text-warm-gray/60 hover:text-charcoal underline underline-offset-2 transition-colors"
              >
                🧪 Testuj bez AI (dane mockowe)
              </button>
            </div>
          </div>
        )}

        {/* ── GENERATING ──────────────────────────────────────────────────── */}
        {step === "generating" && (
          <div className="max-w-sm mx-auto text-center py-20">
            {photoPreview && (
              <div className="relative w-24 h-24 mx-auto mb-8">
                <div className="absolute inset-0 rounded-full border-4 border-charcoal/20 animate-ping" />
                <div className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoPreview}
                    alt="Twoje zdjęcie"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}

            <p className="text-lg font-light tracking-wide mb-2 min-h-[28px] transition-all duration-500">
              {STATUS_MESSAGES[statusIndex]}
            </p>
            <p className="text-sm text-warm-gray mb-8">
              Okazja:{" "}
              <span className="font-medium text-charcoal">{selectedOccasion}</span>
            </p>

            {/* Progress bar */}
            <div className="flex justify-center gap-1.5 mb-6">
              {STATUS_MESSAGES.map((_, i) => (
                <div
                  key={i}
                  className={[
                    "h-1 rounded-full transition-all duration-700",
                    i <= statusIndex ? "bg-charcoal w-8" : "bg-black/15 w-2",
                  ].join(" ")}
                />
              ))}
            </div>

            {/* Bouncing dots */}
            <div className="flex justify-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full bg-charcoal/40 animate-bounce"
                  style={{ animationDelay: `${i * 0.18}s` }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── RESULT ──────────────────────────────────────────────────────── */}
        {step === "result" && result && (
          <div>
            {/* Header row */}
            <div className="flex items-start justify-between mb-8 gap-4">
              <div>
                <h2 className="text-2xl font-light tracking-wide mb-1">
                  Twoja stylizacja
                </h2>
                <p className="text-sm text-warm-gray">
                  Okazja:{" "}
                  <span className="font-medium text-charcoal">{selectedOccasion}</span>
                </p>
              </div>
              <button
                onClick={reset}
                className="shrink-0 text-[11px] font-medium uppercase tracking-wider border border-black/20 px-5 py-2.5 rounded-full hover:border-charcoal hover:bg-charcoal hover:text-white transition-all duration-200"
              >
                Zacznij od nowa
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-10">

              {/* Generated image */}
              <div className="order-1">
                <p className="text-[11px] font-medium uppercase tracking-wider text-warm-gray mb-3">
                  Wygenerowana stylizacja
                </p>
                <div className="rounded-2xl overflow-hidden bg-cream aspect-[3/4] shadow-sm">
                  {result.generatedImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={result.generatedImage}
                      alt="Wygenerowana stylizacja"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-warm-gray">
                      <span className="text-5xl">👗</span>
                      <p className="text-sm">Brak wizualizacji</p>
                      <p className="text-xs opacity-60">
                        Imagen nie zwrócił obrazu — sprawdź limity API
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Recommended products */}
              <div className="order-2">
                <p className="text-[11px] font-medium uppercase tracking-wider text-warm-gray mb-3">
                  Pasujące produkty · {result.products.length}
                </p>

                <div className="grid grid-cols-2 gap-4">
                  {result.products.map((product) => (
                    <ProductRecommendation
                      key={product.id}
                      product={product}
                      isAdded={addedToCart === product.id}
                      onAddToCart={handleAddToCart}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}

// ─── Product card for results ─────────────────────────────────────────────────

interface ProductRecommendationProps {
  product: Product;
  isAdded: boolean;
  onAddToCart: (product: Product) => void;
}

function ProductRecommendation({ product, isAdded, onAddToCart }: ProductRecommendationProps) {
  const color = product.colors[0];

  return (
    <div className="group">
      <Link href={`/products/${product.slug}`}>
        <div
          className="aspect-square rounded-xl overflow-hidden mb-2 transition-transform duration-300 group-hover:scale-[1.02]"
          style={{
            background: `radial-gradient(ellipse at 50% 65%, ${color.hex}40 0%, #ece9e2 70%)`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={color.image}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        </div>
      </Link>

      <Link href={`/products/${product.slug}`} className="block mb-0.5">
        <p className="text-[12px] font-medium uppercase tracking-[0.3px] truncate hover:underline">
          {product.name}
        </p>
      </Link>
      <p className="text-[13px] font-medium mb-2">{product.price} zł</p>

      <button
        onClick={() => onAddToCart(product)}
        className={[
          "w-full py-2 text-[11px] font-medium uppercase tracking-wider rounded-lg transition-all duration-200",
          isAdded
            ? "bg-green-600 text-white"
            : "bg-charcoal text-white hover:bg-charcoal/80 active:scale-[0.98]",
        ].join(" ")}
      >
        {isAdded ? "✓ Dodano!" : "Dodaj do koszyka"}
      </button>
    </div>
  );
}
