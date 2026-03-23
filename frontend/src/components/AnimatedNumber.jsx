import { useEffect, useRef, useState } from 'react';

export default function AnimatedNumber({ value, format, className, style }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  const raf = useRef(null);

  useEffect(() => {
    const from = prev.current;
    const to = value;
    if (from === to) return;

    const duration = 350;
    const start = performance.now();

    function tick(now) {
      const t = Math.min((now - start) / duration, 1);
      // ease out cubic
      const ease = 1 - Math.pow(1 - t, 3);
      const current = from + (to - from) * ease;
      setDisplay(current);
      if (t < 1) {
        raf.current = requestAnimationFrame(tick);
      } else {
        setDisplay(to);
        prev.current = to;
      }
    }

    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value]);

  const formatted = format ? format(display) : display;

  return <span className={className} style={style}>{formatted}</span>;
}
