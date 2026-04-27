import { Categories } from 'emoji-picker-react';
import React, { Suspense, useEffect, useState } from 'react';

const EmojiPicker = React.lazy(() => import('emoji-picker-react'));

type CategoryForm = { name: string; color: string; icon: string };

interface CategoryEditorProps {
  initialValues: CategoryForm;
  onSave: (values: CategoryForm) => void;
  onCancel?: () => void;
  isPending: boolean;
  submitLabel?: string;
}

export function CategoryEditor({
  initialValues,
  onSave,
  onCancel,
  isPending,
  submitLabel = 'OK',
}: Readonly<CategoryEditorProps>) {
  const [form, setForm] = useState(initialValues);
  const [showPicker, setShowPicker] = useState(false);

  // Fermeture avec Échap
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowPicker(false);
    };
    if (showPicker) globalThis.addEventListener('keydown', handleEsc);
    return () => globalThis.removeEventListener('keydown', handleEsc);
  }, [showPicker]);

  return (
    <div className="flex items-center gap-3 py-2 border-b border-black/[0.06] last:border-0 relative w-full">
      {/* COULEUR */}
      <input
        type="color"
        value={form.color}
        onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
        className="w-8 h-8 rounded cursor-pointer border border-black/10 p-0.5 shrink-0"
      />

      {/* EMOJI */}
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setShowPicker(!showPicker)}
          className="w-8 h-8 rounded bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-lg border border-black/5"
        >
          {form.icon}
        </button>

        {showPicker && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 bg-transparent border-none outline-none"
              onClick={() => setShowPicker(false)}
            />
            <div className="absolute top-full left-0 mt-2 z-50 shadow-2xl border rounded-xl overflow-hidden bg-white">
              <Suspense fallback={<div className="p-8 text-xs text-stone-400">Chargement...</div>}>
                <EmojiPicker
                  onEmojiClick={(data) => {
                    setForm((f) => ({ ...f, icon: data.emoji }));
                    setShowPicker(false);
                  }}
                  width={320}
                  height={350}
                  previewConfig={{ showPreview: false }}
                  skinTonesDisabled
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

      {/* NOM */}
      <input
        type="text"
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        className="flex-1 text-sm bg-transparent border-b border-blue-400 focus:outline-none py-1"
        placeholder="Nom de la catégorie"
        autoFocus
        onKeyDown={(e) => e.key === 'Enter' && onSave(form)}
      />

      {/* ACTIONS */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onSave(form)}
          disabled={isPending}
          className="text-xs font-bold text-green-600 hover:bg-green-50 px-2 py-1 rounded"
        >
          {isPending ? '...' : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-stone-400 hover:bg-stone-50 px-2 py-1 rounded"
          >
            Annuler
          </button>
        )}
      </div>
    </div>
  );
}
