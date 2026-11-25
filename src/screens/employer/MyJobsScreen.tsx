import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { supabase } from '../../supabase';
import { Badge, Btn, Card, Chips, Empty, Screen, Title, VerifiedBadge } from '../../components';
import ContactBox from '../../contact';
import { openStored } from '../../files';
import { C } from '../../theme';
import { errorText, formatCountdown, formatPay, formatRange, one, parseTs, useNow } from '../../utils';
import type { RepostData } from './PostJobScreen';
import ReportModal, { ReportTarget } from '../../report';
import { VERIFIED_NOTICE } from '../../legal';

type Applicant = {
  id: string;
  worker_id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'cancelled' | 'closed';
  created_at: string;
  profiles: {
    full_name: string;
    worker_profiles: WP | WP[] | null;
  } | null;
};
type WP = { title: string; rating: number | null; verified: boolean; languages: string; experience_years: number | null; cv_path: string | null };

type Job = RepostData & {
  id: string;
  status: 'active' | 'filled' | 'closed';
  filled: number;
  expires_at: string;
  is_vip: boolean;
  applications: Applicant[];
};

// Faza oglasa u njegovom životnom ciklusu
type Phase = 'active' | 'deciding' | 'filled' | 'closed' | 'expired';

function phaseOf(job: Job, now: number): Phase {
  if (job.status === 'filled') return 'filled';
  if (job.status === 'closed') return 'closed';
  if (parseTs(job.start_at) <= now) return 'expired';          // polazak prošao, nije popunjen
  if (parseTs(job.expires_at) <= now) return 'deciding';       // rok za prijave prošao, još se bira
  return 'active';
}

const PHASE = {
  active: { text: '🟢 Aktivan', color: C.green },
  deciding: { text: '⏳ Odaberite kandidata', color: C.amberLight },
  filled: { text: '✔ Popunjen', color: C.sky },
  closed: { text: 'Otkazan', color: C.dim },
  expired: { text: '⏱ Istekao', color: C.dim },
};

const APP_STATUS: Record<string, string> = {
  accepted: 'Prihvaćen',
  rejected: 'Odbijen',
  cancelled: 'U međuvremenu prihvatio drugi posao u tom terminu',
  closed: 'Oglas zatvoren prije odluke',
  pending: 'Nije odgovoreno',
};

export default function MyJobsScreen(props: {
  companyId: string; companyName: string; refreshKey: number; onRepost: (job: RepostData) => void;
}) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [view, setView] = useState<'current' | 'archive'>('current');
  const [report, setReport] = useState<ReportTarget>(null);
  const now = useNow(1000);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('jobs')
      .select(`id, title, category, vessel, location_name, lat, lng, start_at, end_at, duration, licence, tips, is_live,
               pay_amount, pay_unit, spots, filled, status, expires_at, is_vip,
               applications(id, worker_id, status, created_at, profiles(full_name, worker_profiles(title, rating, verified, languages, experience_years, cv_path)))`)
      .eq('company_id', props.companyId)
      .order('start_at', { ascending: true });
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

  async function setStatus(job: Job, status: 'filled' | 'closed') {
    const { error } = await supabase.from('jobs').update({ status }).eq('id', job.id);
    if (error) Alert.alert('Greška', errorText(error));
    load();
  }

  function finish(job: Job) {
    Alert.alert(
      'Završiti oglas?',
      'Oglas se miče iz ponuda, a kandidati koji još čekaju dobivaju obavijest da je zatvoren.',
      [
        { text: 'Odustani', style: 'cancel' },
        { text: 'Otkaži oglas', style: 'destructive', onPress: () => setStatus(job, 'closed') },
        { text: '✔ Popunjeno', onPress: () => setStatus(job, 'filled') },
      ],
    );
  }

  // Aktualno = još se bira posada ili je posao popunjen i još traje; sve ostalo ide u arhivu
  const withPhase = jobs.map((j) => ({ job: j, phase: phaseOf(j, now) }));
  const isCurrent = (x: { job: Job; phase: Phase }) =>
    x.phase === 'active' || x.phase === 'deciding' || (x.phase === 'filled' && parseTs(x.job.end_at) > now);
  const current = withPhase.filter(isCurrent);
  const archive = withPhase.filter((x) => !isCurrent(x)).reverse(); // najnoviji prvi
  const list = view === 'current' ? current : archive;

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <Title>Moji oglasi · {props.companyName}</Title>
      <Chips
        options={[
          { value: 'current', label: `Aktualni (${current.length})` },
          { value: 'archive', label: `📁 Arhiva (${archive.length})` },
        ]}
        value={view}
        onChange={setView}
      />

      {loading ? <Empty text="Učitavanje…" />
        : list.length === 0 ? (
          <Empty text={view === 'current'
            ? 'Nemate aktualnih oglasa. Objavite ponudu na kartici „Objava" ili ponovno objavite oglas iz arhive.'
            : 'Arhiva je prazna. Ovdje dolaze popunjeni, otkazani i istekli oglasi.'} />
        )
        : list.map(({ job, phase }) => {
            const ph = PHASE[phase];
            const open = phase === 'active' || phase === 'deciding';
            const apps = (job.applications ?? [])
              .filter((a) => a.status !== 'withdrawn')
              .filter((a) => view === 'current' || a.status === 'accepted') // u arhivi samo angažirana posada
              .sort((a, b) => parseTs(a.created_at) - parseTs(b.created_at));
            const total = (job.applications ?? []).filter((a) => a.status !== 'withdrawn').length;

            return (
              <Card key={job.id} style={[job.is_vip && open ? { borderColor: C.amber, borderWidth: 2 } : {}, !open && view === 'archive' ? { opacity: 0.9 } : {}]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: C.text, fontWeight: '900', flex: 1, marginRight: 8 }}>{job.title}</Text>
                  <Badge text={ph.text} color={ph.color} />
                </View>
                <Text style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>
                  📍 {job.location_name} · 📅 {formatRange(job.start_at, job.end_at)}
                </Text>
                <Text style={{ color: C.muted, fontSize: 12 }}>{formatPay(job.pay_amount, job.pay_unit)}</Text>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                  <Text style={{ color: C.text, fontSize: 12 }}>
                    Angažirano: <Text style={{ fontWeight: '900' }}>{job.filled}/{job.spots}</Text>
                    {view === 'archive' ? <Text style={{ color: C.dim }}> · prijava: {total}</Text> : null}
                  </Text>
                  {phase === 'active' ? (
                    <Text style={{ color: C.amberLight, fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
                      ⏱ {formatCountdown(parseTs(job.expires_at) - now)}
                    </Text>
                  ) : null}
                </View>
                {phase === 'deciding' ? (
                  <Text style={{ color: C.amberLight, fontSize: 12, marginTop: 4 }}>
                    Rok za prijave je istekao. Kandidata možete prihvatiti sve do polaska.
                  </Text>
                ) : null}

                {apps.length > 0 || view === 'current' ? (
                  <View style={{ marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border }}>
                    <Text style={{ color: C.muted, fontSize: 11, fontWeight: '800', marginBottom: 6 }}>
                      {view === 'current' ? `KANDIDATI (${apps.length})` : 'ANGAŽIRANA POSADA'}
                    </Text>
                    {apps.some((a) => one(a.profiles?.worker_profiles)?.verified) ? (
                      <Text style={{ color: C.dim, fontSize: 11, marginBottom: 6 }}>{VERIFIED_NOTICE}</Text>
                    ) : null}
                    {apps.length === 0
                      ? <Text style={{ color: C.dim, fontSize: 12 }}>{open ? 'Čekamo prve kandidate… stižu automatski.' : 'Nije bilo prijava.'}</Text>
                      : apps.map((a) => {
                          const wp = one(a.profiles?.worker_profiles);
                          const dim = a.status === 'rejected' || a.status === 'cancelled' || a.status === 'closed';
                          return (
                            <View key={a.id} style={{
                              backgroundColor: C.bg, borderColor: C.border, borderWidth: 1, borderRadius: 12,
                              padding: 10, marginBottom: 6, opacity: dim ? 0.5 : 1,
                            }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                                <Text style={{ color: C.text, fontWeight: '800' }}>{a.profiles?.full_name || 'Kandidat'}</Text>
                                {wp?.verified ? <VerifiedBadge small /> : null}
                              </View>
                              <Text style={{ color: C.muted, fontSize: 12 }}>
                                {wp?.title || 'Profil nije ispunjen'}
                                {wp?.experience_years != null ? ` · ${wp.experience_years} god. iskustva` : ''}
                                {wp?.rating ? ` · ★ ${wp.rating}` : ''}
                              </Text>
                              {wp?.languages ? <Text style={{ color: C.dim, fontSize: 12 }}>🗣 {wp.languages}</Text> : null}
                              {wp?.cv_path && !dim ? (
                                <Btn
                                  title="📄 Otvori CV" small variant="ghost" style={{ alignSelf: 'flex-start', marginTop: 6 }}
                                  onPress={() => openStored('cv', wp.cv_path as string).catch((e) => Alert.alert('CV nije dostupan', errorText(e)))}
                                />
                              ) : null}
                              {a.status === 'pending' && open ? (
                                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8, gap: 8 }}>
                                  <Btn title="Odbij" small variant="ghost" onPress={() => decide(a.id, false)} disabled={busy === a.id} />
                                  <Btn title="✔ Prihvati" small variant="green" onPress={() => decide(a.id, true)} loading={busy === a.id} />
                                </View>
                              ) : (
                                <Text style={{ marginTop: 4, fontSize: 12, fontWeight: '800', color: a.status === 'accepted' ? C.green : C.dim }}>
                                  {APP_STATUS[a.status] ?? a.status}
                                </Text>
                              )}
                              {a.status === 'accepted' ? <ContactBox applicationId={a.id} label="KONTAKT KANDIDATA" /> : null}
                              <Text
                                onPress={() => setReport({ userId: a.worker_id, label: `Kandidat: ${a.profiles?.full_name ?? ''}` })}
                                style={{ color: C.dim, fontSize: 11, marginTop: 6, alignSelf: 'flex-end' }}
                              >⚑ Prijavi korisnika</Text>
                            </View>
                          );
                        })}
                  </View>
                ) : null}

                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                  {open ? <Btn title="Završi oglas" small variant="ghost" onPress={() => finish(job)} /> : null}
                  {!open ? <Btn title="🔁 Objavi ponovno" small onPress={() => props.onRepost(job)} /> : null}
                </View>
              </Card>
            );
          })}
      <ReportModal target={report} onClose={() => setReport(null)} />
    </Screen>
  );
}
