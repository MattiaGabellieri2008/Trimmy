"use client";

import { useState } from "react";
import { Star, X, Check, MessageSquare, Sparkles } from "lucide-react";
import { ClientAppointmentItem, rateClientAppointment } from "@/lib/client-booking";

interface ReviewModalProps {
  appointment: ClientAppointmentItem;
  isOpen: boolean;
  onClose: () => void;
  userUid: string;
  onReviewSubmitted: (updated: ClientAppointmentItem[]) => void;
}

export default function ReviewModal({
  appointment,
  isOpen,
  onClose,
  userUid,
  onReviewSubmitted
}: ReviewModalProps) {
  const [rating, setRating] = useState<number>(appointment.rating || 5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState<string>(appointment.reviewComment || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const updatedList = rateClientAppointment(userUid, appointment.id, rating, comment);
      onReviewSubmitted(updatedList);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-zinc-200/80 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col text-zinc-900 animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2 py-0.5 bg-zinc-100 text-zinc-700 border border-zinc-200 rounded-full uppercase tracking-wider">
                Recensione Salone
              </span>
            </div>
            <h3 className="font-bold text-base text-zinc-900 mt-1 tracking-tight">Valuta la tua esperienza</h3>
            <p className="text-xs text-zinc-500 mt-0.5">{appointment.salonName} • {appointment.serviceName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="text-center space-y-3 bg-zinc-50/60 p-4 rounded-2xl border border-zinc-200/60">
            <span className="text-xs font-bold text-zinc-600 uppercase tracking-wider block">
              Com&apos;è andato il trattamento?
            </span>
            
            {/* 5 Stelle Interattive */}
            <div className="flex items-center justify-center gap-2 pt-1">
              {[1, 2, 3, 4, 5].map((star) => {
                const isFilled = (hoverRating || rating) >= star;
                return (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                    className="p-1 text-2xl transition-transform hover:scale-110 focus:outline-hidden cursor-pointer"
                  >
                    <Star
                      className={`w-7 h-7 transition-all ${
                        isFilled 
                          ? "fill-amber-400 text-amber-400 drop-shadow-xs" 
                          : "text-zinc-300 hover:text-zinc-400"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
            
            <p className="text-xs font-semibold text-zinc-800">
              {rating === 5 && "⭐ Eccellente! Tutto perfetto nei minimi dettagli"}
              {rating === 4 && "⭐ Molto buono, stylist professionale"}
              {rating === 3 && "⭐ Buono, nella media"}
              {rating === 2 && "⭐ Si può fare di meglio"}
              {rating === 1 && "⭐ Esperienza non all'altezza"}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 block flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-zinc-500" />
              Lascia un commento (facoltativo)
            </label>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Cosa ti è piaciuto di più? Consiglieresti questo salone o lo stylist?"
              className="w-full text-sm p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:outline-hidden focus:bg-white focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 resize-none transition-all"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:text-zinc-900 rounded-xl hover:bg-zinc-100 transition-colors cursor-pointer"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              {isSubmitting ? "Salvataggio..." : "Pubblica Recensione"}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
