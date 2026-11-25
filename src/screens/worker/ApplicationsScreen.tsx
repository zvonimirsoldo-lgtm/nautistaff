import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { supabase } from '../../supabase';
import { Badge, Btn, Card, Chips, Empty, Screen, Title } from '../../components';
import { C } from '../../theme';
import { errorText, formatPay, formatRange, one, parseTs } from '../../utils';
import ContactBox from '../../contact';
import { WORKER_NOTICE } from '../../legal';

type Row = {
  id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'cancelled' | 'closed';
  created_at: string;
  jobs: {
    title: string; location_name: string; start_at: string; end_at: string; pay_amount: number; pay_unit: string;
    companies: { name: string } | { name: string }[] | null;
  } | null;
};

const STATUS = {
  pending: { text: 'Čeka odgovor', color: C.sky },
  accepted: { text: 'Prihvaćeno', color: C.green },
  rejected: { text: 'Nije odabrano', color: C.dim },
  withdrawn: { text: 'Povučeno', color: C.dim },
  cancelled: { text: 'Otkazano', color: C.dim },
  closed: { text: 'Oglas popunjen', color: C.dim },
};

export default function ApplicationsScreen(props: { userId: string; refreshKey: number }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<'current' | 'past'>('current');

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('applications')
      .select('id, status, created_at, jobs(title, location_name, start_at, end_at, pay_amount, pay_unit, companies(name))')
      .eq('worker_id', props.userId)
      .neq('status', 'withdrawn')
      .order('created_at', { ascending: false });
    if (!error) setRows((data ?? []) as unknown as Row[]);
    setLoading(false);
  }, [props.userId]);

  useEffect(() => { load(); }, [load, props.refreshKey]);

  async function withdraw(id: string) {
    const { error } = await supabase.rpc('withdraw_application', { p_application_id: id });
    if (error) Alert.alert('Greška', errorText(error));
    load();
  }

  // Aktualno = prijava još čeka (polazak nije prošao) ili posao na koji ste prihvaćeni još nije završio
  const nowTs = Date.now();
  const isCurrent = (r: Row) =>
    (r.status === 'pending' && !!r.jobs && parseTs(r.jobs.start_at) > nowTs)
    || (r.status === 'accepted' && !!r.jobs && parseTs(r.jobs.end_at) > nowTs);
  const current = rows.filter(isCurrent);
  const past = rows.filter((r) => !isCurrent(r));
  const shown = view === 'current' ? current : past;

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <Title>Moje prijave</Title>
      <Chips
        options={[
          { value: 'current', label: `Aktualne (${current.length})` },
          { value: 'past', label: `📁 Prošle (${past.length})` },
        ]}
        value={view}
        onChange={setView}
      />
      {loading ? <Empty text="Učitavanje…" />
        : shown.length === 0 ? <Empty text={view === 'current' ? 'Nemate aktualnih prijava ni poslova.' : 'Ovdje će biti prošli poslovi i zatvorene prijave.'} />
        : shown.map((r) => {
            const job = r.jobs;
            const company = one(job?.companies);
            const st = STATUS[r.status];
            return (
              <Card key={r.id} style={r.status === 'accepted' ? { borderColor: C.green } : {}}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: C.text, fontWeight: '800', flex: 1, marginRight: 8 }}>{job?.title ?? 'Oglas'}</Text>
                  <Badge text={st.text} color={st.color} />
                </View>
                <Text style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>
                  {company?.name} · {job?.location_name}
                </Text>
                {job ? <Text style={{ color: C.muted, fontSize: 12 }}>📅 {formatRange(job.start_at, job.end_at)} · {formatPay(job.pay_amount, job.pay_unit)}</Text> : null}
                {r.status === 'closed' && (
                  <Text style={{ color: C.dim, fontSize: 12, marginTop: 4 }}>
                    Poslodavac je popunio ili zatvorio oglas prije odluke o vašoj prijavi.
                  </Text>
                )}
                {r.status === 'pending' && job && parseTs(job.start_at) <= nowTs && (
                  <Text style={{ color: C.dim, fontSize: 12, marginTop: 4 }}>Polazak je prošao bez odgovora poslodavca.</Text>
                )}
                {r.status === 'cancelled' && (
                  <Text style={{ color: C.dim, fontSize: 12, marginTop: 4 }}>
                    Prijava je automatski otkazana jer ste u istom terminu prihvaćeni na drugom poslu.
                  </Text>
                )}
                {r.status === 'accepted' && (
                  <>
                    <Text style={{ color: C.green, fontSize: 12, marginTop: 6 }}>
                      🎉 Poslodavac vas je odabrao. Javite se za dogovor oko ukrcaja:
                    </Text>
                    <ContactBox applicationId={r.id} label="KONTAKT POSLODAVCA" />
                    <Text style={{ color: C.dim, fontSize: 11, marginTop: 6, lineHeight: 16 }}>⚖️ {WORKER_NOTICE}</Text>
                  </>
                )}
                {r.status === 'pending' && view === 'current' && (
                  <Btn title="Povuci prijavu" small variant="ghost" onPress={() => withdraw(r.id)} style={{ marginTop: 8, alignSelf: 'flex-end' }} />
                )}
              </Card>
            );
          })}
    </Screen>
  );
}
