import React, { useState } from 'react';
import { Mail, ShieldCheck, X } from 'lucide-react';

interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AUTHORIZED_ADMIN_EMAIL = 'hugosazizegansonre@gmail.com';

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    
    // Strict verification: only the owner's authorized email is the key of access
    if (cleanEmail === AUTHORIZED_ADMIN_EMAIL.toLowerCase()) {
      setError(false);
      setEmail('');
      onSuccess();
    } else {
      setError(true);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#123B2A]/70 backdrop-blur-xs animate-fade-in"
    >
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-[#E1E3DA] relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-[#6B726C] hover:bg-[#FAF9F5] transition-colors"
          title="Fermer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-12 h-12 rounded-full bg-[#123B2A]/10 text-[#123B2A] flex items-center justify-center mx-auto mb-3">
          <Mail className="w-6 h-6 text-[#123B2A]" />
        </div>

        <h3 className="text-lg font-bold font-title text-[#123B2A] text-center mb-1">
          Accès Réservé Administrateur
        </h3>
        <p className="text-xs text-[#6B726C] text-center mb-5">
          Entrez votre adresse e-mail autorisée pour accéder au tableau de bord HUIZE SHOP.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="relative">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(false);
              }}
              placeholder="Adresse e-mail..."
              autoFocus
              className={`w-full px-3.5 py-2.5 text-xs sm:text-sm border rounded-xl focus:outline-none transition-colors ${
                error
                  ? 'border-red-500 bg-red-50/50 focus:border-red-600'
                  : 'border-[#E1E3DA] focus:border-[#123B2A] bg-[#FAF9F5]'
              }`}
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 font-medium">
              Adresse e-mail non autorisée. Accès refusé.
            </p>
          )}

          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-[#E1E3DA] text-xs font-semibold text-[#6B726C] hover:bg-[#FAF9F5] transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-[#123B2A] hover:bg-[#1F5A40] text-white text-xs font-bold transition-all shadow-md active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-[#D8F36A]" />
              <span>Valider</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
