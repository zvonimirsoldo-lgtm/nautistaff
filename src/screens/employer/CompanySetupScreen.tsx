import React, { useState } from 'react';
import { Alert, Text } from 'react-native';
import { supabase } from '../../supabase';
import { Btn, Field, Screen, Title } from '../../components';
import { C } from '../../theme';
import { errorText } from '../../utils';
import { logout } from '../../push';

export default function CompanySetupScreen(props: { userId: string; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [oib, setOib] = useState('');
  const [fleet, setFleet] = useState('');
  const [base, setBase] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);

  async function create() {
    if (name.trim().length < 2) return Alert.alert('Upišite naziv tvrtke.');
    if (oib.trim() && !/^[0-9]{11}$/.test(oib.trim())) return Alert.alert('OIB mora imati 11 znamenki.');
    setBusy(true);
    const { error } = await supabase.from('companies').insert({
      owner_id: props.userId,
      name: name.trim(),
      oib: oib.trim() || null,
      fleet: fleet.trim(),
      base: base.trim(),
    });
    if (!error && phone.trim()) {
      await supabase.from('private_contacts').upsert({ user_id: props.userId, phone: phone.trim() });
    }
    setBusy(false);
    if (error) Alert.alert('Greška', errorText(error));
    else props.onCreated();
  }

  return (
    <Screen>
      <Title>Podaci o tvrtki</Title>
      <Text style={{ color: C.muted, marginBottom: 16 }}>
        Prije prve objave upišite podatke o tvrtki. Posada ih vidi uz svaki vaš oglas.
      </Text>
      <Field label="Naziv tvrtke / agencije" value={name} onChangeText={setName} placeholder="npr. Navis Charter Trogir" />
      <Field label="OIB (neobavezno za test)" value={oib} onChangeText={setOib} keyboardType="number-pad" maxLength={11} />
      <Field label="Flota" value={fleet} onChangeText={setFleet} placeholder="npr. 12 katamarana, 6 jedrilica" />
      <Field label="Baza / marina" value={base} onChangeText={setBase} placeholder="npr. Marina Trogir" />
      <Field label="Kontakt mobitel (vidi ga samo kandidat kojeg prihvatite)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="npr. 098 765 4321" />
      <Btn title="Spremi i nastavi" onPress={create} loading={busy} style={{ marginTop: 8 }} />
      <Btn title="Odjava" variant="ghost" onPress={logout} style={{ marginTop: 24 }} />
    </Screen>
  );
}
