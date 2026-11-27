import { useEffect, useState } from 'react'

export function AssetImage({ src, fallbackSrc, alt = '', className = '', ...props }) {
  const [failedSrc, setFailedSrc] = useState('')
  const activeSrc = !src || failedSrc === src ? fallbackSrc : src

  return (
    <img
      alt={alt}
      aria-hidden={alt === '' ? true : undefined}
      className={className}
      onError={() => {
        if (src && failedSrc !== src) {
          setFailedSrc(src)
        }
      }}
      src={activeSrc}
      {...props}
    />
  )
}

export function Icon({ name, size = 20, className = '' }) {
  return (
    <span
      aria-hidden="true"
      className={`material-symbols-outlined ${className}`}
      style={{ fontSize: size }}
    >
      {name}
    </span>
  )
}

export function Button({
  children,
  variant = 'primary',
  icon,
  className = '',
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      className={`button button-${variant} ${className}`}
      {...props}
    >
      {icon && <Icon name={icon} size={19} />}
      <span>{children}</span>
    </button>
  )
}

export function IconButton({ label, name, className = '', ...props }) {
  return (
    <button
      type="button"
      className={`icon-button ${className}`}
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon name={name} />
    </button>
  )
}

export function Card({ children, className = '', ...props }) {
  return (
    <section className={`card ${className}`} {...props}>
      {children}
    </section>
  )
}

export function Badge({ children, tone = 'neutral', dot = false }) {
  return (
    <span className={`badge badge-${tone}`}>
      {dot && <span className="badge-dot" />}
      {children}
    </span>
  )
}

export function PageHeader({ eyebrow, title, description, action }) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {action && <div className="page-header-action">{action}</div>}
    </div>
  )
}

export function StatCard({ icon, label, value, note, tone = 'lavender' }) {
  return (
    <Card className="stat-card">
      <div className={`stat-icon stat-icon-${tone}`}>
        <Icon name={icon} size={22} />
      </div>
      <div className="stat-copy">
        <p>{label}</p>
        <strong>{value}</strong>
        {note && <span>{note}</span>}
      </div>
    </Card>
  )
}

export function Modal({ open, title, description, onClose, children, size = 'medium' }) {
  useEffect(() => {
    if (!open) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        aria-labelledby="modal-title"
        aria-modal="true"
        className={`modal modal-${size}`}
        role="dialog"
      >
        <div className="modal-heading">
          <div>
            <h2 id="modal-title">{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <IconButton label="Close dialog" name="close" onClick={onClose} />
        </div>
        {children}
      </section>
    </div>
  )
}

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

export function EmptyState({ icon = 'inbox', title, description }) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><Icon name={icon} size={28} /></span>
      <strong>{title}</strong>
      {description && <span>{description}</span>}
    </div>
  )
}
