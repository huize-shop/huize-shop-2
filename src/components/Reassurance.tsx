import React from 'react';

export const Reassurance: React.FC = () => {
  const benefits = [
    {
      icon: '👟',
      title: 'Des informations claires',
      desc: 'Pointures, tailles, photos et état des stocks réels indiqués sans mauvaise surprise.'
    },
    {
      icon: '⚡',
      title: 'Une commande simple',
      desc: 'Prépare ton panier en ligne, puis transmets-le en un clic directement sur WhatsApp.'
    },
    {
      icon: '💬',
      title: 'Contact direct WhatsApp',
      desc: 'Échange avec le commerçant, confirme ta pointure et demande des photos supplémentaires.'
    },
    {
      icon: '💰',
      title: 'Prix transparents en F CFA',
      desc: 'Tarifs clairs en Francs CFA et confirmation des modalités de livraison avant tout paiement.'
    }
  ];

  return (
    <section className="py-14 bg-white border-t border-[#E1E3DA]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold font-title text-[#123B2A] relative inline-block">
            Pourquoi choisir HUIZE SHOP ?
            <span className="block w-14 h-1 bg-[#D8F36A] rounded-full mx-auto mt-2" />
          </h2>
          <p className="text-sm text-[#6B726C] mt-2 max-w-md mx-auto">
            La simplicité d’un e-commerce moderne alliée au contact chaleureux du commerce de proximité.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {benefits.map((b, idx) => (
            <div
              key={idx}
              className="bg-[#FAF9F5] border border-[#E1E3DA] rounded-xl p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col gap-2"
            >
              <div className="w-12 h-12 rounded-xl bg-[#D8F36A] flex items-center justify-center text-xl mb-2">
                {b.icon}
              </div>
              <h3 className="text-base font-bold text-[#123B2A] font-title">{b.title}</h3>
              <p className="text-xs sm:text-sm text-[#6B726C] leading-relaxed">{b.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
