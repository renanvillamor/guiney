import { router } from 'expo-router';

import { Sheet, SheetRow } from './Sheet';

/** The ways to add a recipe. */
export function AddRecipeSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const importFrom = (from: 'link' | 'photo' | 'text') => {
    onClose();
    router.push({ pathname: '/recipe/import', params: { from } });
  };
  return (
    <Sheet visible={visible} title="Add a recipe" onClose={onClose}>
      <SheetRow
        icon="pencil-outline"
        title="Write it"
        onPress={() => {
          onClose();
          router.push('/recipe/edit');
        }}
      />
      <SheetRow
        icon="web"
        title="From a website"
        subtitle="Paste a link"
        onPress={() => importFrom('link')}
      />
      <SheetRow
        icon="camera-outline"
        title="From a photo"
        subtitle="A cookbook page or a printed recipe"
        onPress={() => importFrom('photo')}
      />
      <SheetRow
        icon="text-box-outline"
        title="From text"
        subtitle="Paste a message or post"
        onPress={() => importFrom('text')}
      />
    </Sheet>
  );
}
