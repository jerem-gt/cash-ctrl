import { Categories } from 'emoji-picker-react';
import React, { Suspense, useEffect, useState } from 'react';

const EmojiPicker = React.lazy(() => import('emoji-picker-react'));

export type CategoryForm = { name: string; color: string; icon: string };

interface CategoryEditorProps {
  initialValues: CategoryForm;
  onSave: (values: CategoryForm) => void;
  onCancel?: () => void;
  isPending: boolean;
  submitLabel?: string;
  placeholder?: string;
}

export function CategoryEditor({
  initialValues,
  onSave,
  onCancel,
  isPending,
  submitLabel = 'Ajouter',
  placeholder = 'Nom...',
}: Readonly<CategoryEditorProps>) {
  const [form, setForm] = useState(initialValues);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showPicker) setShowPicker(false);
        else onCancel?.();
      }
    };
    globalThis.addEventListener('keydown', handleEsc);
    return () => globalThis.removeEventListener('keydown', handleEsc);
  }, [showPicker, onCancel]);

  return (
    <div className="flex items-center gap-2 w-full animate-in fade-in zoom-in-95 duration-200">
      {/* SÉLECTEUR EMOJI & COULEUR COMBINÉ */}
      <div className="relative flex items-center shrink-0 gap-1 bg-stone-100/50 p-1 rounded-lg border border-black/3">
        <button
          type="button"
          onClick={() => setShowPicker(!showPicker)}
          className="w-7 h-7 flex items-center justify-center text-base hover:bg-white rounded-md transition-all shadow-sm"
          style={{ borderLeft: `3px solid ${form.color}` }} // Rappel de la couleur sur le bord de l'icône
        >
          {form.icon}
        </button>

        {/* Input couleur discret (petit carré à la fin) */}
        <input
          type="color"
          value={form.color}
          onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
          className="w-4 h-4 rounded-full cursor-pointer border-none p-0 overflow-hidden"
          title="Changer la couleur"
        />

        {showPicker && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 bg-transparent"
              onClick={() => setShowPicker(false)}
            />
            <div className="absolute top-full left-0 mt-2 z-50 shadow-2xl border border-black/5 rounded-2xl overflow-hidden animate-in slide-in-from-top-2">
              <Suspense
                fallback={<div className="p-8 text-xs text-stone-400 bg-white">Chargement...</div>}
              >
                <EmojiPicker
                  onEmojiClick={(data) => {
                    setForm((f) => ({ ...f, icon: data.emoji }));
                    setShowPicker(false);
                  }}
                  width={300}
                  height={350}
                  previewConfig={{ showPreview: false }}
                  skinTonesDisabled
                  searchPlaceholder="Rechercher..."
                  categories={[
                    { category: Categories.SYMBOLS, name: 'Symboles' },
                    { category: Categories.OBJECTS, name: 'Objets' },
                    { category: Categories.TRAVEL_PLACES, name: 'Lieux' },
                    { category: Categories.FOOD_DRINK, name: 'Alimentation' },
                    { category: Categories.ACTIVITIES, name: 'Loisirs' },
                  ]}
                />
              </Suspense>
            </div>
          </>
        )}
      </div>

      {/* NOM : Input sans bordure inférieure bleue (plus sobre) */}
      <input
        aria-label="Nom de la nouvelle catégorie"
        type="text"
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        className="flex-1 min-w-0 text-sm bg-transparent border-b border-black/10 focus:border-black outline-none py-1.5 transition-colors placeholder:text-stone-300 font-medium"
        placeholder={placeholder}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave(form);
        }}
      />

      {/* ACTIONS COMPACTES */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => onSave(form)}
          disabled={isPending || !form.name.trim()}
          className="text-[11px] font-black text-green-600 hover:bg-green-50 px-3 py-1.5 rounded-lg uppercase tracking-wider transition-all disabled:opacity-30"
        >
          {isPending ? '...' : submitLabel}
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            hidden={isPending}
            className="text-[11px] font-black text-stone-300 hover:bg-stone-100 px-3 py-1.5 rounded-lg uppercase tracking-wider transition-all disabled:opacity-30"
          >
            Annuler
          </button>
        )}
      </div>
    </div>
  );
}
