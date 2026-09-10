import { useEffect, useRef, useState } from "react";

const AUTO_ROTATE_MS = 4500;
const SWIPE_DISTANCE_PX = 44;

const BANNER_SLIDES = [
  {
    id: "build-pc",
    image: "/catalogue-banners/build-pc.webp",
    alt: "Build PC tối ưu ngân sách tại Phước Tài Computer"
  },
  { 
    id: "used-components",
    image: "/catalogue-banners/linh-kien-cu-moi.webp",
    alt: "Linh kiện máy tính cũ mới tại Phước Tài Computer"
  },
  {
  id: "trade-in-upgrade",
  image: "/catalogue-banners/thu-cu-doi-moi.webp",
  alt: "Thu cũ đổi mới bù chênh lệch tại Phước Tài Computer"
  }
  ];

function ArrowIcon({ direction }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d={direction === "next" ? "m9 5 7 7-7 7" : "m15 5-7 7 7 7"} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PublicAdvertisingCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [isFocusWithin, setIsFocusWithin] = useState(false);
  const [isPointerActive, setIsPointerActive] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const pointerStartXRef = useRef(null);
  const isPaused = isHovering || isFocusWithin || isPointerActive;

  useEffect(() => {
    const mediaQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mediaQuery) return undefined;

    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);
    updatePreference();
    mediaQuery.addEventListener?.("change", updatePreference);
    return () => mediaQuery.removeEventListener?.("change", updatePreference);
  }, []);

  useEffect(() => {
    if (BANNER_SLIDES.length < 2 || isPaused || prefersReducedMotion) return undefined;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % BANNER_SLIDES.length);
    }, AUTO_ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [isPaused, prefersReducedMotion]);

  function showPreviousSlide() {
    setActiveIndex((current) => (current - 1 + BANNER_SLIDES.length) % BANNER_SLIDES.length);
  }

  function showNextSlide() {
    setActiveIndex((current) => (current + 1) % BANNER_SLIDES.length);
  }

  function handlePointerDown(event) {
    if (BANNER_SLIDES.length < 2) return;
    pointerStartXRef.current = event.clientX;
    setIsPointerActive(true);
  }

  function handlePointerUp(event) {
    if (pointerStartXRef.current === null) return;
    const distance = event.clientX - pointerStartXRef.current;
    pointerStartXRef.current = null;
    setIsPointerActive(false);
    if (Math.abs(distance) < SWIPE_DISTANCE_PX) return;
    if (distance < 0) showNextSlide();
    else showPreviousSlide();
  }

  function handlePointerCancel() {
    pointerStartXRef.current = null;
    setIsPointerActive(false);
  }

  return (
    <section aria-label="Quảng cáo PHƯỚC TÀI COMPUTER" className="w-full overflow-hidden border-b border-blue-200/20 bg-[#071a44]">
      <div
        className="group relative aspect-[2169/240] w-full touch-pan-y overflow-hidden bg-[linear-gradient(110deg,#071a44_0%,#0b2f6a_55%,#0b4fb3_100%)]"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onFocus={() => setIsFocusWithin(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setIsFocusWithin(false);
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        {BANNER_SLIDES.length === 0 && (
          <div className="flex h-full items-center justify-center px-4 text-center">
            <p className="text-[clamp(0.6875rem,0.7vw,0.875rem)] font-semibold uppercase tracking-[0.16em] text-blue-100/70">
              Khu vực banner quảng cáo
            </p>
          </div>
        )}

        {BANNER_SLIDES.map((slide, index) => (
          <img
            key={slide.id}
            src={slide.image}
            alt={slide.alt}
            loading={index === 0 ? "eager" : "lazy"}
            fetchPriority={index === 0 ? "high" : "auto"}
            draggable="false"
            className={`absolute inset-0 h-full w-full select-none object-cover transition-opacity duration-700 motion-reduce:transition-none ${
              index === activeIndex ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          />
        ))}

        {BANNER_SLIDES.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Banner trước"
              onClick={showPreviousSlide}
              className="absolute left-1 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md bg-transparent text-white/80 transition-colors hover:bg-black/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:flex"
            >
              <ArrowIcon direction="previous" />
            </button>
            <button
              type="button"
              aria-label="Banner tiếp theo"
              onClick={showNextSlide}
              className="absolute right-1 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md bg-transparent text-white/80 transition-colors hover:bg-black/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:flex"
            >
              <ArrowIcon direction="next" />
            </button>
          </>
        )}

      </div>
    </section>
  );
}
