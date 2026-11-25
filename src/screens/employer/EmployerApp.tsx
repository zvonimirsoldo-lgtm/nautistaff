import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import { supabase } from '../../supabase';
import { Btn, Card, Field, Screen, TabBar, Title, useToast } from '../../components';
import { C } from '../../theme';
import { versionLabel } from '../../updates';
import { errorText } from '../../utils';
import { logout } from '../../push';
import CompanySetupScreen from './CompanySetupScreen';
import MyJobsScreen from './MyJobsScreen';
import PostJobScreen, { RepostData } from './PostJobScreen';

type Company = { id: string; owner_id: string; name: string; fleet: string; base: string; verified: boolean; package: string; rating: number | null };
type Tab = 'jobs' | 'post' | 'company';

export default function EmployerApp(props: { userId: string }) {
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('jobs');
  const [refreshKey, setRefreshKey] = useState(0);
  const [news, setNews] = useState(0);
  const [repost, setRepost] = useState<{ data: RepostData; n: number } | null>(null);
  const toast = useToast();

  const loadCompany = useCallback(async () => {
    const { data } = await supabase.from('companies').select('*').eq('owner_id', props.userId).maybeSingle();
    setCompany((data as Company) ?? null);
    setLoading(false);
  }, [props.userId]);

  useEffect(() => { loadCompany(); }, [loadCompany]);

  // REAL-TIME: novi kandidat stiže odmah (sigurnosna pravila puštaju samo prijave na MOJE oglase)
  useEffect(() => {
    if (!company) return;
    const channel = supabase
      .channel(`employer-${company.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'applications' }, (payload) => {
        if (payload.eventType === 'INSERT' || (payload.new as { status?: string })?.status === 'pending') {
          toast('🔔 Novi kandidat se prijavio na vaš oglas!');
          setNews((n) => n + 1);
        }
        setRefreshKey((k) => k + 1);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [company, toast]);

  if (loading) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.sky} /></View>;
  }
  if (!company) {
    return <CompanySetupScreen userId={props.userId} onCreated={loadCompany} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        {tab === 'jobs' && (
          <MyJobsScreen
            companyId={company.id}
            companyName={company.name}
            refreshKey={refreshKey}
            onRepost={(data) => { setRepost((r) => ({ data, n: (r?.n ?? 0) + 1 })); setTab('post'); }}
          />
        )}
        {tab === 'post' && (
          <PostJobScreen
            key={repost ? `repost-${repost.n}` : 'new'}
            companyId={company.id}
            prefill={repost?.data ?? null}
            onPosted={() => { toast('🚀 Ponuda objavljena. Posada je vidi odmah.'); setRepost(null); setTab('jobs'); setRefreshKey((k) => k + 1); }}
          />
        )}
        {tab === 'company' && <CompanyScreen company={company} onSaved={loadCompany} />}
      </View>
      <TabBar
        tabs={[
          { id: 'jobs', label: '📋 Oglasi', badge: news },
          { id: 'post', label: '➕ Objava' },
          { id: 'company', label: '⛵ Tvrtka' },
        ]}
        active={tab}
        onChange={(t) => { setTab(t); if (t === 'jobs') setNews(0); if (t === 'post') setRepost(null); }}
      />
    </View>
  );
}

function CompanyScreen(props: { company: Company; onSaved: () => void }) {
  const c = props.company;
  const [name, setName] = useState(c.name);
  const [fleet, setFleet] = useState(c.fleet);
  const [base, setBase] = useState(c.base);
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    supabase.from('private_contacts').select('phone').maybeSingle().then(({ data }) => setPhone(data?.phone ?? ''));
  }, []);

  async function save() {
    setSaving(true);
    const { error } = await supabase.from('companies').update({ name: name.trim(), fleet: fleet.trim(), base: base.trim() }).eq('id', c.id);
    const r2 = error ? null : await supabase.from('private_contacts').upsert({ user_id: c.owner_id, phone: phone.trim(), updated_at: new Date().toISOString() });
    setSaving(false);
    if (r2?.error) return Alert.alert('Greška', errorText(r2.error));
    if (error) Alert.alert('Greška', errorText(error));
    else { toast('💾 Spremljeno'); props.onSaved(); }
  }

  return (
    <Screen>
      <Card style={{ borderColor: 'rgba(245,158,11,0.5)' }}>
        <Text style={{ color: C.text, fontWeight: '900', fontSize: 18 }}>
          {c.name} {c.verified ? <Text style={{ color: C.sky }}>✔</Text> : null}
        </Text>
        <Text style={{ color: c.verified ? C.green : C.dim, marginTop: 4, fontSize: 12 }}>
          {c.verified ? 'Verificiran poslodavac' : 'Čeka verifikaciju (admin provjerava OIB i registraciju)'}
        </Text>
        <Text style={{ color: C.muted, marginTop: 2, fontSize: 12 }}>
          Paket: {c.package === 'none' ? 'besplatni test' : c.package}{c.rating ? ` · ★ ${c.rating}` : ''}
        </Text>
      </Card>
      <Title>Podaci</Title>
      <Field label="Naziv tvrtke" value={name} onChangeText={setName} />
      <Field label="Flota" value={fleet} onChangeText={setFleet} />
      <Field label="Baza / marina" value={base} onChangeText={setBase} />
      <Field label="Kontakt mobitel (vidi ga samo kandidat kojeg prihvatite)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="npr. 098 765 4321" />
      <Btn title="Spremi" variant="green" onPress={save} loading={saving} />
      <Btn title="Odjava" variant="ghost" onPress={logout} style={{ marginTop: 24 }} />
      <Text style={{ color: C.dim, fontSize: 10, textAlign: 'center', marginTop: 12 }}>Verzija aplikacije: {versionLabel()}</Text>
    </Screen>
  );
}
