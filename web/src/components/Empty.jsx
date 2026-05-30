import { IoFileTrayOutline } from 'react-icons/io5';

// icon accepts a react node (e.g. an Ionicon) or falls back to a default glyph.
export default function Empty({ icon, title = 'Nothing here yet', sub }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon || <IoFileTrayOutline size={40} />}</div>
      <div className="empty-title">{title}</div>
      {sub && <div className="muted">{sub}</div>}
    </div>
  );
}
