import React, { useState } from 'react';
import { MessageCircle, MapPin, Clock, Phone, Send } from 'lucide-react';
import { WHATSAPP_DISPLAY, getContactWhatsAppUrl, getDirectWhatsAppUrl } from '../utils/whatsapp.ts';

export const ContactView: React.FC = () => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState("Question sur une basket / sandale");
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const url = getContactWhatsAppUrl(name, phone, subject, message);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="py-8 sm:py-12 px-4 sm:px-6 max-w-6xl mx-auto">
      <div className="text-center max-w-2xl mx-auto mb-8">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold font-title text-[#123B2A] relative inline-block">
          Contacte HUIZE SHOP
          <span className="block w-14 h-1 bg-[#D8F36A] rounded-full mx-auto mt-2" />
        </h1>
        <p className="text-sm sm:text-base text-[#6B726C] mt-3">
          Une question sur un article, une taille, une pointure ou la livraison à Ouagadougou ? Le plus simple
          est de nous écrire directement sur WhatsApp. Remplis le formulaire pour préparer ton message !
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Left Column: Direct Info Cards */}
        <div className="md:col-span-5 flex flex-col gap-4">
          {/* Card WhatsApp */}
          <div className="bg-white border-t-4 border-[#1F5A40] border-[#E1E3DA] border-x border-b rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-[#E8F7EE] flex items-center justify-center text-[#25D366]">
                <MessageCircle className="w-6 h-6 fill-current" />
              </div>
              <div>
                <h2 className="text-base font-bold font-title text-[#123B2A]">WhatsApp Direct</h2>
                <p className="text-xs text-[#6B726C]">Numéro officiel HUIZE</p>
              </div>
            </div>

            <p className="text-sm font-semibold text-[#123B2A] mb-4 flex items-center gap-2">
              <Phone className="w-4 h-4 text-[#1F5A40]" />
              <span className="font-title text-base font-bold text-[#1F5A40]">{WHATSAPP_DISPLAY}</span>
            </p>

            <a
              href={getDirectWhatsAppUrl('Bonjour HUIZE SHOP, j’aimerais poser une question sur votre catalogue.')}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-full bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold text-xs sm:text-sm shadow-md transition-all active:scale-98"
            >
              <MessageCircle className="w-4 h-4 fill-white" />
              <span>💬 Écrire directement sur WhatsApp</span>
            </a>
          </div>

          {/* Card Location */}
          <div className="bg-white border-t-4 border-[#123B2A] border-[#E1E3DA] border-x border-b rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 text-[#123B2A] font-bold text-sm mb-2">
              <MapPin className="w-4 h-4 text-[#1F5A40]" />
              <span>Boutique &amp; Localisation</span>
            </div>
            <p className="text-xs sm:text-sm text-[#4A5568] leading-relaxed">
              Boutique située à <strong>Ouagadougou, Burkina Faso</strong>. Livraison à domicile et sur lieu de travail
              dans tous les quartiers de Ouaga (Karpala, Ouaga 2000, 1200 Logements, Gounghin, Kalgondin, etc.) et
              expéditions rapides vers Bobo-Dioulasso, Koudougou et toutes les provinces.
            </p>
          </div>

          {/* Card Hours */}
          <div className="bg-white border-t-4 border-[#D8F36A] border-[#E1E3DA] border-x border-b rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 text-[#123B2A] font-bold text-sm mb-2">
              <Clock className="w-4 h-4 text-[#1F5A40]" />
              <span>Horaires de réponse</span>
            </div>
            <div className="text-xs sm:text-sm text-[#4A5568] space-y-1">
              <p>• <strong>Du Lundi au Samedi :</strong> 08h00 – 21h00</p>
              <p>• <strong>Dimanche :</strong> 10h00 – 18h00</p>
              <p className="text-[11px] text-[#1F5A40] font-semibold mt-2">
                ⚡ Assistance rapide 7j/7 pour toutes vos commandes
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Pre-fill WhatsApp message Form */}
        <div className="md:col-span-7 bg-white border border-[#E1E3DA] rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="mb-5">
            <h2 className="text-xl font-bold font-title text-[#123B2A]">
              Prépare ton message WhatsApp
            </h2>
            <p className="text-xs text-[#6B726C] mt-1">
              Ce formulaire formate ton message pour l’ouvrir instantanément dans WhatsApp avec notre numéro.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-xs sm:text-sm">
            <div>
              <label htmlFor="contact-name" className="block font-semibold text-[#123B2A] mb-1">
                Ton nom complet *
              </label>
              <input
                id="contact-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex. : Ibrahim Ouédraogo"
                className="w-full p-3 rounded-lg border border-[#E1E3DA] focus:border-[#1F5A40] focus:ring-1 focus:ring-[#1F5A40] text-sm"
              />
            </div>

            <div>
              <label htmlFor="contact-phone" className="block font-semibold text-[#123B2A] mb-1">
                Numéro WhatsApp de contact *
              </label>
              <input
                id="contact-phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+226 70 XX XX XX"
                className="w-full p-3 rounded-lg border border-[#E1E3DA] focus:border-[#1F5A40] focus:ring-1 focus:ring-[#1F5A40] text-sm"
              />
            </div>

            <div>
              <label htmlFor="contact-subject" className="block font-semibold text-[#123B2A] mb-1">
                Sujet de ta demande
              </label>
              <select
                id="contact-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full p-3 rounded-lg border border-[#E1E3DA] focus:border-[#1F5A40] bg-white text-sm"
              >
                <option value="Question sur une basket / sandale">Question sur une basket / sandale</option>
                <option value="Disponibilité d'une pointure">Disponibilité d'une pointure</option>
                <option value="Frais et délais de livraison">Frais et délais de livraison à Ouaga ou Province</option>
                <option value="Modes de paiement (Orange Money / Moov Money)">
                  Modes de paiement (Orange Money / Moov Money)
                </option>
                <option value="Précommande ou demande spéciale">Précommande ou demande spéciale</option>
                <option value="Autre demande">Autre demande</option>
              </select>
            </div>

            <div>
              <label htmlFor="contact-msg" className="block font-semibold text-[#123B2A] mb-1">
                Ton message ou question
              </label>
              <textarea
                id="contact-msg"
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Détaille ta question ici (modèle, pointure, quartier de livraison)..."
                className="w-full p-3 rounded-lg border border-[#E1E3DA] focus:border-[#1F5A40] focus:ring-1 focus:ring-[#1F5A40] text-sm resize-y"
              />
            </div>

            <button
              type="submit"
              className="mt-2 w-full inline-flex items-center justify-center gap-2 py-3.5 px-6 rounded-full bg-[#123B2A] hover:bg-[#1F5A40] text-white font-bold text-sm shadow-md transition-all active:scale-98 cursor-pointer"
            >
              <Send className="w-4 h-4 text-[#D8F36A]" />
              <span>Envoyer sur WhatsApp ({WHATSAPP_DISPLAY})</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
