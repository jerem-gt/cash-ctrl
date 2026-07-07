import type { ScheduledTransaction } from '@cashctrl/types';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Surlignage temporaire d'une planification atteinte depuis la palette de commande
 * (`navigate('/scheduled', { state: { highlightScheduledId } })`).
 */
export function useScheduledHighlight(
  scheduled: ScheduledTransaction[],
  onTarget: (target: ScheduledTransaction) => void,
) {
  const location = useLocation();
  const navigate = useNavigate();
  // Capturé une seule fois au montage (initialiseur paresseux) : l'effet ci-dessous
  // nettoie location.state juste après, avant même l'arrivée des données `scheduled`.
  const [pendingId] = useState(
    () =>
      (location.state as { highlightScheduledId?: number } | null)?.highlightScheduledId ??
      undefined,
  );
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const rowNodesRef = useRef(new Map<number, HTMLDivElement | null>());

  // Nettoie le state de navigation tout de suite pour ne pas re-déclencher le flash
  // si l'utilisateur revient sur cette page (retour arrière / rechargement).
  useEffect(() => {
    if (pendingId === undefined) return;
    void navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line @eslint-react/exhaustive-deps -- volontaire : à ne lancer qu'au montage
  }, []);

  // Résout la cible dès que les données sont là (pattern "adjusting state during render").
  const [resolvedFor, setResolvedFor] = useState<number | undefined>(undefined);
  if (pendingId !== undefined && resolvedFor !== pendingId && scheduled.length > 0) {
    setResolvedFor(pendingId);
    const target = scheduled.find((s) => s.id === pendingId);
    if (target) {
      setHighlightedId(target.id);
      onTarget(target);
    }
  }

  // Scroll + extinction du flash : effets de bord légitimes (DOM externe, timer).
  useEffect(() => {
    if (highlightedId == null) return;
    const id = highlightedId;
    const frame = requestAnimationFrame(() => {
      rowNodesRef.current.get(id)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    const timer = setTimeout(() => setHighlightedId(null), 2000);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [highlightedId]);

  const registerRowNode = (id: number, el: HTMLDivElement | null) => {
    rowNodesRef.current.set(id, el);
  };

  return { highlightedId, hasPendingTarget: pendingId !== undefined, registerRowNode };
}
