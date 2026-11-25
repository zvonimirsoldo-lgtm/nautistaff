import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { supabase } from '../../supabase';
import { Btn, Chips, Field, Screen, Title, Toggle } from '../../components';
import { getMyLocation } from '../../location';
import { PLACES } from '../../places';
import { C } from '../../theme';
import { CATEGORIES, daysLabel, errorText, formatRange, parseTs } from '../../utils';
import { EMPLOYER_NOTICE } from '../../legal';
import DatePickerModal from '../../datePicker';

const DAY_NAMES = ['ned', 'pon', 'uto', 'sri', 'čet', 'pet', 'sub'];
const MAX_MONTHS_AHEAD = 6;

// npr. "sub 14.3.2027."
function dateLabel(d: Date) {
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}.`;
}

// rok za prijave u minutama; 0 = do polaska
const DEADLINES = [
  { value: 30, label: '30 min' },
  { value: 60, label: '1 sat' },
  { value: 120, label: '2 sata' },
  { value: 360, label: '6 sati' },
  { value: 1440, label: '24 sata' },
  { value: 4320, label: '3 dana' },
  { value: 10080, label: '7 dana' },
  { value: 20160, label: '14 dana' },
  { value: 43200, label: '30 dana' },
  { value: 0, label: 'Do polaska' },
];

// Podaci starog oglasa za "Objavi ponovno"
export type RepostData = {
  category: string; title: string; vessel: string; location_name: string;
  lat: number | null; lng: number | null; start_at: string; end_at: string;
  spots: number; pay_amount: number; pay_unit: string; licence: string; tips: boolean; is_live: boolean;
};

const VESSELS = ['Katamaran', 'Jedrilica', 'Motorna jahta', 'Mini cruiser', 'Gulet'];

// Iz starog oglasa izvuci mjesto s popisa (ili GPS) i detalj (marina / vez)
function placeFrom(r: RepostData): { place: string; gps: { lat: number; lng: number } | null; detail: string } {
  if (r.lat != null && r.lng != null) {
    const p = PLACES.find((x) => Math.abs(x.lat - r.lat!) < 0.001 && Math.abs(x.lng - r.lng!) < 0.001);
    if (p) {
      const suffix = `, ${p.name}`;
      const detail = r.location_name === p.name ? ''
        : r.location_name.endsWith(suffix) ? r.location_name.slice(0, -suffix.length) : r.location_name;
      return { place: p.name, gps: null, detail };
    }
    return { place: 'gps', gps: { lat: r.lat, lng: r.lng }, detail: r.location_name };
  }
  return { place: 'Split', gps: null, detail: r.location_name };
}

export default function PostJobScreen(props: { companyId: string; onPosted: () => void; prefill?: RepostData | null }) {
  const pre = props.prefill ?? null;
  const prePlace = pre ? placeFrom(pre) : null;
  const preStart = pre ? new Date(parseTs(pre.start_at)) : null;
  const preDays = pre ? Math.max(1, Math.round((parseTs(pre.end_at) - parseTs(pre.start_at)) / 86400000)) : 7;
  const pad = (n: number) => String(n).padStart(2, '0');

  const [category, setCategory] = useState(pre?.category ?? 'skipper');
  const [title, setTitle] = useState(pre?.title ?? '');
  const [vessel, setVessel] = useState(pre?.vessel || 'Katamaran');
  const [place, setPlace] = useState(prePlace?.place ?? 'Split');   // ime mjesta iz popisa ili 'gps'
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(prePlace?.gps ?? null);
  const [location, setLocation] = useState(prePlace?.detail ?? '');   // detalj: marina / vez
  // DAN POLASKA: danas, sutra ili datum iz kalendara (do 6 mjeseci unaprijed)
  const [dayMode, setDayMode] = useState<'today' | 'tomorrow' | 'pick'>('tomorrow');
  const [picked, setPicked] = useState<Date | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const today0 = new Date(); today0.setHours(0, 0, 0, 0);
  const maxDate = new Date(today0); maxDate.setMonth(maxDate.getMonth() + MAX_MONTHS_AHEAD);
  const startDay = (): Date | null => {
    if (dayMode === 'pick') return picked;
    const d = new Date(today0);
    if (dayMode === 'tomorrow') d.setDate(d.getDate() + 1);
    return d;
  };
  const [time, setTime] = useState(preStart ? `${pad(preStart.getHours())}:${pad(preStart.getMinutes())}` : '17:00');
  const [days, setDays] = useState(String(preDays));   // trajanje u danima (za kalendar i provjeru preklapanja)
  const [spots, setSpots] = useState(String(pre?.spots ?? 1));
  const [pay, setPay] = useState(pre ? String(Math.round(Number(pre.pay_amount))) : '');
  const [payUnit, setPayUnit] = useState(pre?.pay_unit ?? 'day');
  const [licence, setLicence] = useState(pre?.licence ?? '');
  const [tips, setTips] = useState(pre?.tips ?? true);
  const [isLive, setIsLive] = useState(pre?.is_live ?? true);
  const [deadline, setDeadline] = useState(120);
  const [busy, setBusy] = useState(false);

  async function post() {
    const m = time.trim().match(/^(\d{1,2})[:.](\d{2})$/);
    if (title.trim().length < 3) return Alert.alert('Upišite naslov oglasa (barem 3 znaka).');
    if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return Alert.alert('Vrijeme polaska upišite kao npr. 17:00');
    const payNum = Number(pay.replace(',', '.'));
    if (!(payNum > 0)) return Alert.alert('Upišite plaću kao broj, npr. 180');
    const spotsNum = Math.max(1, Math.min(50, parseInt(spots, 10) || 1));

    const sd = startDay();
    if (!sd) return Alert.alert('Odaberite datum polaska u kalendaru.');
    const start = new Date(sd);
    start.setHours(Number(m[1]), Number(m[2]), 0, 0);
    const daysNum = parseInt(days, 10);
    if (!(daysNum >= 1 && daysNum <= 365)) return Alert.alert('Trajanje upišite kao broj dana (1–365).');
    const end = new Date(start);
    end.setDate(end.getDate() + daysNum);
    if (start.getTime() < Date.now()) return Alert.alert('Polazak je u prošlosti. Odaberite kasnije vrijeme.');
    // "Do polaska" = prijave otvorene sve do trenutka polaska (baza ionako skraćuje rok do polaska)
    const expires = deadline === 0 ? new Date(start) : new Date(Date.now() + deadline * 60 * 1000);

    const p = PLACES.find((x) => x.name === place);
    const coords = place === 'gps' ? gps : p ? { lat: p.lat, lng: p.lng } : null;
    if (place === 'gps' && !gps) return Alert.alert('Lokacija nije dostupna. Odaberite mjesto s popisa.');
    const placeName = place === 'gps' ? (location.trim() || 'Moja lokacija') : [location.trim(), place].filter(Boolean).join(', ');

    setBusy(true);
    const { error } = await supabase.from('jobs').insert({
      company_id: props.companyId,
      category,
      title: title.trim(),
      vessel: vessel.trim(),
      location_name: placeName,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      duration: daysLabel(daysNum),
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
      <Title>{pre ? '🔁 Ponovna objava' : 'Nova ponuda'}</Title>
      {pre ? (
        <Text style={{ color: C.sky, fontSize: 12, marginBottom: 12 }}>
          Podaci su preuzeti iz oglasa „{pre.title}". Odaberite novi dan polaska i provjerite ostalo.
        </Text>
      ) : null}
      <Chips label="Zanimanje" options={CATEGORIES.map((c) => ({ value: c.id, label: c.name }))} value={category} onChange={setCategory} />
      <Field label="Naslov oglasa" value={title} onChangeText={setTitle} maxLength={80} placeholder="npr. Skiper za tjedni čarter, hitno" />
      <Chips
        label="Plovilo"
        options={(VESSELS.includes(vessel) ? VESSELS : [vessel, ...VESSELS]).map((v) => ({ value: v, label: v }))}
        value={vessel}
        onChange={setVessel}
      />
      <Chips
        label="Mjesto (za obavijesti posadi u krugu 30 km)"
        options={[{ value: 'gps', label: '📍 Moja lokacija' }, ...PLACES.map((x) => ({ value: x.name, label: x.name }))]}
        value={place}
        onChange={async (v) => {
          setPlace(v);
          if (v === 'gps' && !gps) {
            const l = await getMyLocation();
            if (l) setGps(l);
            else Alert.alert('Lokacija nije dopuštena', 'Odaberite mjesto s popisa.');
          }
        }}
      />
      <Field label="Marina / vez (neobavezno)" value={location} onChangeText={setLocation} placeholder="npr. ACI Marina, vez B12" />
      <Chips
        label="Dan polaska"
        options={[
          { value: 'today', label: 'Danas' },
          { value: 'tomorrow', label: 'Sutra' },
          { value: 'pick', label: dayMode === 'pick' && picked ? `📅 ${dateLabel(picked)}` : '📅 Odaberi datum' },
        ]}
        value={dayMode}
        onChange={(v) => {
          if (v === 'pick') setPickerOpen(true);
          else setDayMode(v);
        }}
      />
      <DatePickerModal
        visible={pickerOpen}
        value={picked}
        min={today0}
        max={maxDate}
        title="Datum polaska (do 6 mjeseci unaprijed)"
        onPick={(d) => { setPicked(d); setDayMode('pick'); }}
        onClose={() => setPickerOpen(false)}
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Field label="Sat polaska" value={time} onChangeText={setTime} placeholder="17:00" /></View>
        <View style={{ flex: 1 }}><Field label="Trajanje (dana)" value={days} onChangeText={setDays} keyboardType="number-pad" maxLength={3} placeholder="7" /></View>
        <View style={{ flex: 1 }}><Field label="Broj osoba" value={spots} onChangeText={setSpots} keyboardType="number-pad" /></View>
      </View>
      <PeriodPreview start={startDay()} time={time} days={days} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Field label="Plaća (€)" value={pay} onChangeText={setPay} keyboardType="decimal-pad" placeholder="180" /></View>
        <View style={{ flex: 1.4 }}>
          <Chips label="Po" options={[{ value: 'day', label: 'danu' }, { value: 'week', label: 'tjednu' }, { value: 'month', label: 'mjesecu' }]} value={payUnit} onChange={setPayUnit} />
        </View>
      </View>
      <Field label="Tražene licence / uvjeti (neobavezno)" value={licence} onChangeText={setLicence} placeholder="npr. voditelj brodice, engleski B2" />
      <Chips label="Rok za prijave (odbrojavanje)" options={DEADLINES} value={deadline} onChange={setDeadline} />
      <Text style={{ color: C.dim, fontSize: 11, marginTop: -6, marginBottom: 10 }}>
        Rok za prijave nikad nije kasniji od polaska. Kandidata možete prihvatiti i nakon roka, sve do polaska.
      </Text>

      <Toggle label="Uz plaću idu napojnice" value={tips} onChange={setTips} />
      <Toggle label="⚡ Hitna ponuda (LIVE oznaka)" value={isLive} onChange={setIsLive} />

      <View style={{ marginTop: 10, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.card }}>
        <Text style={{ color: C.muted, fontSize: 11, lineHeight: 16 }}>⚖️ {EMPLOYER_NOTICE}</Text>
      </View>
      <Btn title="OBJAVI PONUDU 🚀" onPress={post} loading={busy} style={{ marginTop: 10 }} />
      <Text style={{ color: C.dim, fontSize: 11, marginTop: 8 }}>
        Ponuda se odmah pojavljuje u aplikaciji, a posada u krugu 30 km koja radi to zanimanje dobiva push obavijest.
      </Text>
    </Screen>
  );
}

// Prikaz razdoblja posla dok poslodavac ispunjava obrazac, npr. "sub 29.11. 17:00 → sub 6.12. 17:00"
function PeriodPreview(props: { start: Date | null; time: string; days: string }) {
  const m = props.time.trim().match(/^(\d{1,2})[:.](\d{2})$/);
  const n = parseInt(props.days, 10);
  if (!props.start || !m || !(n >= 1 && n <= 365)) return null;
  const start = new Date(props.start);
  start.setHours(Number(m[1]), Number(m[2]), 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + n);
  return (
    <Text style={{ color: C.sky, fontSize: 12, marginTop: -4, marginBottom: 10 }}>
      📅 Razdoblje posla: {formatRange(start.toISOString(), end.toISOString())}
    </Text>
  );
}
