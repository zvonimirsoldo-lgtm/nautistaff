import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { supabase } from '../../supabase';
import { TabBar, useToast } from '../../components';
import { getMyLocation, LatLng } from '../../location';
import FeedScreen from './FeedScreen';
import ApplicationsScreen from './ApplicationsScreen';
import LicencesScreen from './LicencesScreen';
import WorkerProfileScreen from './WorkerProfileScreen';

type Tab = 'feed' | 'apps' | 'licences' | 'profile';

export default function WorkerApp(props: { userId: string }) {
  const [tab, setTab] = useState<Tab>('feed');
  const [refreshKey, setRefreshKey] = useState(0);
  const [news, setNews] = useState(0);
  const [loc, setLoc] = useState<LatLng | null>(null);
  const [locAsked, setLocAsked] = useState(false);
  const toast = useToast();

  // LOKACIJA: spremamo zadnju poznatu lokaciju da obavijesti stižu za ponude u krugu 30 km
  const updateLocation = useCallback(async () => {
    // korisnik je u Profilu → Privatnost možda isključio korištenje lokacije
    const { data: w } = await supabase.from('worker_profiles').select('share_location').eq('user_id', props.userId).maybeSingle();
    if (w && w.share_location === false) {
      setLocAsked(true);
      setLoc(null);
      return;
    }
    const l = await getMyLocation();
    setLocAsked(true);
    setLoc(l);
    if (l) {
      await supabase.from('worker_profiles').update({ lat: l.lat, lng: l.lng }).eq('user_id', props.userId);
    }
  }, [props.userId]);

  useEffect(() => { updateLocation(); }, [updateLocation]);

  // REAL-TIME: kad poslodavac odgovori na moju prijavu, javi odmah (na bilo kojem ekranu)
  useEffect(() => {
    const channel = supabase
      .channel(`my-apps-${props.userId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'applications', filter: `worker_id=eq.${props.userId}` },
        (payload) => {
          const status = (payload.new as { status?: string }).status;
          if (status === 'accepted') {
            toast('🎉 Prihvaćeni ste! Kontakt poslodavca je pod „Prijave".');
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
        {tab === 'feed' && <FeedScreen userId={props.userId} loc={loc} locAsked={locAsked} onRequestLocation={updateLocation} />}
        {tab === 'apps' && <ApplicationsScreen userId={props.userId} refreshKey={refreshKey} />}
        {tab === 'licences' && <LicencesScreen userId={props.userId} />}
        {tab === 'profile' && <WorkerProfileScreen userId={props.userId} refreshKey={refreshKey} onLocationChanged={updateLocation} />}
      </View>
      <TabBar
        tabs={[
          { id: 'feed', label: '⚡ Ponude' },
          { id: 'apps', label: '📨 Prijave', badge: news },
          { id: 'licences', label: '🪪 Licence' },
          { id: 'profile', label: '👤 Profil' },
        ]}
        active={tab}
        onChange={(t) => { setTab(t); if (t === 'apps') setNews(0); }}
      />
    </View>
  );
}
