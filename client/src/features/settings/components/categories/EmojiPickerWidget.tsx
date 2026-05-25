import EmojiPicker, { Categories } from 'emoji-picker-react';
import { useTranslation } from 'react-i18next';

export function EmojiPickerWidget({ onSelect }: Readonly<{ onSelect: (emoji: string) => void }>) {
  const { t } = useTranslation('settings');
  return (
    <EmojiPicker
      onEmojiClick={(data) => onSelect(data.emoji)}
      width={300}
      height={350}
      previewConfig={{ showPreview: false }}
      skinTonesDisabled
      searchPlaceholder={t('categories.emoji_search_placeholder')}
      categories={[
        { category: Categories.SYMBOLS, name: t('categories.emoji_cat_symbols') },
        { category: Categories.OBJECTS, name: t('categories.emoji_cat_objects') },
        { category: Categories.TRAVEL_PLACES, name: t('categories.emoji_cat_places') },
        { category: Categories.FOOD_DRINK, name: t('categories.emoji_cat_food') },
        { category: Categories.ACTIVITIES, name: t('categories.emoji_cat_activities') },
      ]}
    />
  );
}
