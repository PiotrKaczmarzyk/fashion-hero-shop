import Link from "next/link";

export function StyleGeneratorBanner() {
  return (
    <section className="bg-charcoal text-white">
      <div className="max-w-6xl mx-auto px-6 py-14 flex flex-col md:flex-row items-center justify-between gap-8">
        {/* Left: copy */}
        <div className="text-center md:text-left">
          <p className="text-[11px] font-medium uppercase tracking-[1.2px] text-white/50 mb-3">
            Nowa funkcja · Powered by Gemini AI
          </p>
          <h2 className="text-2xl md:text-3xl font-light tracking-wide mb-3">
            Generator Stylu ✨
          </h2>
          <p className="text-white/60 text-sm leading-relaxed max-w-md">
            Wgraj swoje zdjęcie, wybierz okazję i zobacz siebie w nowej stylizacji.
            AI dobierze też pasujące produkty z naszego katalogu.
          </p>
        </div>

        {/* Right: occasion pills preview + CTA */}
        <div className="flex flex-col items-center gap-5 shrink-0">
          <div className="flex flex-wrap justify-center gap-2 max-w-xs">
            {["🍽️ Kolacja", "🔥 Grill", "🎵 Klub techno", "💼 Praca", "🍺 Piwo na mieście"].map((label) => (
              <span
                key={label}
                className="text-[11px] px-3 py-1.5 rounded-full border border-white/20 text-white/70"
              >
                {label}
              </span>
            ))}
            <span className="text-[11px] px-3 py-1.5 rounded-full border border-white/20 text-white/40 italic">
              +3 więcej
            </span>
          </div>

          <Link
            href="/style-generator"
            className="inline-flex items-center justify-center px-8 py-3 text-[12px] font-medium uppercase tracking-[0.8px] bg-white text-charcoal rounded-full hover:bg-white/90 transition-all duration-200 active:scale-95"
          >
            Wypróbuj Generator Stylu
          </Link>
        </div>
      </div>
    </section>
  );
}
