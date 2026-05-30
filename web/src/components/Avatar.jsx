import { IoPerson } from 'react-icons/io5';

// Mirrors mobile Avatar: image when a src exists, otherwise a neutral circle
// with a person glyph.
export default function Avatar({ name, size = 40, src }) {
  const base = {
    width: size, height: size, borderRadius: '50%',
    flexShrink: 0, border: '1px solid var(--border)',
  };
  if (src) {
    return <img src={src} alt={name || ''} style={{ ...base, objectFit: 'cover' }} />;
  }
  return (
    <div
      style={{
        ...base,
        background: 'var(--background-secondary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-secondary)',
      }}
    >
      <IoPerson size={size * 0.45} />
    </div>
  );
}
