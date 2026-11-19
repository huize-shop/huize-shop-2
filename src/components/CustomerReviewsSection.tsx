import React, { useEffect, useMemo, useState } from 'react';
import { Star, Send, CheckCircle2, MessageSquareQuote, MapPin } from 'lucide-react';
import { CustomerReview } from '../types.ts';
import { fetchCustomerReviews, submitCustomerReview } from '../firebase.ts';

interface CustomerReviewsSectionProps {
  onReviewSubmitted?: (review: CustomerReview) => void;
}

const RATING_LABELS: Record<number, string> = {
  1: 'Décevant',
  2: 'Moyen',
  3: 'Satisfait',
  4: 'Très bien',
  5: 'Excellent'
};

function getAuthorInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'CL';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function formatReviewDate(iso: string): string {
  if (!iso) return 'Récemment';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Récemment';
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(d);
  } catch {
    return 'Récemment';
  }
}

export const CustomerReviewsSection: React.FC<CustomerReviewsSectionProps> = ({
  onReviewSubmitted
}) => {
  const [reviews, setReviews] = useState<CustomerReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [starFilter, setStarFilter] = useState<'all' | '5' | '4' | '3minus'>('all');
  const [showAll, setShowAll] = useState(false);

  // Review submission form state
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [authorName, setAuthorName] = useState('');
  const [city, setCity] = useState('');
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchCustomerReviews(false)
      .then((list) => {
        if (!cancelled) {
          setReviews(list);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const averageRating = useMemo(() => {
    if (reviews.length === 0) return 0;
    const sum = reviews.reduce((acc, item) => acc + Number(item.rating || 0), 0);
    return Math.round((sum / reviews.length) * 10) / 10;
  }, [reviews]);

  const filteredReviews = useMemo(() => {
    if (starFilter === '5') return reviews.filter((r) => r.rating === 5);
    if (starFilter === '4') return reviews.filter((r) => r.rating === 4);
    if (starFilter === '3minus') return reviews.filter((r) => r.rating <= 3);
    return reviews;
  }, [reviews, starFilter]);

  const visibleReviews = showAll ? filteredReviews : filteredReviews.slice(0, 4);
  const displayedRating = hoverRating || rating;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(false);

    const cleanName = authorName.trim();
    const cleanCity = city.trim();
    const cleanComment = comment.trim();

    if (cleanName.length < 2) {
      setFormError('Veuillez entrer votre nom ou prénom (au moins 2 caractères).');
      return;
    }
    if (cleanComment.length < 5) {
      setFormError('Veuillez écrire un message d’au moins 5 caractères.');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await submitCustomerReview({
        authorName: cleanName,
        city: cleanCity || undefined,
        rating,
        comment: cleanComment
      });
      setReviews((prev) => [created, ...prev.filter((r) => r.id !== created.id)]);
      setAuthorName('');
      setCity('');
      setComment('');
      setRating(5);
      setStarFilter('all');
      setFormSuccess(true);
      onReviewSubmitted?.(created);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Impossible d’enregistrer votre avis pour le moment.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section
      id="avis-clients"
      className="py-14 bg-[#F8F7F2] border-t border-[#E1E3DA]"
      aria-labelledby="avis-clients-heading"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section Header + Aggregate Score */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h2
              id="avis-clients-heading"
              className="text-2xl sm:text-3xl font-bold font-title text-[#123B2A] relative inline-block"
            >
              Avis Clients
              <span className="block w-14 h-1 bg-[#D8F36A] rounded-full mt-2" />
            </h2>
            <p className="text-xs sm:text-sm text-[#6B726C] mt-2 max-w-xl">
              Retours authentiques de nos clients à Ouagadougou et partout au Burkina Faso. Partagez votre expérience après votre commande.
            </p>
          </div>

          {reviews.length > 0 && (
            <div className="flex items-center gap-3 bg-white border border-[#E1E3DA] rounded-xl px-4 py-2.5 shadow-xs self-start md:self-auto">
              <div className="flex items-center gap-1" aria-label={`Note moyenne ${averageRating} sur 5`}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-4 h-4 ${
                      star <= Math.round(averageRating)
                        ? 'text-amber-500 fill-amber-400'
                        : 'text-[#D6D8CE]'
                    }`}
                  />
                ))}
              </div>
              <div className="text-xs text-[#202720] tabular-nums">
                <strong className="text-sm font-extrabold text-[#123B2A]">
                  {averageRating.toFixed(1).replace('.', ',')} / 5
                </strong>
                <span className="text-[#6B726C] ml-1.5">
                  · {reviews.length} avis client{reviews.length > 1 ? 's' : ''}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 2-Column Split: Form Left (5 cols) + Dynamic Reviews Feed Right (7 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Left Column: Submit Review Form */}
          <div className="lg:col-span-5 bg-white border border-[#E1E3DA] rounded-2xl p-5 sm:p-6 shadow-xs">
            <h3 className="text-lg font-bold font-title text-[#123B2A] mb-1">
              Laisser un avis
            </h3>
            <p className="text-xs text-[#6B726C] mb-4">
              Votre retour aide les prochains clients à commander en toute confiance.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Interactive Star Picker */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-[#123B2A]">
                    Votre note
                  </label>
                  <span className="text-xs font-semibold text-[#1F5A40] tabular-nums">
                    {displayedRating}/5 · {RATING_LABELS[displayedRating]}
                  </span>
                </div>
                <div
                  className="flex items-center gap-1.5 bg-[#FAF9F5] border border-[#E1E3DA] rounded-xl p-2"
                  onMouseLeave={() => setHoverRating(0)}
                >
                  {[1, 2, 3, 4, 5].map((starValue) => {
                    const active = starValue <= displayedRating;
                    return (
                      <button
                        key={starValue}
                        type="button"
                        onClick={() => setRating(starValue)}
                        onMouseEnter={() => setHoverRating(starValue)}
                        aria-label={`Attribuer ${starValue} étoile${starValue > 1 ? 's' : ''}`}
                        className="flex-1 min-h-[40px] flex items-center justify-center rounded-lg hover:bg-white transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#123B2A]"
                      >
                        <Star
                          className={`w-6 h-6 transition-transform duration-150 ${
                            active
                              ? 'text-amber-500 fill-amber-400 scale-105'
                              : 'text-[#C8CBC0]'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Author Name */}
              <div>
                <label
                  htmlFor="review-author-name"
                  className="block text-xs font-bold text-[#123B2A] mb-1"
                >
                  Votre nom ou prénom *
                </label>
                <input
                  id="review-author-name"
                  type="text"
                  required
                  minLength={2}
                  maxLength={80}
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="Ex : Awa Ouédraogo"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E1E3DA] bg-[#FAF9F5] text-sm text-[#202720] placeholder:text-[#9CA39D] focus:outline-none focus:border-[#1F5A40] focus:bg-white transition-colors"
                />
              </div>

              {/* Optional City / Neighborhood */}
              <div>
                <label
                  htmlFor="review-city"
                  className="block text-xs font-bold text-[#123B2A] mb-1"
                >
                  Quartier ou ville (optionnel)
                </label>
                <input
                  id="review-city"
                  type="text"
                  maxLength={80}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ex : Ouagadougou · Patte d’Oie"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E1E3DA] bg-[#FAF9F5] text-sm text-[#202720] placeholder:text-[#9CA39D] focus:outline-none focus:border-[#1F5A40] focus:bg-white transition-colors"
                />
              </div>

              {/* Comment */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="review-comment"
                    className="text-xs font-bold text-[#123B2A]"
                  >
                    Votre message *
                  </label>
                  <span className="text-[11px] text-[#6B726C] tabular-nums">
                    {comment.length}/600
                  </span>
                </div>
                <textarea
                  id="review-comment"
                  rows={3}
                  required
                  minLength={5}
                  maxLength={600}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Qualité de l'article, rapidité du livreur, paiement après vérification..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E1E3DA] bg-[#FAF9F5] text-sm text-[#202720] placeholder:text-[#9CA39D] focus:outline-none focus:border-[#1F5A40] focus:bg-white transition-colors resize-none"
                />
              </div>

              {formError && (
                <div
                  role="alert"
                  className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5 font-medium"
                >
                  {formError}
                </div>
              )}

              {formSuccess && (
                <div
                  role="status"
                  className="text-xs text-[#123B2A] bg-[#D8F36A]/35 border border-[#1F5A40]/25 rounded-xl px-3.5 py-2.5 font-semibold flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#1F5A40] shrink-0" />
                  <span>Merci ! Votre avis a bien été publié sur la boutique.</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#123B2A] hover:bg-[#1F5A40] text-[#D8F36A] font-bold text-sm transition-all shadow-xs active:scale-[0.99] disabled:opacity-60 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? 'Publication en cours...' : 'Publier mon avis'}</span>
              </button>
            </form>
          </div>

          {/* Right Column: Dynamic Customer Reviews Grid */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            {/* Filter Controls when reviews exist */}
            {reviews.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 p-1 bg-white border border-[#E1E3DA] rounded-xl overflow-x-auto">
                  {[
                    { id: 'all', label: `Tous (${reviews.length})` },
                    { id: '5', label: `5 étoiles (${reviews.filter((r) => r.rating === 5).length})` },
                    { id: '4', label: `4 étoiles (${reviews.filter((r) => r.rating === 4).length})` },
                    { id: '3minus', label: `3★ et - (${reviews.filter((r) => r.rating <= 3).length})` }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setStarFilter(tab.id as typeof starFilter);
                        setShowAll(false);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                        starFilter === tab.id
                          ? 'bg-[#123B2A] text-white'
                          : 'text-[#6B726C] hover:text-[#123B2A] hover:bg-[#FAF9F5]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Loading State */}
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className="bg-white border border-[#E1E3DA] rounded-2xl p-5 h-44 animate-pulse"
                  />
                ))}
              </div>
            ) : filteredReviews.length === 0 ? (
              <div className="bg-white border border-[#E1E3DA] rounded-2xl p-8 text-center shadow-xs">
                <div className="w-12 h-12 rounded-2xl bg-[#FAF9F5] border border-[#E1E3DA] text-[#1F5A40] flex items-center justify-center mx-auto mb-3">
                  <MessageSquareQuote className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold font-title text-[#123B2A]">
                  {reviews.length === 0
                    ? 'Aucun avis publié pour le moment'
                    : 'Aucun avis dans cette note'}
                </h3>
                <p className="text-xs sm:text-sm text-[#6B726C] mt-1 max-w-md mx-auto">
                  {reviews.length === 0
                    ? 'Vous avez déjà commandé chez HUIZE SHOP ? Laissez le premier avis via le formulaire ci-contre !'
                    : 'Sélectionnez « Tous » pour afficher l’ensemble des avis clients publiés.'}
                </p>
                {reviews.length > 0 && starFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setStarFilter('all')}
                    className="mt-4 px-4 py-2 rounded-lg bg-[#123B2A] text-white text-xs font-bold cursor-pointer"
                  >
                    Afficher tous les avis
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {visibleReviews.map((review) => (
                    <article
                      key={review.id}
                      className="bg-white border border-[#E1E3DA] rounded-2xl p-5 shadow-xs flex flex-col justify-between gap-4 hover:border-[#1F5A40]/40 transition-colors"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div
                            className="flex items-center gap-0.5"
                            aria-label={`Note ${review.rating} sur 5`}
                          >
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`w-4 h-4 ${
                                  star <= review.rating
                                    ? 'text-amber-500 fill-amber-400'
                                    : 'text-[#D6D8CE]'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-xs font-bold text-[#123B2A] tabular-nums">
                            {review.rating}/5
                          </span>
                        </div>

                        <p className="text-sm text-[#202720] leading-relaxed break-words">
                          « {review.comment} »
                        </p>
                      </div>

                      <div className="pt-3 border-t border-[#EFEFE6] flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-[#123B2A] text-[#D8F36A] text-xs font-extrabold flex items-center justify-center shrink-0">
                          {getAuthorInitials(review.authorName)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#123B2A] truncate">
                            {review.authorName}
                          </p>
                          <p className="text-[11px] text-[#6B726C] truncate flex items-center gap-1">
                            {review.city && (
                              <>
                                <MapPin className="w-3 h-3 shrink-0 text-[#1F5A40]" />
                                <span className="truncate">{review.city}</span>
                                <span aria-hidden="true">·</span>
                              </>
                            )}
                            <span>{formatReviewDate(review.createdAt)}</span>
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                {filteredReviews.length > 4 && (
                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAll((prev) => !prev)}
                      className="px-5 py-2.5 rounded-full border border-[#123B2A] text-[#123B2A] hover:bg-[#123B2A] hover:text-white text-xs font-bold transition-colors cursor-pointer"
                    >
                      {showAll
                        ? 'Réduire les avis'
                        : `Voir tous les avis (${filteredReviews.length})`}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
