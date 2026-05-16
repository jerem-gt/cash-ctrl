import EmojiPicker, { Categories } from 'emoji-picker-react';

export function EmojiPickerWidget({ onSelect }: Readonly<{ onSelect: (emoji: string) => void }>) {
  return (
    <EmojiPicker
      onEmojiClick={(data) => onSelect(data.emoji)}
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
  );
}
