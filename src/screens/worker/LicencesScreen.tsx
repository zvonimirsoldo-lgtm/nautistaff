import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { supabase } from '../../supabase';
import { Badge, Btn, Card, Chips, Empty, Field, Screen, Title, useToast, VerifiedBadge } from '../../components';
import { openStored, pickFile, uploadFile } from '../../files';
import { C } from '../../theme';
import { errorText } from '../../utils';

const TYPES = ['Voditelj brodice', 'STCW', 'Sanitarna iskaznica', 'VHF / radio', 'Prva pomoć', 'Ostalo'];

type Cert = { id: string; type: string; file_path: string; expires_on: string | null; status: 'pending' | 'approved' | 'rejected' };

const STATUS = {
  pending: { text: 'Na provjeri', color: C.amberLight },
  approved: { text: 'Odobreno', color: C.green },
  rejected: { text: 'Odbijeno', color: C.red },
};

// "31.12.2027" -> "2027-12-31"
function parseDate(text: string): string | null | 'invalid' {
  const t = text.trim();
  if (!t) return null;
  const m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\.?$/);
  if (!m) return 'invalid';
  const d = Number(m[1]), mo = Number(m[2]), y = Number(m[3]);
  if (d < 1 || d > 31 || mo < 1 || mo > 12 || y < 2000 || y > 2100) return 'invalid';
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function showDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${Number(d)}.${Number(m)}.${y}.`;
}

export default function LicencesScreen(props: { userId: string }) {
  const [certs, setCerts] = useState<Cert[]>([]);
  const [verified, setVerified] = useState(false);
  const [type, setType] = useState(TYPES[0]);
  const [expires, setExpires] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    const [{ data: c }, { data: wp }] = await Promise.all([
      supabase.from('certificates').select('id, type, file_path, expires_on, status').eq('user_id', props.userId).order('created_at', { ascending: false }),
      supabase.from('worker_profiles').select('verified').eq('user_id', props.userId).maybeSingle(),
    ]);
    setCerts((c ?? []) as Cert[]);
    setVerified(!!wp?.verified);
  }, [props.userId]);

  useEffect(() => { load(); }, [load]);

  async function upload() {
    const exp = parseDate(expires);
    if (exp === 'invalid') return Alert.alert('Datum isteka upišite kao npr. 31.12.2027');
    try {
      const file = await pickFile(['application/pdf', 'image/*']);
      if (!file) return;
      setBusy(true);
      const path = `${props.userId}/${Date.now()}.${file.ext}`;
      await uploadFile('certificates', path, file);
      const { error } = await supabase.from('certificates').insert({ user_id: props.userId, type, file_path: path, expires_on: exp });
      if (error) throw error;
      setExpires('');
      toast('🪪 Licenca poslana na provjeru');
      load();
    } catch (e) {
      Alert.alert('Licenca nije učitana', errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(cert: Cert) {
    Alert.alert('Obrisati licencu?', cert.type, [
      { text: 'Odustani', style: 'cancel' },
      {
        text: 'Obriši', style: 'destructive', onPress: async () => {
          await supabase.storage.from('certificates').remove([cert.file_path]);
          const { error } = await supabase.from('certificates').delete().eq('id', cert.id);
          if (error) Alert.alert('Greška', errorText(error));
          load();
        },
      },
    ]);
  }

  return (
    <Screen>
      <Card style={{ borderColor: verified ? C.sky : C.border }}>
        {verified ? (
          <>
            <VerifiedBadge />
            <Text style={{ color: C.muted, fontSize: 12, marginTop: 6 }}>Vaš profil ima plavu značku. Poslodavci je vide uz vašu prijavu.</Text>
          </>
        ) : (
          <>
            <Text style={{ color: C.text, fontWeight: '800' }}>Kako dobiti plavu značku?</Text>
            <Text style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>
              1. Učitajte sliku ili PDF licence.{'\n'}2. Administrator je provjeri.{'\n'}3. Nakon odobrenja profil automatski dobiva značku ✔ VERIFICIRAN.
            </Text>
          </>
        )}
      </Card>

      <Title>Dodaj licencu</Title>
      <Chips label="Vrsta" options={TYPES.map((t) => ({ value: t, label: t }))} value={type} onChange={setType} />
      <Field label="Vrijedi do (neobavezno)" value={expires} onChangeText={setExpires} placeholder="npr. 31.12.2027" keyboardType="numbers-and-punctuation" />
      <Btn title="📎 Odaberi datoteku i pošalji" onPress={upload} loading={busy} />

      <Title>Moje licence</Title>
      {certs.length === 0 ? <Empty text="Još niste učitali nijednu licencu." /> : certs.map((c) => {
        const st = STATUS[c.status];
        return (
          <Card key={c.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: C.text, fontWeight: '800', flex: 1 }}>{c.type}</Text>
              <Badge text={st.text} color={st.color} />
            </View>
            {c.expires_on ? <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>Vrijedi do {showDate(c.expires_on)}</Text> : null}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <Btn title="Pogledaj" small variant="ghost" onPress={() => openStored('certificates', c.file_path).catch((e) => Alert.alert('Greška', errorText(e)))} />
              <Btn title="Obriši" small variant="danger" onPress={() => remove(c)} />
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}
