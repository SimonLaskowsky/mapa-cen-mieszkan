'use client';

import { useEffect, useRef, useState } from 'react';

interface CountUpProps {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  separator?: string;
  className?: string;
  onComplete?: () => void;
}

export default function CountUp({
  value,
  duration = 800,
  decimals = 0,
  prefix = '',
  suffix = '',
  separator = ' ',
  className = '',
  onComplete,
}: CountUpProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const previousValue = useRef(0);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const startValue = previousValue.current;
    const endValue = value;
    const startTime = performance.now();

    if (startValue === endValue) return;

    setIsAnimating(true);

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out cubic)
      const eased = 1 - Math.pow(1 - progress, 3);

      const currentValue = startValue + (endValue - startValue) * eased;
      setDisplayValue(currentValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
        previousValue.current = endValue;
        setIsAnimating(false);
        onComplete?.();
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration, onComplete]);

  const formatNumber = (num: number): string => {
    const fixed = num.toFixed(decimals);
    const [intPart, decPart] = fixed.split('.');

    // Add thousand separators
    const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, separator);

    return decPart ? `${formatted}.${decPart}` : formatted;
  };

  return (
    <span className={`count-up ${isAnimating ? 'count-up-glow' : ''} ${className}`}>
      {prefix}{formatNumber(displayValue)}{suffix}
    </span>
  );
}
