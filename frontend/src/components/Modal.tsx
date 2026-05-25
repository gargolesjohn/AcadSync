import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  children: ReactNode;
  onClose: () => void;
  title?: string;
  icon?: string;
  iconColor?: string;
  width?: number;
}

export function Modal({ children, onClose, title, icon, iconColor, width }: ModalProps) {
  return createPortal(
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box" style={{ maxWidth: width || 520, width: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
        {title && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {icon && <i className={`fas ${icon}`} style={{ color: iconColor || 'var(--accent)', fontSize: 18 }}></i>}
              <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>{title}</h3>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, padding: 4, lineHeight: 1 }}>
              <i className="fas fa-times"></i>
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body
  );
}
