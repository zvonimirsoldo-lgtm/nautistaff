import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { supabase } from '../../supabase';
import { Badge, Btn, Card, Empty, Screen, TabBar, Title, useToast } from '../../components';
import { openStored } from '../../files';
import { logout } from '../../push';
import { C } from '../../theme';
import { errorText } from '../../utils';

type Tab = 'certs' | 'companies';

type PendingCert = {
  id: string; type: string; file_path: string; expires_on: string | null; created_at: string;
  profiles: { full_name: string } | null;
};
type PendingCompany = { id: string; name: string; oib: string | null; base: string; fleet: string };

// Administratorski dio: provjera licenci (plava značka) i verifikacija tvrtki
export default function AdminApp() {
  const [tab, setTab] = useState<Tab>('certs');
  const [certs, setCerts] = useState<PendingCert[]>([]);
  const [companies, setCompanies] = useState<PendingCompany[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    const [c, co] = await Promise.all([
      supabase.from('certificates').select('id, type, file_path, expires_on, created_at, profiles(full_name)')
        .eq('status', 'pending').order('created_at'),
      supabase.from('companies').select('id, name, oib, base, fleet').eq('verified', false).order('created_at'),
    ]);
    setCerts((c.data ?? []) as unknown as PendingCert[]);
    setCompanies((co.data ?? []) as PendingCompany[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function decideCert(id: string, status: 'approved' | 'rejected') {
    const { error } = await supabase.from('certificates').update({ status }).eq('id', id);
    if (error) Alert.alert('Greška', errorText(error));
    else toast(status === 'approved' ? '✔ Odobreno, radnik dobiva plavu značku' : 'Odbijeno');
    load();
  }

  async function verifyCompany(id: string) {
    const { error } = await supabase.from('companies').update({ verified: true }).eq('id', id);
    if (error) Alert.alert('Greška', errorText(error));
    else toast('✔ Tvrtka verificirana');
    load();
  }

  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
        {tab === 'certs' ? (
          <>
            <Title>Licence na provjeri ({certs.length})</Title>
            {certs.length === 0 ? <Empty text="Nema licenci za provjeru." /> : certs.map((c) => (
              <Card key={c.id}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: C.text, fontWeight: '800' }}>{c.profiles?.full_name || 'Radnik'}</Text>
                  <Badge text={c.type} color={C.amberLight} />
                </View>
                {c.expires_on ? <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>Vrijedi do: {c.expires_on}</Text> : null}
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                  <Btn title="Pogledaj" small variant="ghost" onPress={() => openStored('certificates', c.file_path).catch((e) => Alert.alert('Greška', errorText(e)))} />
                  <Btn title="Odbij" small variant="danger" onPress={() => decideCert(c.id, 'rejected')} />
                  <Btn title="✔ Odobri" small variant="green" onPress={() => decideCert(c.id, 'approved')} />
                </View>
              </Card>
            ))}
          </>
        ) : (
          <>
            <Title>Neverificirane tvrtke ({companies.length})</Title>
            {companies.length === 0 ? <Empty text="Sve tvrtke su verificirane." /> : companies.map((c) => (
              <Card key={c.id}>
                <Text style={{ color: C.text, fontWeight: '800' }}>{c.name}</Text>
                <Text style={{ color: C.muted, fontSize: 12 }}>OIB: {c.oib || 'nije upisan'} · {c.base || '-'}</Text>
                {c.fleet ? <Text style={{ color: C.dim, fontSize: 12 }}>{c.fleet}</Text> : null}
                <Btn title="✔ Verificiraj" small variant="green" onPress={() => verifyCompany(c.id)} style={{ alignSelf: 'flex-end', marginTop: 8 }} />
              </Card>
            ))}
          </>
        )}
        <Btn title="Odjava" variant="ghost" onPress={logout} style={{ marginTop: 24 }} />
      </Screen>
      <TabBar
        tabs={[
          { id: 'certs', label: '🪪 Licence', badge: certs.length },
          { id: 'companies', label: '⛵ Tvrtke', badge: companies.length },
        ]}
        active={tab}
        onChange={setTab}
      />
    </View>
  );
}
