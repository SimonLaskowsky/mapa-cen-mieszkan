'use client';

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { CITIES, CITY_ORDER } from '@/lib/cities';

const PX = 4; // pixel block size
const COLS = 10;
const ROWS = 8;
const BG = '#05080a';

// Seeded random for consistent pixel pattern
function seededRandom(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 49271;
  return x - Math.floor(x);
}

function PixelFade({ side }: { side: 'left' | 'right' }) {
  const pixels = useMemo(() => {
    const cells: { col: number; row: number; opacity: number }[] = [];
    for (let col = 0; col < COLS; col++) {
      for (let row = 0; row < ROWS; row++) {
        const dist = side === 'left' ? col / (COLS - 1) : 1 - col / (COLS - 1);
        const prob = 1 - dist;
        const rand = seededRandom(col * 31 + row * 17 + (side === 'left' ? 0 : 997));
        if (rand < prob) {
          const opacity = prob > 0.7 ? 1 : 0.7 + rand * 0.3;
          cells.push({ col, row, opacity });
        }
      }
    }
    return cells;
  }, [side]);

  return (
    <div
      className="absolute top-0 bottom-0 z-10 pointer-events-none"
      style={{
        [side]: 0,
        width: COLS * PX,
      }}
    >
      {pixels.map(({ col, row, opacity }, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: col * PX,
            top: row * PX,
            width: PX,
            height: PX,
            background: BG,
            opacity,
          }}
        />
      ))}
    </div>
  );
}

interface CitySelectorProps {
  currentCity: string;
  onCityChange: (cityId: string) => void;
}

export default function CitySelector({ currentCity, onCityChange }: CitySelectorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const animRef = useRef<number>(0);
  const pauseTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const offsetRef = useRef(0); // current translateX offset (negative = scrolled right)

  const cities = [...CITY_ORDER, ...CITY_ORDER, ...CITY_ORDER];

  const pausedRef = useRef(false);
  const hoveredRef = useRef(false);
  const draggingRef = useRef(false);
  const setWidthRef = useRef(0); // width of one set of cities

  useEffect(() => { pausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { hoveredRef.current = isHovered; }, [isHovered]);
  useEffect(() => { draggingRef.current = isDragging; }, [isDragging]);

  const applyOffset = useCallback(() => {
    if (trackRef.current) {
      trackRef.current.style.transform = `translateX(${offsetRef.current}px)`;
    }
  }, []);

  const wrapOffset = useCallback(() => {
    const sw = setWidthRef.current;
    if (sw <= 0) return;
    // Keep offset in the range [-2*sw, 0] so middle set is always visible
    while (offsetRef.current < -2 * sw) {
      offsetRef.current += sw;
    }
    while (offsetRef.current > 0) {
      offsetRef.current -= sw;
    }
  }, []);

  // Measure set width and start animation
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    // Measure one set width (total / 3)
    setWidthRef.current = track.scrollWidth / 3;
    // Start showing the middle set
    offsetRef.current = -setWidthRef.current;
    applyOffset();

    let lastTime = 0;
    const animate = (time: number) => {
      if (!lastTime) lastTime = time;
      const delta = time - lastTime;
      lastTime = time;

      if (!hoveredRef.current && !draggingRef.current && !pausedRef.current) {
        offsetRef.current -= 0.6 * (delta / 16);
        wrapOffset();
        applyOffset();
      }
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Drag
  const dragState = useRef({ startX: 0, startOffset: 0, moved: false });

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Only drag with left mouse / primary touch
    if (e.button !== 0) return;
    setIsDragging(true);
    dragState.current = { startX: e.clientX, startOffset: offsetRef.current, moved: false };
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - dragState.current.startX;
    if (Math.abs(dx) > 3) dragState.current.moved = true;
    offsetRef.current = dragState.current.startOffset + dx;
    wrapOffset();
    applyOffset();
  }, [applyOffset, wrapOffset]);

  const onPointerUp = useCallback(() => {
    setIsDragging(false);
    if (dragState.current.moved) {
      setIsPaused(true);
      clearTimeout(pauseTimer.current);
      pauseTimer.current = setTimeout(() => setIsPaused(false), 3000);
    }
  }, []);

  return (
    <div
      className="relative w-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <PixelFade side="left" />
      <PixelFade side="right" />

      <div
        ref={containerRef}
        className="overflow-hidden select-none"
        style={{ cursor: 'inherit' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div ref={trackRef} className="flex items-center gap-1 w-max">
          {cities.map((cityId, i) => {
            const city = CITIES[cityId];
            const isActive = cityId === currentCity;

            return (
              <button
                key={`${cityId}-${i}`}
                data-city={cityId}
                onClick={() => {
                  if (!dragState.current.moved) onCityChange(cityId);
                }}
                className={`
                  relative px-3 py-1.5 font-mono text-xs uppercase tracking-wider
                  transition-all duration-200 rounded whitespace-nowrap shrink-0
                  ${isActive
                    ? 'bg-[#00d4aa20] text-[#00d4aa] border border-[#00d4aa40]'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent'
                  }
                `}
              >
                {isActive && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#00d4aa] rounded-full status-live" />
                )}
                <span className="hidden sm:inline">{city.name}</span>
                <span className="sm:hidden">{city.nameShort}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
