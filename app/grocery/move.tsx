import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { Button } from '@/components/Button';
import { DateField } from '@/components/Fields';
import { useOverlay } from '@/components/Overlays';
import { Card, FormScreen } from '@/components/Screen';
import { Txt } from '@/components/Txt';
import { formatQuantity } from '@/lib/units';
import { useGrocery, useSettings } from '@/store';
import { messageOf } from '@/store/account';

export default function MoveToFridge() {
  const { items, moveBoughtToFridge } = useGrocery();
  const system = useSettings((state) => state.unitSystem);
  const bought = items.filter((item) => item.is_bought);
  const [dates, setDates] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);

  const move = async () => {
    setBusy(true);
    try {
      const count = await moveBoughtToFridge(dates);
      router.back();
      useOverlay
        .getState()
        .celebrate(
          'Fridge filled!',
          count === 1 ? '1 item is in the fridge.' : `${count} items are in the fridge.`,
        );
    } catch (error) {
      setBusy(false);
      Alert.alert('Could not move the items', messageOf(error));
    }
  };

  return (
    <FormScreen
      title="Move to fridge"
      footer={
        <Button
          icon="fridge-outline"
          title="Move to fridge"
          loading={busy}
          disabled={bought.length === 0}
          onPress={() => void move()}
          style={{ flex: 1 }}
        />
      }>
      <Txt color="textMuted">Add expiry dates where it matters. You can leave them blank.</Txt>
      {bought.map((item) => (
        <Card key={item.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
            <Txt variant="bodyStrong" style={{ flex: 1 }}>
              {item.name}
            </Txt>
            <Txt color="textMuted">{formatQuantity(item.quantity, item.unit, system)}</Txt>
          </View>
          <DateField
            label={`Expiry date for ${item.name}`}
            hideLabel
            optional
            value={dates[item.id] ?? null}
            onChange={(value) => setDates((all) => ({ ...all, [item.id]: value }))}
          />
        </Card>
      ))}
    </FormScreen>
  );
}
