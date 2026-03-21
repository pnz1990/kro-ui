import './SkeletonCard.css'

export default function SkeletonCard() {
  return (
    <div className="skeleton-card" aria-hidden="true">
      <div className="skeleton-card__header">
        <div className="skeleton-card__dot" />
        <div className="skeleton-card__line skeleton-card__line--wide" />
      </div>
      <div className="skeleton-card__meta">
        <div className="skeleton-card__line skeleton-card__line--medium" />
        <div className="skeleton-card__line skeleton-card__line--short" />
      </div>
      <div className="skeleton-card__actions">
        <div className="skeleton-card__line skeleton-card__line--btn" />
        <div className="skeleton-card__line skeleton-card__line--btn" />
      </div>
    </div>
  )
}
