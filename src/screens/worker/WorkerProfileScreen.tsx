import React, { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { supabase } from '../../supabase';
import { Btn, Card, Field, Screen, Title, useToast } from '../../components';
import { useAuth } from '../../auth';
import { C } from '../../theme';
import { errorText } from '../../utils';

export default function WorkerProfileScreen(props: { userId: string }) {
  const { profile, reloadProfile } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ full_name: '', title: '', miles: '', languages: '', vessels: '', bio: '' });
  const [verified, setVerified] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('worker_profiles').select('*').eq('user_id', props.userId).maybeSingle();
      setForm({
        full_name: profile?.full_name ?? '',
        title: data?.title ?? '',
        miles: data?.miles ?? '',
        languages: data?.languages ?? '',
        vessels: data?.vessels ?? '',
        bio: data?.bio ?? '',
      });
      setVerified(!!data?.verified);
      setRating(data?.rating ?? null);
    })();
  }, [props.userId, profile?.full_name]);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      const p1 = await supabase.from('profiles').update({ full_name: form.full_name.trim() }).eq('id', props.userId);
      if (p1.error) throw p1.error;
      const p2 = await supabase.from('worker_profiles').update({
        title: form.title.trim(), miles: form.miles.trim(), languages: form.languages.trim(),
        vessels: form.vessels.trim(), bio: form.bio.trim(),
      }).eq('user_id', props.userId);
      if (p2.error) throw p2.error;
      await reloadProfile();
      toast('💾 Profil spremljen');
    } catch (e) {
      Alert.alert('Greška', errorText(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Card style={{ borderColor: 'rgba(56,189,248,0.4)' }}>
        <Text style={{ color: C.text, fontWeight: '900', fontSize: 18 }}>
          {form.full_name || 'Moj profil'} {verified ? <Text style={{ color: C.sky }}>✔</Text> : null}
        </Text>
        <Text style={{ color: C.amberLight, fontWeight: '700', marginTop: 2 }}>{form.title || 'Dodajte svoje zanimanje'}</Text>
        <View style={{ flexDirection: 'row', marginTop: 8 }}>
          <Text style={{ color: C.muted, fontSize: 12, marginRight: 14 }}>Ocjena: {rating ? `${rating} ★` : 'još nema'}</Text>
          <Text style={{ color: verified ? C.green : C.dim, fontSize: 12 }}>{verified ? 'Licence verificirane' : 'Licence nisu verificirane'}</Text>
        </View>
      </Card>

      <Title>Podaci koje poslodavac vidi</Title>
      <Field label="Ime i prezime" value={form.full_name} onChangeText={set('full_name')} />
      <Field label="Zanimanje / titula" value={form.title} onChangeText={set('title')} placeholder="npr. Skiper, 6 sezona" />
      <Field label="Nautičke milje" value={form.miles} onChangeText={set('miles')} placeholder="npr. 14.500 NM" />
      <Field label="Strani jezici" value={form.languages} onChangeText={set('languages')} placeholder="npr. engleski C1, talijanski B2" />
      <Field label="Brodovi i flote" value={form.vessels} onChangeText={set('vessels')} placeholder="npr. Lagoon 450, Bavaria C45" />
      <Field label="O meni" value={form.bio} onChangeText={set('bio')} multiline style={{ minHeight: 80, textAlignVertical: 'top' }} />

      <Btn title="Spremi profil" variant="green" onPress={save} loading={saving} />
      <Text style={{ color: C.dim, fontSize: 11, marginTop: 10 }}>CV i učitavanje licenci dolaze u sljedećoj verziji.</Text>
      <Btn title="Odjava" variant="ghost" onPress={() => supabase.auth.signOut()} style={{ marginTop: 24 }} />
    </Screen>
  );
}
