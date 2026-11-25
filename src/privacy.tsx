import React, { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from './supabase';
import { Btn, Toggle, useToast } from './components';
import { useAuth } from './auth';
import { logout } from './push';
import { C } from './theme';
import { errorText } from './utils';
import { LegalSection, PRIVACY, TERMS, TERMS_VERSION } from './legal';

// ---------- Prikaz Uvjeta ili Politike privatnosti preko cijelog ekrana ----------
export function LegalModal(props: { doc: 'terms' | 'privacy' | null; onClose: () => void }) {
  const sections: LegalSection[] = props.doc === 'privacy' ? PRIVACY : TERMS;
  const title = props.doc === 'privacy' ? 'Politika privatnosti' : 'Uvjeti korištenja';
  return (
    <Modal visible={!!props.doc} animationType="slide" onRequestClose={props.onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top', 'bottom']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: C.border }}>
          <Text style={{ color: C.text, fontWeight: '900', fontSize: 17, flex: 1 }}>{title}</Text>
          <Btn title="Zatvori" small variant="ghost" onPress={props.onClose} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <Text style={{ color: C.dim, fontSize: 11, marginBottom: 12 }}>Verzija {TERMS_VERSION}</Text>
          {sections.map((sec) => (
            <View key={sec.title} style={{ marginBottom: 16 }}>
              <Text style={{ color: C.sky, fontWeight: '900', fontSize: 14, marginBottom: 6 }}>{sec.title}</Text>
              {sec.body.map((p, i) => (
                <Text key={i} style={{ color: C.text, fontSize: 13, lineHeight: 19, marginBottom: 6 }}>{p}</Text>
              ))}
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ---------- Kvačica ----------
function Check(props: { checked: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <Pressable onPress={props.onToggle} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}>
      <View style={{
        width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: props.checked ? C.sky : C.muted,
        backgroundColor: props.checked ? C.skyDark : 'transparent', alignItems: 'center', justifyContent: 'center', marginRight: 10, marginTop: 1,
      }}>
        {props.checked ? <Text style={{ color: C.bg, fontWeight: '900', fontSize: 13 }}>✓</Text> : null}
      </View>
      <View style={{ flex: 1 }}>{props.children}</View>
    </Pressable>
  );
}

// ---------- Ekran prihvaćanja uvjeta (nakon registracije ili kad se uvjeti promijene) ----------
export function TermsGate() {
  const { profile, reloadProfile } = useAuth();
  const [doc, setDoc] = useState<'terms' | 'privacy' | null>(null);
  const [c1, setC1] = useState(false);
  const [c2, setC2] = useState(false);
  const [c3, setC3] = useState(false);
  const [busy, setBusy] = useState(false);
  const isUpdate = !!profile?.terms_version;

  async function accept() {
    setBusy(true);
    const { error } = await supabase.rpc('accept_terms', { p_version: TERMS_VERSION });
    if (error) {
      setBusy(false);
      return Alert.alert('Greška', errorText(error));
    }
    await reloadProfile();
    setBusy(false);
  }

  const link = (label: string, d: 'terms' | 'privacy') => (
    <Text style={{ color: C.sky, fontWeight: '800', textDecorationLine: 'underline' }} onPress={() => setDoc(d)}>{label}</Text>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 20, paddingTop: 30 }}>
      <Text style={{ color: C.text, fontWeight: '900', fontSize: 20, marginBottom: 8 }}>
        {isUpdate ? 'Uvjeti su ažurirani' : 'Još jedan korak'}
      </Text>
      <Text style={{ color: C.muted, marginBottom: 20, lineHeight: 20 }}>
        {isUpdate
          ? 'Promijenili smo Uvjete korištenja ili Politiku privatnosti. Za nastavak ih pročitajte i prihvatite.'
          : 'NautiStaff Live je oglasnik koji povezuje posadu i poslodavce. Prije korištenja pročitajte kako radimo i kako štitimo vaše podatke.'}
      </Text>

      <Check checked={c1} onToggle={() => setC1(!c1)}>
        <Text style={{ color: C.text, lineHeight: 20 }}>Pročitao/la sam i prihvaćam {link('Uvjete korištenja', 'terms')}.</Text>
      </Check>
      <Check checked={c2} onToggle={() => setC2(!c2)}>
        <Text style={{ color: C.text, lineHeight: 20 }}>Upoznat/a sam s {link('Politikom privatnosti', 'privacy')}.</Text>
      </Check>
      <Check checked={c3} onToggle={() => setC3(!c3)}>
        <Text style={{ color: C.text, lineHeight: 20 }}>Imam najmanje 18 godina.</Text>
      </Check>

      <Btn title="Prihvaćam i nastavljam" onPress={accept} loading={busy} disabled={!(c1 && c2 && c3)} style={{ marginTop: 8 }} />
      <Btn title="Odjava" variant="ghost" onPress={logout} style={{ marginTop: 12 }} />
      <LegalModal doc={doc} onClose={() => setDoc(null)} />
    </ScrollView>
  );
}

// ---------- Brisanje svih vlastitih datoteka iz spremnika ----------
async function removeMyFiles(userId: string) {
  for (const bucket of ['cv', 'certificates'] as const) {
    const { data } = await supabase.storage.from(bucket).list(userId, { limit: 1000 });
    const paths = (data ?? []).map((f: { name: string }) => `${userId}/${f.name}`);
    if (paths.length) await supabase.storage.from(bucket).remove(paths);
  }
}

// ---------- Okvir "Privatnost i račun" (u profilu posade, tvrtke i admina) ----------
export function PrivacySection(props: { userId: string; role: 'worker' | 'employer' | 'admin'; onLocationChanged?: () => void }) {
  const toast = useToast();
  const [doc, setDoc] = useState<'terms' | 'privacy' | null>(null);
  const [shareLoc, setShareLoc] = useState(true);
  const [healthAt, setHealthAt] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: p } = await supabase.from('profiles').select('health_consent_at').eq('id', props.userId).maybeSingle();
      setHealthAt(p?.health_consent_at ?? null);
      if (props.role === 'worker') {
        const { data: w } = await supabase.from('worker_profiles').select('share_location').eq('user_id', props.userId).maybeSingle();
        setShareLoc(w?.share_location ?? true);
      }
    })();
  }, [props.userId, props.role]);

  async function toggleLocation(v: boolean) {
    setShareLoc(v);
    const patch = v ? { share_location: true } : { share_location: false, lat: null, lng: null };
    const { error } = await supabase.from('worker_profiles').update(patch).eq('user_id', props.userId);
    if (error) return Alert.alert('Greška', errorText(error));
    toast(v ? '📍 Lokacija uključena' : '📍 Lokacija isključena i spremljena lokacija obrisana');
    props.onLocationChanged?.();
  }

  function withdrawHealth() {
    Alert.alert('Povući privolu?', 'Sanitarna iskaznica bit će obrisana, a oznaka verifikacije će se ponovno izračunati.', [
      { text: 'Odustani', style: 'cancel' },
      {
        text: 'Povuci privolu', style: 'destructive', onPress: async () => {
          const { data } = await supabase.from('certificates').select('id, file_path').eq('user_id', props.userId).ilike('type', '%sanitarn%');
          const rows = (data ?? []) as { id: string; file_path: string }[];
          if (rows.length) {
            await supabase.storage.from('certificates').remove(rows.map((r) => r.file_path));
            await supabase.from('certificates').delete().in('id', rows.map((r) => r.id));
          }
          const { error } = await supabase.rpc('set_health_consent', { p_consent: false });
          if (error) return Alert.alert('Greška', errorText(error));
          setHealthAt(null);
          toast('Privola povučena, dokument obrisan');
        },
      },
    ]);
  }

  async function exportData() {
    setBusy('export');
    const { data, error } = await supabase.rpc('export_my_data');
    setBusy(null);
    if (error) return Alert.alert('Greška', errorText(error));
    await Share.share({ title: 'Moji podaci - NautiStaff Live', message: JSON.stringify(data, null, 2) });
  }

  function deleteAccount() {
    Alert.alert(
      'Obrisati račun?',
      props.role === 'employer'
        ? 'Trajno se brišu vaš račun, tvrtka, svi oglasi i prijave na njih.'
        : 'Trajno se brišu vaš račun, profil, CV, licence, prijave i kalendar.',
      [
        { text: 'Odustani', style: 'cancel' },
        {
          text: 'Nastavi', style: 'destructive', onPress: () => Alert.alert(
            'Jeste li sigurni?', 'Ovo se ne može poništiti.',
            [
              { text: 'Ne', style: 'cancel' },
              {
                text: 'Da, obriši sve', style: 'destructive', onPress: async () => {
                  setBusy('delete');
                  try {
                    await removeMyFiles(props.userId);
                    const { error } = await supabase.rpc('delete_my_account');
                    if (error) throw error;
                    await logout();
                  } catch (e) {
                    Alert.alert('Račun nije obrisan', errorText(e));
                  } finally {
                    setBusy(null);
                  }
                },
              },
            ],
          ),
        },
      ],
    );
  }

  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <Btn title="📄 Uvjeti korištenja" small variant="ghost" onPress={() => setDoc('terms')} />
        <Btn title="🔒 Politika privatnosti" small variant="ghost" onPress={() => setDoc('privacy')} />
      </View>

      {props.role === 'worker' ? (
        <>
          <Toggle label="Koristi moju lokaciju za ponude u blizini" value={shareLoc} onChange={toggleLocation} />
          <Text style={{ color: C.dim, fontSize: 11, marginTop: -4, marginBottom: 12 }}>
            Pamtimo samo približnu zadnju lokaciju. Kad isključite, odmah je brišemo.
          </Text>
          <Text style={{ color: C.muted, fontSize: 12, marginBottom: 4 }}>
            Privola za zdravstvene podatke (sanitarna iskaznica): {healthAt ? `dana ${new Date(healthAt).toLocaleDateString('hr-HR')}` : 'nije dana'}
          </Text>
          {healthAt ? <Btn title="Povuci privolu" small variant="ghost" onPress={withdrawHealth} style={{ alignSelf: 'flex-start', marginBottom: 12 }} /> : null}
        </>
      ) : null}

      <Btn title="📦 Preuzmi moje podatke" variant="ghost" onPress={exportData} loading={busy === 'export'} style={{ marginBottom: 8 }} />
      <Btn title="🗑 Obriši račun" variant="danger" onPress={deleteAccount} loading={busy === 'delete'} />

      <LegalModal doc={doc} onClose={() => setDoc(null)} />
    </View>
  );
}
