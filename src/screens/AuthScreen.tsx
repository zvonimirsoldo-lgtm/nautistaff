import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { supabase } from '../supabase';
import { Btn, Chips, Field, Screen } from '../components';
import { C } from '../theme';
import { errorText } from '../utils';

export default function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [role, setRole] = useState<'worker' | 'employer'>('worker');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    const mail = email.trim().toLowerCase();
    if (!mail.includes('@')) return Alert.alert('Provjerite e-mail adresu.');
    if (password.length < 6) return Alert.alert('Lozinka mora imati barem 6 znakova.');
    setBusy(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: mail, password });
        if (error) throw error;
      } else {
        if (fullName.trim().length < 2) {
          Alert.alert(role === 'worker' ? 'Upišite ime i prezime.' : 'Upišite ime kontakt osobe.');
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email: mail,
          password,
          options: { data: { role, full_name: fullName.trim() } },
        });
        if (error) throw error;
        if (!data.session) {
          Alert.alert('Potvrdite e-mail', 'Poslali smo vam link za potvrdu. Kliknite ga pa se prijavite.');
          setMode('login');
        }
      }
    } catch (e) {
      Alert.alert('Greška', translate(errorText(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <View style={{ alignItems: 'center', marginTop: 30, marginBottom: 28 }}>
          <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: C.amber, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 30 }}>⚓</Text>
          </View>
          <Text style={{ color: C.text, fontSize: 26, fontWeight: '900', marginTop: 12 }}>
            NautiStaff <Text style={{ color: C.sky }}>Live</Text>
          </Text>
          <Text style={{ color: C.muted, marginTop: 4 }}>Zapošljavanje posade u stvarnom vremenu</Text>
        </View>

        <Chips
          options={[{ value: 'login', label: 'Prijava' }, { value: 'register', label: 'Nova registracija' }]}
          value={mode}
          onChange={setMode}
        />

        {mode === 'register' && (
          <>
            <Chips
              label="Ja sam"
              options={[{ value: 'worker', label: '🧑‍✈️ Posada / tražim posao' }, { value: 'employer', label: '⛵ Poslodavac / čarter' }]}
              value={role}
              onChange={setRole}
            />
            <Field
              label={role === 'worker' ? 'Ime i prezime' : 'Kontakt osoba'}
              value={fullName}
              onChangeText={setFullName}
              placeholder="npr. Marko Horvat"
            />
          </>
        )}

        <Field label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="vas@email.com" />
        <Field label="Lozinka" value={password} onChangeText={setPassword} secureTextEntry placeholder="najmanje 6 znakova" />

        <Btn title={mode === 'login' ? 'Prijavi se' : 'Registriraj se'} onPress={submit} loading={busy} style={{ marginTop: 8 }} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

function translate(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'Pogrešan e-mail ili lozinka.';
  if (msg.includes('already registered')) return 'Ovaj e-mail je već registriran. Prijavite se.';
  if (msg.includes('Email not confirmed')) return 'E-mail još nije potvrđen. Provjerite poštu.';
  return msg;
}
