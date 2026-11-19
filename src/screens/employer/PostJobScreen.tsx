import React, { useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { supabase } from '../../supabase';
import { Btn, Chips, Field, Screen, Title } from '../../components';
import { C } from '../../theme';
import { CATEGORIES, errorText } from '../../utils';

const DAY_NAMES = ['Ned', 'Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub'];

function dayOptions() {
  const out: { value: number; label: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const label = i === 0 ? 'Danas' : i === 1 ? 'Sutra' : `${DAY_NAMES[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.`;
    out.push({ value: i, label });
  }
  return out;
}

const DEADLINES = [
  { value: 30, label: '30 min' },
  { value: 60, label: '1 sat' },
  { value: 120, label: '2 sata' },
  { value: 360, label: '6 sati' },
  { value: 1440, label: '24 sata' },
  { value: 4320, label: '3 dana' },
];

export default function PostJobScreen(props: { companyId: string; onPosted: () => void }) {
  const [category, setCategory] = useState('skipper');
  const [title, setTitle] = useState('');
  const [vessel, setVessel] = useState('Katamaran');
  const [location, setLocation] = useState('');
  const [day, setDay] = useState(1);
  const [time, setTime] = useState('17:00');
  const [duration, setDuration] = useState('7 dana');
  const [spots, setSpots] = useState('1');
  const [pay, setPay] = useState('');
  const [payUnit, setPayUnit] = useState('day');
  const [licence, setLicence] = useState('');
  const [tips, setTips] = useState(true);
  const [isLive, setIsLive] = useState(true);
  const [deadline, setDeadline] = useState(120);
  const [busy, setBusy] = useState(false);

  async function post() {
    const m = time.trim().match(/^(\d{1,2})[:.](\d{2})$/);
    if (title.trim().length < 3) return Alert.alert('Upišite naslov oglasa (barem 3 znaka).');
    if (!location.trim()) return Alert.alert('Upišite marinu ili lokaciju.');
    if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return Alert.alert('Vrijeme polaska upišite kao npr. 17:00');
    const payNum = Number(pay.replace(',', '.'));
    if (!(payNum > 0)) return Alert.alert('Upišite plaću kao broj, npr. 180');
    const spotsNum = Math.max(1, Math.min(50, parseInt(spots, 10) || 1));

    const start = new Date();
    start.setDate(start.getDate() + day);
    start.setHours(Number(m[1]), Number(m[2]), 0, 0);
    if (start.getTime() < Date.now()) return Alert.alert('Polazak je u prošlosti. Odaberite kasnije vrijeme.');
    const expires = new Date(Date.now() + deadline * 60 * 1000);

    setBusy(true);
    const { error } = await supabase.from('jobs').insert({
      company_id: props.companyId,
      category,
      title: title.trim(),
      vessel: vessel.trim(),
      location_name: location.trim(),
      start_at: start.toISOString(),
      duration: duration.trim(),
      licence: licence.trim(),
      spots: spotsNum,
      pay_amount: payNum,
      pay_unit: payUnit,
      tips,
      is_live: isLive,
      expires_at: expires.toISOString(),
    });
    setBusy(false);
    if (error) return Alert.alert('Objava nije uspjela', errorText(error));
    setTitle('');
    setPay('');
    props.onPosted();
  }

  return (
    <Screen>
      <Title>Nova ponuda</Title>
      <Chips label="Zanimanje" options={CATEGORIES.map((c) => ({ value: c.id, label: c.name }))} value={category} onChange={setCategory} />
      <Field label="Naslov oglasa" value={title} onChangeText={setTitle} maxLength={80} placeholder="npr. Skiper za tjedni čarter, hitno" />
      <Chips
        label="Plovilo"
        options={['Katamaran', 'Jedrilica', 'Motorna jahta', 'Mini cruiser', 'Gulet'].map((v) => ({ value: v, label: v }))}
        value={vessel}
        onChange={setVessel}
      />
      <Field label="Marina / lokacija" value={location} onChangeText={setLocation} placeholder="npr. ACI Marina Split" />
      <Chips label="Dan polaska" options={dayOptions()} value={day} onChange={setDay} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Field label="Sat polaska" value={time} onChangeText={setTime} placeholder="17:00" /></View>
        <View style={{ flex: 1 }}><Field label="Trajanje" value={duration} onChangeText={setDuration} placeholder="7 dana" /></View>
        <View style={{ flex: 1 }}><Field label="Broj osoba" value={spots} onChangeText={setSpots} keyboardType="number-pad" /></View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Field label="Plaća (€)" value={pay} onChangeText={setPay} keyboardType="decimal-pad" placeholder="180" /></View>
        <View style={{ flex: 1.4 }}>
          <Chips label="Po" options={[{ value: 'day', label: 'danu' }, { value: 'week', label: 'tjednu' }, { value: 'month', label: 'mjesecu' }]} value={payUnit} onChange={setPayUnit} />
        </View>
      </View>
      <Field label="Tražene licence / uvjeti (neobavezno)" value={licence} onChangeText={setLicence} placeholder="npr. voditelj brodice, engleski B2" />
      <Chips label="Rok za prijave (odbrojavanje)" options={DEADLINES} value={deadline} onChange={setDeadline} />

      <Toggle label="Uz plaću idu napojnice" value={tips} onChange={setTips} />
      <Toggle label="⚡ Hitna ponuda (LIVE oznaka)" value={isLive} onChange={setIsLive} />

      <Btn title="OBJAVI PONUDU 🚀" onPress={post} loading={busy} style={{ marginTop: 10 }} />
      <Text style={{ color: C.dim, fontSize: 11, marginTop: 8 }}>
        Ponuda se odmah pojavljuje svoj posadi koja ima otvorenu aplikaciju. Push obavijesti dolaze u sljedećoj verziji.
      </Text>
    </Screen>
  );
}

function Toggle(props: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
      <Text style={{ color: C.text, fontSize: 13 }}>{props.label}</Text>
      <Switch value={props.value} onValueChange={props.onChange} trackColor={{ true: C.skyDark, false: C.border }} />
    </View>
  );
}
