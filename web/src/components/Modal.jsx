export default function Modal({ title, children, onClose, footer }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="row between mb-16">
          <h3 style={{ fontSize: 18 }}>{title}</h3>
          <button className="btn-ghost btn btn-sm" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
        {footer && <div className="row gap-8 mt-24" style={{ justifyContent: 'flex-end' }}>{footer}</div>}
      </div>
    </div>
  );
}
