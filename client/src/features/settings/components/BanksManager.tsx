import {
  closestCenter,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useQueryClient } from '@tanstack/react-query';
import { GripVertical } from 'lucide-react';
import { type ChangeEvent, type SubmitEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { showToast } from '@/components/ui';
import { SettingsCard } from '@/features/settings/components/SettingsCard.tsx';
import { SettingsManagerSkeleton } from '@/features/settings/components/SettingsManager.tsx';
import { useDeleteConfirmation } from '@/features/settings/hooks/useDeleteConfirmation.tsx';
import {
  useBanks,
  useCreateBank,
  useDeleteBank,
  useReorderBanks,
  useUpdateBank,
  useUploadBankLogo,
} from '@/hooks/useBanks.ts';
import { Bank } from '@/types.ts';

function BankEditForm({ bank, onClose }: Readonly<{ bank: Bank; onClose: () => void }>) {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const updateBank = useUpdateBank();
  const uploadLogo = useUploadBankLogo();
  const [name, setName] = useState(bank.name);
  const [domain, setDomain] = useState(bank.domain ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return f ? URL.createObjectURL(f) : null;
    });
    setFile(f);
  };

  const logoSrc = preview ?? bank.logo ?? null;

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      if (file) await uploadLogo.mutateAsync({ id: bank.id, file });
      await updateBank.mutateAsync({
        id: bank.id,
        name: name.trim(),
        domain: domain.trim() || null,
      });
      onClose();
      setFile(null);
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      showToast(t('banks.success_edit'));
    } catch (err) {
      showToast((err as Error).message);
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-3">
      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
        {t('banks.edit_title')}
      </p>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="text-sm bg-transparent border-b border-black/10 focus:border-black outline-none py-1.5 transition-colors placeholder:text-stone-300 font-medium w-full"
        placeholder="Nom"
        autoFocus
      />
      <input
        type="text"
        value={domain}
        onChange={(e) => setDomain(e.target.value)}
        className="text-sm bg-transparent border-b border-black/10 focus:border-black outline-none py-1.5 transition-colors placeholder:text-stone-300 font-medium w-full"
        placeholder={t('banks.domain_edit_placeholder')}
      />
      <div className="flex items-center gap-2">
        {logoSrc && (
          <img
            src={logoSrc}
            alt=""
            className="w-6 h-6 object-contain rounded shrink-0"
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
        )}
        <label className="cursor-pointer">
          <span className="text-xs text-stone-400">
            {file ? file.name : t('banks.logo_choose')}
          </span>
          <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={updateBank.isPending || uploadLogo.isPending}
          className="text-[11px] font-black text-green-600 hover:bg-green-50 px-3 py-1.5 rounded-lg uppercase tracking-wider transition-all disabled:opacity-30"
        >
          {updateBank.isPending || uploadLogo.isPending ? tc('loading') : tc('save')}
        </button>
        <button
          type="button"
          onClick={() => {
            setFile(null);
            setPreview((prev) => {
              if (prev) URL.revokeObjectURL(prev);
              return null;
            });
            onClose();
          }}
          className="text-[11px] font-black text-stone-300 hover:bg-stone-100 px-3 py-1.5 rounded-lg uppercase tracking-wider transition-all"
        >
          {tc('cancel')}
        </button>
      </div>
    </form>
  );
}

function BankCard({ bank, index }: Readonly<{ bank: Bank; index: number }>) {
  const { t } = useTranslation('settings');
  const [editing, setEditing] = useState(false);
  const deleteBank = useDeleteBank();
  const { requestDelete, deleteConfirmModal } = useDeleteConfirmation(showToast);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: bank.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const accCount = bank.acc_count ?? 0;

  return (
    <>
      <SettingsCard
        title={bank.name}
        dragRef={setNodeRef}
        dragStyle={style}
        leading={
          <div className="flex flex-col items-center gap-0.5 shrink-0">
            <button
              {...attributes}
              {...listeners}
              className="p-1 text-stone-300 hover:text-stone-500 cursor-grab active:cursor-grabbing touch-none"
              tabIndex={-1}
            >
              <GripVertical size={14} />
            </button>
            <span className="text-[9px] font-bold text-stone-300 tabular-nums leading-none">
              {index + 1}
            </span>
          </div>
        }
        icon={
          bank.logo ? (
            <img
              src={bank.logo}
              alt=""
              className="w-7 h-7 object-contain"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          ) : (
            '🏦'
          )
        }
        subtitle={
          <p className="text-[10px] text-stone-400">{bank.domain ?? t('banks.no_domain')}</p>
        }
        badge={
          accCount > 0 ? (
            <span className="text-[10px] font-bold text-stone-300 tabular-nums shrink-0">
              {accCount}
            </span>
          ) : undefined
        }
        canDelete={accCount === 0}
        onDelete={() =>
          requestDelete(
            t('banks.delete_title'),
            t('banks.delete_body'),
            bank.id,
            deleteBank.mutate,
            t('banks.deleted'),
          )
        }
        isEditing={editing}
        onEditStart={() => setEditing(true)}
        editContent={<BankEditForm bank={bank} onClose={() => setEditing(false)} />}
      />
      {deleteConfirmModal}
    </>
  );
}

export function BanksManager() {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const { data: banks = [], isLoading: banksLoading } = useBanks();
  const createBank = useCreateBank();
  const reorderBanks = useReorderBanks();
  const qc = useQueryClient();
  const [newBank, setNewBank] = useState({ name: '', domain: '' });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (banksLoading) return <SettingsManagerSkeleton />;

  const handleAddBank = (e: SubmitEvent) => {
    e.preventDefault();
    if (!newBank.name.trim()) {
      showToast(t('banks.err_no_name'));
      return;
    }
    createBank.mutate(
      { name: newBank.name.trim(), domain: newBank.domain.trim() || null },
      {
        onSuccess: () => {
          setNewBank({ name: '', domain: '' });
          showToast(t('banks.success_add'));
        },
        onError: (err) => showToast(err.message),
      },
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = banks.findIndex((b) => b.id === active.id);
    const newIndex = banks.findIndex((b) => b.id === over.id);
    const reordered = arrayMove(banks, oldIndex, newIndex);
    qc.setQueryData(['banks'], reordered);

    reorderBanks.mutate(
      reordered.map((b, i) => ({ id: b.id, sort_order: i })),
      { onError: () => void qc.invalidateQueries({ queryKey: ['banks'] }) },
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
        {t('banks.title')}
      </p>
      <div className="p-3 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
        <p className="text-[10px] font-bold text-stone-400 uppercase mb-3 ml-1">
          {t('banks.new_title')}
        </p>
        <form onSubmit={handleAddBank} className="flex flex-col gap-2">
          <input
            type="text"
            value={newBank.name}
            onChange={(e) => setNewBank((f) => ({ ...f, name: e.target.value }))}
            className="text-sm bg-transparent border-b border-black/10 focus:border-black outline-none py-1.5 transition-colors placeholder:text-stone-300 font-medium"
            placeholder={t('banks.name_placeholder')}
          />
          <input
            type="text"
            value={newBank.domain}
            onChange={(e) => setNewBank((f) => ({ ...f, domain: e.target.value }))}
            className="text-sm bg-transparent border-b border-black/10 focus:border-black outline-none py-1.5 transition-colors placeholder:text-stone-300 font-medium"
            placeholder={t('banks.domain_placeholder')}
          />
          <div className="flex justify-end mt-1">
            <button
              type="submit"
              disabled={createBank.isPending}
              className="text-[11px] font-black text-green-600 hover:bg-green-50 px-3 py-1.5 rounded-lg uppercase tracking-wider transition-all disabled:opacity-30"
            >
              {createBank.isPending ? tc('loading') : tc('add')}
            </button>
          </div>
        </form>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={banks.map((b) => b.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {banks.map((bank, i) => (
              <BankCard key={bank.id} bank={bank} index={i} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
