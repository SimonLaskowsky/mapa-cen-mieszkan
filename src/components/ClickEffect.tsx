'use client';

import { useEffect } from 'react';

export default function ClickEffect() {
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const el = document.createElement('div');
      el.className = 'click-effect';
      el.style.left = `${e.clientX}px`;
      el.style.top = `${e.clientY}px`;
      el.innerHTML = `
        <div class="click-ring click-ring-1"></div>
        <div class="click-ring click-ring-2"></div>
        <div class="click-diamond"></div>
        <div class="click-bracket click-bracket-tl"></div>
        <div class="click-bracket click-bracket-tr"></div>
        <div class="click-bracket click-bracket-bl"></div>
        <div class="click-bracket click-bracket-br"></div>
        <div class="click-scanline click-scanline-h"></div>
        <div class="click-scanline click-scanline-v"></div>
      `;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 700);
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return null;
}
