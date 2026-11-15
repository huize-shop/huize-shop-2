import React, { useState } from 'react';
import { Download, Smartphone, Share, PlusSquare, X, MoreVertical } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';

interface PWAInstallButtonProps {
  variant?: 'navbar' | 'drawer' | 'footer';
  onActionDone?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'navbar',
  onActionDone,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  // Hide automatically when running as an installed standalone app
  if (isInstalled) {
    return null;
  }

  // In navbar, show only when Chromium prompt is ready or on iOS to keep header clean
  if (variant === 'navbar' && !isInstallable && !isIOS) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
      onActionDone?.();
    } else {
      setShowGuideModal(true);
    }
  };

  const renderTrigger = () => {
    if (variant === 'navbar') {
      return (
        <button
          type="button"
          onClick={handleClick}
          aria-label="Installer l'application HUIZE SHOP"
          title="Installer l'application sur votre téléphone ou ordinateur"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-[#123B2A]/20 bg-[#F8F7F2] hover:bg-[#EFEFE6] text-[#123B2A] text-xs font-bold transition-all cursor-pointer active:scale-95 whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5 text-[#1F5A40]" />
          <span className="hidden md:inline">Installer l&apos;app</span>
        </button>
      );
    }

    if (variant === 'drawer') {
      return (
        <button
          type="button"
          onClick={handleClick}
          className="text-left px-3 py-2.5 rounded-lg font-bold text-sm bg-[#F8F7F2] text-[#123B2A] hover:bg-[#EFEFE6] border border-[#E1E3DA] flex items-center justify-between cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-[#1F5A40]" />
            <span>Installer l&apos;application HUIZE</span>
          </span>
          <Download className="w-4 h-4 text-[#1F5A40]" />
        </button>
      );
    }

    // Footer variant
    return (
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#D8F36A]/50 bg-[#1F5A40]/60 hover:bg-[#1F5A40] text-white text-xs font-bold transition-all cursor-pointer"
      >
        <Download className="w-3.5 h-3.5 text-[#D8F36A]" />
        <span>Installer l&apos;application</span>
      </button>
    );
  };

  return (
    <>
      {renderTrigger()}

      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          onClick={() => setShowGuideModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-[#E1E3DA] text-[#202720]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#123B2A] text-[#D8F36A] flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold font-title text-[#123B2A]">
                    Installer HUIZE SHOP
                  </h3>
                  <p className="text-xs text-[#6B726C]">
                    Accès rapide en 1 clic depuis votre écran d&apos;accueil
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                aria-label="Fermer"
                className="p-1.5 rounded-lg text-[#6B726C] hover:bg-[#F8F7F2] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isIOS ? (
              <div className="space-y-3 text-sm text-[#4A524C] bg-[#FAF9F5] border border-[#E1E3DA] rounded-xl p-4">
                <p className="font-bold text-[#123B2A] text-xs uppercase tracking-wider">
                  Sur iPhone &amp; iPad (Safari)
                </p>
                <ol className="space-y-2.5 text-xs sm:text-sm">
                  <li className="flex items-start gap-2.5">
                    <span className="font-bold text-[#123B2A]">1.</span>
                    <span>
                      Touchez le bouton <Share className="inline w-4 h-4 text-[#1F5A40] mx-0.5" />{' '}
                      <strong>Partager</strong> dans la barre de Safari.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="font-bold text-[#123B2A]">2.</span>
                    <span>
                      Faites défiler et sélectionnez{' '}
                      <PlusSquare className="inline w-4 h-4 text-[#1F5A40] mx-0.5" />{' '}
                      <strong>Sur l&apos;écran d&apos;accueil</strong>.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="font-bold text-[#123B2A]">3.</span>
                    <span>
                      Validez en appuyant sur <strong>Ajouter</strong> en haut à droite.
                    </span>
                  </li>
                </ol>
              </div>
            ) : (
              <div className="space-y-3 text-sm text-[#4A524C] bg-[#FAF9F5] border border-[#E1E3DA] rounded-xl p-4">
                <p className="font-bold text-[#123B2A] text-xs uppercase tracking-wider">
                  Sur Android &amp; Ordinateur (Chrome / Edge)
                </p>
                <ol className="space-y-2.5 text-xs sm:text-sm">
                  <li className="flex items-start gap-2.5">
                    <span className="font-bold text-[#123B2A]">1.</span>
                    <span>
                      Ouvrez le site directement dans votre navigateur (hors fenêtre intégrée), puis
                      touchez le menu{' '}
                      <MoreVertical className="inline w-4 h-4 text-[#1F5A40]" /> en haut à droite.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="font-bold text-[#123B2A]">2.</span>
                    <span>
                      Sélectionnez <strong>Installer l&apos;application</strong> ou{' '}
                      <strong>Ajouter à l&apos;écran d&apos;accueil</strong>.
                    </span>
                  </li>
                </ol>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="mt-5 w-full rounded-xl bg-[#123B2A] hover:bg-[#1F5A40] py-2.5 text-sm font-bold text-white transition-colors cursor-pointer"
            >
              Compris
            </button>
          </div>
        </div>
      )}
    </>
  );
};
