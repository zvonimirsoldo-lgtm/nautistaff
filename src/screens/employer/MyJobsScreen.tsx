import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { supabase } from '../../supabase';
import { Badge, Btn, Card, Empty, Screen, Title } from '../../components';
import { C } from '../../theme';
import { errorText, formatCountdown, formatDateTime, formatPay, one, parseTs, useNow } from '../../utils';

type Applicant = {
  id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  created_at: string;
  profiles: {
    full_name: string;
    worker_profiles: WP | WP[] | null;
  } | null;
};
type WP = { title: string; rating: number | null; verified: boolean; languages: string };

type Job = {
  id: string; title: string; location_name: string; start_at: string; pay_amount: number; pay_unit: string;
  spots: number; filled: number; status: 'active' | 'filled' | 'closed'; expires_at: string; is_vip: boolean;
  applications: Applicant[];
};

const JOB_STATUS = {
  active: { text: 'Aktivan', color: C.green },
  filled: { text: 'Popunjen', color: C.sky },
  closed: { text: 'Zatvoren', color: C.dim },
  expired: { text: 'Istekao', color: C.dim },
};

export default function MyJobsScreen(props: { companyId: string; companyName: string; refreshKey: number }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const now = useNow(1000);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('jobs')
      .select(`id, title, location_name, start_at, pay_amount, pay_unit, spots, filled, status, expires_at, is_vip,
               applications(id, status, created_at, profiles(full_name, worker_profiles(title, rating, verified, languages)))`)
      .eq('company_id', props.companyId)
      .order('created_at', { ascending: false });
    if (error) Alert.alert('Greška pri učitavanju', error.message);
    else setJobs((data ?? []) as unknown as Job[]);
    setLoading(false);
  }, [props.companyId]);

  useEffect(() => { load(); }, [load, props.refreshKey]);

  async function decide(appId: string, accept: boolean) {
    setBusy(appId);
    const { error } = await supabase.rpc('decide_application', { p_application_id: appId, p_accept: accept });
    setBusy(null);
    if (error) Alert.alert('Greška', errorText(error));
    load();
  }

  function close(job: Job) {
    Alert.alert('Zatvoriti oglas?', 'Oglas nestaje iz ponuda i više se nitko ne može prijaviti.', [
      { text: 'Odustani', style: 'cancel' },
      {
        text: 'Zatvori', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('jobs').update({ status: 'closed' }).eq('id', job.id);
          if (error) Alert.alert('Greška', errorText(error));
          load();
        },
      },
    ]);
  }

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <Title>Moji oglasi · {props.companyName}</Title>
      {loading ? <Empty text="Učitavanje…" />
        : jobs.length === 0 ? <Empty text="Nemate objavljenih oglasa. Objavite prvu ponudu na kartici „Objava”." />
        : jobs.map((job) => {
            const expired = job.status === 'active' && parseTs(job.expires_at) <= now;
            const st = expired ? JOB_STATUS.expired : JOB_STATUS[job.status];
            const active = job.status === 'active' && !expired;
            const apps = (job.applications ?? [])
              .filter((a) => a.status !== 'withdrawn')
              .sort((a, b) => parseTs(a.created_at) - parseTs(b.created_at));
            return (
              <Card key={job.id} style={job.is_vip ? { borderColor: C.amber, borderWidth: 2 } : {}}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: C.text, fontWeight: '900', flex: 1, marginRight: 8 }}>{job.title}</Text>
                  <Badge text={st.text} color={st.color} />
                </View>
                <Text style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>
                  📍 {job.location_name} · 📅 {formatDateTime(job.start_at)} · {formatPay(job.pay_amount, job.pay_unit)}
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                  <Text style={{ color: C.text, fontSize: 12 }}>Popunjeno: <Text style={{ fontWeight: '900' }}>{job.filled}/{job.spots}</Text></Text>
                  {active ? (
                    <Text style={{ color: C.amberLight, fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
                      ⏱ {formatCountdown(parseTs(job.expires_at) - now)}
                    </Text>
                  ) : null}
                </View>

                <View style={{ marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border }}>
                  <Text style={{ color: C.muted, fontSize: 11, fontWeight: '800', marginBottom: 6 }}>KANDIDATI ({apps.length})</Text>
                  {apps.length === 0
                    ? <Text style={{ color: C.dim, fontSize: 12 }}>{active ? 'Čekamo prve kandidate… stižu automatski.' : 'Nije bilo prijava.'}</Text>
                    : apps.map((a) => {
                        const wp = one(a.profiles?.worker_profiles);
                        return (
                          <View key={a.id} style={{
                            backgroundColor: C.bg, borderColor: C.border, borderWidth: 1, borderRadius: 12,
                            padding: 10, marginBottom: 6, opacity: a.status === 'rejected' ? 0.5 : 1,
                          }}>
                            <Text style={{ color: C.text, fontWeight: '800' }}>
                              {a.profiles?.full_name || 'Kandidat'} {wp?.verified ? <Text style={{ color: C.sky }}>✔</Text> : null}
                            </Text>
                            <Text style={{ color: C.muted, fontSize: 12 }}>
                              {wp?.title || 'Profil nije ispunjen'}{wp?.rating ? ` · ★ ${wp.rating}` : ''}{wp?.languages ? ` · ${wp.languages}` : ''}
                            </Text>
                            {a.status === 'pending' && active ? (
                              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8, gap: 8 }}>
                                <Btn title="Odbij" small variant="ghost" onPress={() => decide(a.id, false)} disabled={busy === a.id} />
                                <Btn title="✔ Prihvati" small variant="green" onPress={() => decide(a.id, true)} loading={busy === a.id} />
                              </View>
                            ) : (
                              <Text style={{
                                marginTop: 4, fontSize: 12, fontWeight: '800',
                                color: a.status === 'accepted' ? C.green : C.dim,
                              }}>
                                {a.status === 'accepted' ? 'Prihvaćen' : a.status === 'rejected' ? 'Odbijen' : 'Nije odgovoreno'}
                              </Text>
                            )}
                          </View>
                        );
                      })}
                </View>
                {active ? <Btn title="Zatvori oglas" small variant="ghost" onPress={() => close(job)} style={{ marginTop: 6, alignSelf: 'flex-end' }} /> : null}
              </Card>
            );
          })}
    </Screen>
  );
}
