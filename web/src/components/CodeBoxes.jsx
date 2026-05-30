import { useRef, useEffect } from 'react';

// Auto-advancing digit boxes used for PIN + OTP entry across the auth flow.
// Mirrors the mobile screens: 60x60 boxes, gap 20, auto-focus next, backspace
// moves to previous. Controlled via `digits` (array) + `setDigits`.
export default function CodeBoxes({ digits, setDigits, error, autoFocus, secure }) {
  const refs = useRef([]);
  const len = digits.length;

  useEffect(() => {
    if (autoFocus) setTimeout(() => refs.current[0]?.focus(), 150);
  }, [autoFocus]);

  const onChange = (i, value) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...digits];
    next[i] = value.slice(-1);
    setDigits(next);
    if (value && i < len - 1) refs.current[i + 1]?.focus();
  };

  const onKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      const next = [...digits];
      next[i - 1] = '';
      setDigits(next);
      refs.current[i - 1]?.focus();
    }
  };

  return (
    <div className="code-row">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          className={`code-box ${d ? 'filled' : ''} ${error ? 'err' : ''}`}
          value={d}
          onChange={(e) => onChange(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          inputMode="numeric"
          maxLength={1}
          type={secure ? 'password' : 'text'}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}
