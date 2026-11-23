import { router } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/Button';
import { TextField } from '@/components/Fields';
import { Guiney } from '@/components/Guiney';
import { FormScreen } from '@/components/Screen';
import { Txt } from '@/components/Txt';
import { isSupabaseConfigured } from '@/lib/supabase';
import { messageOf, useAccount } from '@/store/account';

export default function SignIn() {
  const { signIn, signUp } = useAccount();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isSupabaseConfigured) {
    return (
      <FormScreen title="Sign in">
        <Guiney variant="icon" size={140} />
        <Txt center>This build has no server set up. Everything works on this phone without one.</Txt>
      </FormScreen>
    );
  }

  const submit = async () => {
    setError(null);
    setNotice(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Enter a full email address.');
      return;
    }
    if (password.length < 8 && mode === 'up') {
      setError('Use at least 8 characters for the password.');
      return;
    }
    if (password === '') {
      setError('Enter your password.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'in') {
        await signIn(email.trim(), password);
        router.replace('/auth/household');
      } else if (await signUp(email.trim(), password)) {
        router.replace('/auth/household');
      } else {
        setMode('in');
        setNotice('Check your email to confirm the account, then sign in.');
      }
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormScreen title={mode === 'in' ? 'Sign in' : 'Create account'}>
      <Guiney variant="icon" size={120} decorative />
      <Txt center color="textMuted">
        Share recipes, plans and groceries with the people you live with.
      </Txt>
      {notice ? <Txt color="secondary" center>{notice}</Txt> : null}
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        inputMode="email"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
        hint={mode === 'up' ? 'At least 8 characters.' : undefined}
        error={error}
        onSubmitEditing={() => void submit()}
      />
      <Button
        title={mode === 'in' ? 'Sign in' : 'Create account'}
        loading={busy}
        onPress={() => void submit()}
      />
      <Button
        kind="plain"
        title={mode === 'in' ? 'New here? Create an account' : 'Have an account? Sign in'}
        onPress={() => {
          setMode(mode === 'in' ? 'up' : 'in');
          setError(null);
        }}
      />
    </FormScreen>
  );
}
