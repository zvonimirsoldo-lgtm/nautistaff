import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { supabase } from '../../supabase';
import { Chips, Empty, Screen, useToast } from '../../components';
import { C } from '../../theme';
import { CATEGORIES, errorText, parseTs, useNow } from '../../utils';
import JobCard, { FeedJob } from '../JobCard';

export default function FeedScreen(props: { userId: string }) {
  const [jobs, setJobs] = useState<FeedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cat, setCat] = useState('all');
  const [applying, setApplying] = useState<string | null>(null);
  const now = useNow(1000);
  const toast = useToast();

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('live_feed');
    if (error) toast('Greška pri učitavanju: ' + error.message);
    else setJobs((data ?? []) as FeedJob[]);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
    // REAL-TIME: svaka nova ili promijenjena ponuda odmah osvježava popis
    const channel = supabase
      .channel(`feed-${props.userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'jobs' }, (payload) => {
        const row = payload.new as { title?: string; location_name?: string };
        toast(`⚡ Nova hitna ponuda: ${row.title ?? ''}${row.location_name ? ` (${row.location_name})` : ''}`);
        load();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'jobs' }, () => load())
      .subscribe();
    const backup = setInterval(load, 60000); // rezerva ako veza na trenutak pukne
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
        options={[{ value: 'all', label: 'Sve' }, ...CATEGORIES.map((c) => ({ value: c.id, label: c.name }))]}
        value={cat}
        onChange={setCat}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Text style={{ color: C.text, fontWeight: '900', fontSize: 15 }}>🔴 Live ponude</Text>
        <Text style={{ color: C.sky, fontSize: 12, fontWeight: '700' }}>{visible.length} aktivnih</Text>
      </View>
      {loading ? <Empty text="Učitavanje…" />
        : visible.length === 0 ? <Empty text="Trenutno nema aktivnih ponuda. Nove stižu automatski." />
        : visible.map((j) => (
            <JobCard key={j.id} job={j} now={now} applying={applying === j.id} onApply={() => apply(j)} />
          ))}
    </Screen>
  );
}
