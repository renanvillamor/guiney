import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme/spacing';

import { Button } from './Button';
import { Guiney, type GuineyVariant } from './Guiney';
import { Txt } from './Txt';

interface Props {
  variant: GuineyVariant;
  title: string;
  body?: string;
  action?: { title: string; onPress: () => void };
}

export function EmptyState({ variant, title, body, action }: Props) {
  return (
    <View style={styles.wrap}>
      <Guiney variant={variant} size={170} />
      <Txt variant="heading" center>
        {title}
      </Txt>
      {body ? (
        <Txt center color="textMuted" style={styles.body}>
          {body}
        </Txt>
      ) : null}
      {action ? <Button title={action.title} onPress={action.onPress} style={styles.action} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl },
  body: { maxWidth: 300 },
  action: { marginTop: spacing.md, minWidth: 200 },
});
