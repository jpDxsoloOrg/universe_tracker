import { useEffect, useRef, useState } from 'react';
import './Odometer.css';

interface OdometerProps {
  value: number;
  duration?: number;
  className?: string;
}

interface DigitEntry {
  type: 'digit';
  value: number;
  key: string;
}

interface SeparatorEntry {
  type: 'separator';
  char: string;
  key: string;
}

type OdometerEntry = DigitEntry | SeparatorEntry;

function splitIntoEntries(num: number): OdometerEntry[] {
  const str = Math.abs(Math.round(num)).toString();
  const entries: OdometerEntry[] = [];
  const len = str.length;

  for (let i = 0; i < len; i++) {
    // Add comma separator for thousands (e.g. position 3, 6, 9 from the right)
    const posFromRight = len - i;
    if (posFromRight !== len && posFromRight % 3 === 0) {
      entries.push({ type: 'separator', char: ',', key: `sep-${i}` });
    }
    entries.push({ type: 'digit', value: parseInt(str.charAt(i), 10), key: `d-${i}` });
  }

  return entries;
}

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export default function Odometer({ value, duration = 800, className }: OdometerProps) {
  const prevValueRef = useRef<number>(value);
  const [displayValue, setDisplayValue] = useState(value);
  const [animated, setAnimated] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Trigger animation on mount via IntersectionObserver, then on every value change
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setAnimated(true);
          setDisplayValue(value);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []); // only run once on mount

  // Update display value when the prop changes after initial animation
  useEffect(() => {
    if (animated) {
      setDisplayValue(value);
    }
    prevValueRef.current = value;
  }, [value, animated]);

  const entries = splitIntoEntries(animated ? displayValue : 0);
  const digitCount = entries.filter((e) => e.type === 'digit').length;

  // Calculate delay per digit: rightmost animates first
  let digitIndex = 0;

  return (
    <span ref={containerRef} className={`odometer${className ? ` ${className}` : ''}`}>
      {entries.map((entry) => {
        if (entry.type === 'separator') {
          return (
            <span key={entry.key} className="odometer-separator">
              {entry.char}
            </span>
          );
        }

        const currentDigitIndex = digitIndex;
        digitIndex++;

        // Stagger: rightmost digit has 0 delay, leftmost has the most
        const staggerDelay = (digitCount - 1 - currentDigitIndex) * 50;
        const translateY = animated ? -(entry.value * 100) / 10 : 0;

        return (
          <span key={entry.key} className="odometer-digit">
            <span
              className="odometer-digit-column"
              style={{
                transform: `translateY(${translateY}%)`,
                transitionDuration: `${duration}ms`,
                transitionDelay: `${staggerDelay}ms`,
              }}
            >
              {DIGITS.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}
