import type { ScheduledTransaction } from '@cashctrl/types';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { fireAndForget } from '@/lib/async';

/**
 * Surlignage temporaire d'une planification atteinte depuis la palette de commande
 * (`navigate('/scheduled', { state: { highlightScheduledId } })`).
 */
export function useScheduledHighlight(
  scheduled: ScheduledTransaction[],
  isFetchedAfterMount: boolean,
  onTarget: (target: ScheduledTransaction) => void,
) {
  const location = useLocation();
  const navigate = useNavigate();
  const [pendingId, setPendingId] = useState<number | undefined>(undefined);
  const [resolvedFor, setResolvedFor] = useState<number | undefined>(undefined);
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const rowNodesRef = useRef(new Map<number, HTMLDivElement | null>());

  // Ré-arme à chaque navigation (location.key) portant une cible, même si on est déjà sur /scheduled.
  const [armedKey, setArmedKey] = useState<string | undefined>(undefined);
  if (armedKey !== location.key) {
    const id = (location.state as { highlightScheduledId?: number } | null)?.highlightScheduledId;
    if (id !== undefined) {
      setArmedKey(location.key);
      setPendingId(id);
      setResolvedFor(undefined);
      setHighlightedId(null);
    }
  }

  // Nettoie le state après armement (pas de flash au retour arrière ; le replace change location.key mais state null ⇒ pas de ré-armement).
  useEffect(() => {
    if (armedKey === undefined) return;
    fireAndForget(navigate(location.pathname, { replace: true, state: null }));
    // eslint-disable-next-line @eslint-react/exhaustive-deps -- volontaire : uniquement à chaque armement
  }, [armedKey]);

  // Résout la cible dès les données, et rejoue tant qu'elle reste introuvable (cache persisté périmé rafraîchi ensuite).
  if (pendingId !== undefined && resolvedFor !== pendingId) {
    const target = scheduled.find((s) => s.id === pendingId);
    if (target !== undefined) {
      setResolvedFor(pendingId);
      setHighlightedId(target.id);
      onTarget(target);
    } else if (isFetchedAfterMount) {
      setPendingId(undefined);
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
