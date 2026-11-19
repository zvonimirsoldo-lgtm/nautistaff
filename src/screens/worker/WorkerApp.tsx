import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { supabase } from '../../supabase';
import { TabBar, useToast } from '../../components';
import FeedScreen from './FeedScreen';
import ApplicationsScreen from './ApplicationsScreen';
import WorkerProfileScreen from './WorkerProfileScreen';

type Tab = 'feed' | 'apps' | 'profile';

export default function WorkerApp(props: { userId: string }) {
  const [tab, setTab] = useState<Tab>('feed');
  const [refreshKey, setRefreshKey] = useState(0);
  const [news, setNews] = useState(0);
  const toast = useToast();

  // REAL-TIME: kad poslodavac odgovori na moju prijavu, javi odmah (na bilo kojem ekranu)
  useEffect(() => {
    const channel = supabase
      .channel(`my-apps-${props.userId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'applications', filter: `worker_id=eq.${props.userId}` },
        (payload) => {
          const status = (payload.new as { status?: string }).status;
          if (status === 'accepted') {
            toast('🎉 Prihvaćeni ste! Poslodavac vas je odabrao za posao.');
            setNews((n) => n + 1);
          } else if (status === 'rejected') {
            toast('Poslodavac je odabrao drugog kandidata.');
          }
          setRefreshKey((k) => k + 1);
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [props.userId, toast]);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        {tab === 'feed' && <FeedScreen userId={props.userId} />}
        {tab === 'apps' && <ApplicationsScreen userId={props.userId} refreshKey={refreshKey} />}
        {tab === 'profile' && <WorkerProfileScreen userId={props.userId} />}
      </View>
      <TabBar
        tabs={[
          { id: 'feed', label: '⚡ Ponude' },
          { id: 'apps', label: '📨 Prijave', badge: news },
          { id: 'profile', label: '👤 Profil' },
        ]}
        active={tab}
        onChange={(t) => { setTab(t); if (t === 'apps') setNews(0); }}
      />
    </View>
  );
}
