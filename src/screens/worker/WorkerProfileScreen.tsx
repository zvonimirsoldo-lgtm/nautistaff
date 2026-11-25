import React, { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { supabase } from '../../supabase';
import { Btn, Card, Field, MultiChips, Screen, Title, Toggle, useToast, VerifiedBadge } from '../../components';
import { useAuth } from '../../auth';
import { openStored, pickFile, uploadFile } from '../../files';
import { logout } from '../../push';
import { C } from '../../theme';
import { versionLabel } from '../../updates';
import { CATEGORIES, errorText } from '../../utils';

export default function WorkerProfileScreen(props: { userId: string }) {
  const { profile, reloadProfile } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ full_name: '', title: '', years: '', languages: '', vessels: '', bio: '', phone: '' });
  const [categories, setCategories] = useState<string[]>([]);
  const [available, setAvailable] = useState(true);
  const [verified, setVerified] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [cvPath, setCvPath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: wp }, { data: pc }] = await Promise.all([
        supabase.from('worker_profiles').select('*').eq('user_id', props.userId).maybeSingle(),
        supabase.from('private_contacts').select('phone').eq('user_id', props.userId).maybeSingle(),
      ]);
      setForm({
        full_name: profile?.full_name ?? '',
        title: wp?.title ?? '',
        years: wp?.experience_years != null ? String(wp.experience_years) : '',
        languages: wp?.languages ?? '',
        vessels: wp?.vessels ?? '',
        bio: wp?.bio ?? '',
        phone: pc?.phone ?? '',
      });
      setCategories(wp?.categories ?? []);
      setAvailable(wp?.available ?? true);
      setVerified(!!wp?.verified);
      setRating(wp?.rating ?? null);
      setCvPath(wp?.cv_path ?? null);
    })();
  }, [props.userId, profile?.full_name]);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    const years = form.years.trim() === '' ? null : parseInt(form.years, 10);
    if (years !== null && (isNaN(years) || years < 0 || years > 60)) return Alert.alert('Godine iskustva upišite kao broj od 0 do 60.');
    setSaving(true);
    try {
      const p1 = await supabase.from('profiles').update({ full_name: form.full_name.trim() }).eq('id', props.userId);
      if (p1.error) throw p1.error;
      const p2 = await supabase.from('worker_profiles').update({
        title: form.title.trim(), experience_years: years, languages: form.languages.trim(),
        vessels: form.vessels.trim(), bio: form.bio.trim(), categories, available,
      }).eq('user_id', props.userId);
      if (p2.error) throw p2.error;
      const p3 = await supabase.from('private_contacts').upsert({ user_id: props.userId, phone: form.phone.trim(), updated_at: new Date().toISOString() });
      if (p3.error) throw p3.error;
      await reloadProfile();
      toast('💾 Profil spremljen');
    } catch (e) {
      Alert.alert('Greška', errorText(e));
    } finally {
      setSaving(false);
    }
  }

  async function uploadCv() {
    try {
      const file = await pickFile(['application/pdf']);
      if (!file) return;
      setUploading(true);
      const path = `${props.userId}/cv.pdf`;
      await uploadFile('cv', path, file);
      const { error } = await supabase.from('worker_profiles').update({ cv_path: path }).eq('user_id', props.userId);
      if (error) throw error;
      setCvPath(path);
      toast('📄 CV učitan. Poslodavci ga vide kad im se prijavite.');
    } catch (e) {
      Alert.alert('CV nije učitan', errorText(e));
    } finally {
      setUploading(false);
    }
  }

  return (
    <Screen>
      <Card style={{ borderColor: verified ? C.sky : 'rgba(56,189,248,0.4)' }}>
        <Text style={{ color: C.text, fontWeight: '900', fontSize: 18 }}>{form.full_name || 'Moj profil'}</Text>
        <Text style={{ color: C.amberLight, fontWeight: '700', marginTop: 2 }}>{form.title || 'Dodajte svoje zanimanje'}</Text>
        <View style={{ marginTop: 8 }}>
          {verified ? <VerifiedBadge /> : (
            <Text style={{ color: C.dim, fontSize: 12 }}>Plavu značku dobivate kad administrator odobri vašu licencu (kartica „Licence").</Text>
          )}
        </View>
        <View style={{ flexDirection: 'row', marginTop: 8 }}>
          <Text style={{ color: C.muted, fontSize: 12, marginRight: 14 }}>
            Iskustvo: {form.years ? `${form.years} god.` : '-'}
          </Text>
          <Text style={{ color: C.muted, fontSize: 12 }}>Ocjena: {rating ? `${rating} ★` : 'još nema'}</Text>
        </View>
      </Card>

      <Title>Životopis (CV)</Title>
      <Card>
        <Text style={{ color: cvPath ? C.green : C.dim, marginBottom: 8 }}>{cvPath ? '📄 CV je učitan' : 'CV još nije učitan'}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Btn title={cvPath ? 'Zamijeni CV (PDF)' : 'Učitaj CV (PDF)'} small onPress={uploadCv} loading={uploading} />
          {cvPath ? <Btn title="Pogledaj" small variant="ghost" onPress={() => openStored('cv', cvPath).catch((e) => Alert.alert('Greška', errorText(e)))} /> : null}
        </View>
      </Card>

      <Title>Podaci koje poslodavac vidi</Title>
      <Toggle label="Dostupan sam za posao (primam obavijesti)" value={available} onChange={setAvailable} />
      <MultiChips
        label="Zanimanja za koja primam obavijesti (prazno = sva)"
        options={CATEGORIES.map((c) => ({ value: c.id, label: c.name }))}
        values={categories}
        onChange={setCategories}
      />
      <Field label="Ime i prezime" value={form.full_name} onChangeText={set('full_name')} />
      <Field label="Zanimanje / titula" value={form.title} onChangeText={set('title')} placeholder="npr. Skiper na katamaranima" />
      <Field label="Godine iskustva" value={form.years} onChangeText={set('years')} keyboardType="number-pad" maxLength={2} placeholder="npr. 6" />
      <Field label="Strani jezici" value={form.languages} onChangeText={set('languages')} placeholder="npr. engleski C1, talijanski B2" />
      <Field label="Brodovi i flote" value={form.vessels} onChangeText={set('vessels')} placeholder="npr. Lagoon 450, Bavaria C45" />
      <Field label="O meni" value={form.bio} onChangeText={set('bio')} multiline style={{ minHeight: 80, textAlignVertical: 'top' }} />

      <Title>Kontakt</Title>
      <Field label="Broj mobitela (vidi ga samo poslodavac koji vas prihvati)" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" placeholder="npr. 091 123 4567" />

      <Btn title="Spremi profil" variant="green" onPress={save} loading={saving} />
      <Btn title="Odjava" variant="ghost" onPress={logout} style={{ marginTop: 24 }} />
      <Text style={{ color: C.dim, fontSize: 10, textAlign: 'center', marginTop: 12 }}>Verzija aplikacije: {versionLabel()}</Text>
    </Screen>
  );
}
