import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { supabase } from '../../supabase';
import { Chips, Empty, Screen, useToast } from '../../components';
import { LatLng } from '../../location';
import { C } from '../../theme';
import { CATEGORIES, errorText, parseTs, useNow } from '../../utils';
import JobCard, { FeedJob } from '../JobCard';

const RADII = [
  { value: 0, label: 'Cijeli Jadran' },
  { value: 30, label: 'do 30 km' },
  { value: 60, label: 'do 60 km' },
  { value: 100, label: 'do 100 km' },
];

export default function FeedScreen(props: {
  userId: string; loc: LatLng | null; locAsked: boolean; onRequestLocation: () => void;
}) {
  const [jobs, setJobs] = useState<FeedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cat, setCat] = useState('all');
  const [radius, setRadius] = useState(0);
  const [applying, setApplying] = useState<string | null>(null);
  const now = useNow(1000);
  const toast = useToast();
  const { loc } = props;

  const load = useCallback(async (): Promise<FeedJob[]> => {
    const { data, error } = await supabase.rpc('live_feed', {
      p_lat: loc?.lat ?? null,
      p_lng: loc?.lng ?? null,
      p_radius_km: loc && radius > 0 ? radius : null,
    });
    setLoading(false);
    if (error) {
      toast('Greška pri učitavanju: ' + error.message);
      return [];
    }
    const list = (data ?? []) as FeedJob[];
    setJobs(list);
    return list;
  }, [toast, loc, radius]);

  useEffect(() => {
    load();
    // REAL-TIME: svaka nova ili promijenjena ponuda odmah osvježava popis
    const channel = supabase
      .channel(`feed-${props.userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'jobs' }, async (payload) => {
        const id = (payload.new as { id?: string }).id;
        const list = await load();
        // javimo samo za ponude koje su u mom krugu i ne preklapaju se s mojim zauzetim terminom
        const job = list.find((x) => x.id === id);
        if (job && !job.conflict) toast(`⚡ Nova ponuda: ${job.title} (${job.location_name})`);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'jobs' }, () => load())
      .subscribe();
    const backup = setInterval(load, 60000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(backup);
    };
  }, [load, props.userId, toast]);

  async function apply(job: FeedJob) {
    setApplying(job.id);
    const { error } = await supabase.rpc('apply_to_job', { p_job_id: job.id });
    setApplying(null);
    if (error) Alert.alert('Prijava nije uspjela', errorText(error));
    else toast(`✅ Prijava poslana: ${job.title}`);
    load();
  }

  const visible = jobs.filter((j) => parseTs(j.expires_at) > now && (cat === 'all' || j.category === cat));

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <Chips
        options={[{ value: 'all', label: 'Sva zanimanja' }, ...CATEGORIES.map((c) => ({ value: c.id, label: c.name }))]}
        value={cat}
        onChange={setCat}
      />
      {loc ? (
        <Chips options={RADII} value={radius} onChange={setRadius} />
      ) : props.locAsked ? (
        <Pressable onPress={props.onRequestLocation} style={{ marginBottom: 10 }}>
          <Text style={{ color: C.amberLight, fontSize: 12 }}>
            📍 Lokacija nije uključena, pa ne možemo filtrirati po udaljenosti. Dodirnite za ponovni pokušaj.
          </Text>
        </Pressable>
      ) : null}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Text style={{ color: C.text, fontWeight: '900', fontSize: 15 }}>🔴 Live ponude</Text>
        <Text style={{ color: C.sky, fontSize: 12, fontWeight: '700' }}>{visible.length} aktivnih</Text>
      </View>
      {loading ? <Empty text="Učitavanje…" />
        : visible.length === 0 ? <Empty text={radius > 0 ? `Nema ponuda u krugu ${radius} km. Probajte veći krug.` : 'Trenutno nema aktivnih ponuda. Nove stižu automatski.'} />
        : visible.map((j) => (
            <JobCard key={j.id} job={j} now={now} applying={applying === j.id} onApply={() => apply(j)} />
          ))}
    </Screen>
  );
}
