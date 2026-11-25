import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { supabase } from '../../supabase';
import { Btn, useToast } from '../../components';
import { C } from '../../theme';
import { errorText, formatRange, one, parseTs } from '../../utils';

const MONTHS = ['Siječanj', 'Veljača', 'Ožujak', 'Travanj', 'Svibanj', 'Lipanj', 'Srpanj', 'Kolovoz', 'Rujan', 'Listopad', 'Studeni', 'Prosinac'];
const WEEKDAYS = ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned'];

type Booking = {
  id: string;
  status: 'accepted' | 'pending';
  title: string;
  company: string;
  startIso: string;
  endIso: string;
  start: number;
  end: number;
};

type Row = {
  id: string;
  status: 'accepted' | 'pending';
  jobs: { title: string; start_at: string; end_at: string; companies: { name: string } | { name: string }[] | null } | null;
};

const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

// Kalendar posade: zauzeti dani (prihvaćeni poslovi), prijave na čekanju i dani koje radnik sam blokira
export default function CalendarSection(props: { userId: string; refreshKey?: number }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    const [apps, unav] = await Promise.all([
      supabase
        .from('applications')
        .select('id, status, jobs(title, start_at, end_at, companies(name))')
        .eq('worker_id', props.userId)
        .in('status', ['accepted', 'pending']),
      supabase.from('worker_unavailability').select('day').eq('user_id', props.userId),
    ]);
    const rows = (apps.data ?? []) as unknown as Row[];
    setBookings(
      rows
        .filter((r) => r.jobs && r.jobs.end_at)
        .map((r) => ({
          id: r.id,
          status: r.status,
          title: r.jobs!.title,
          company: one(r.jobs!.companies)?.name ?? '',
          startIso: r.jobs!.start_at,
          endIso: r.jobs!.end_at,
          start: parseTs(r.jobs!.start_at),
          end: parseTs(r.jobs!.end_at),
        })),
    );
    setBlocked(new Set(((unav.data ?? []) as { day: string }[]).map((u) => u.day)));
  }, [props.userId]);

  useEffect(() => { load(); }, [load, props.refreshKey]);

  // poslovi koji padaju na zadani dan (preklapanje s cijelim danom)
  const onDay = useCallback((y: number, m: number, d: number, status: 'accepted' | 'pending') => {
    const s = new Date(y, m, d).getTime();
    const e = new Date(y, m, d + 1).getTime();
    return bookings.filter((b) => b.status === status && b.start < e && s < b.end);
  }, [bookings]);

  async function toggleBlocked(key: string) {
    const isBlocked = blocked.has(key);
    const next = new Set(blocked);
    if (isBlocked) next.delete(key); else next.add(key);
    setBlocked(next); // odmah prikažemo, pa spremimo
    const res = isBlocked
      ? await supabase.from('worker_unavailability').delete().eq('user_id', props.userId).eq('day', key)
      : await supabase.from('worker_unavailability').insert({ user_id: props.userId, day: key });
    if (res.error) {
      Alert.alert('Greška', errorText(res.error));
      load();
    } else {
      toast(isBlocked ? '✅ Dan je ponovno slobodan' : '🚫 Dan označen kao nedostupan. Za njega nećete dobivati ponude.');
    }
  }

  function changeMonth(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    setSelected(null);
  }

  const cells = useMemo(() => {
    const first = (new Date(year, month, 1).getDay() + 6) % 7; // ponedjeljak = 0
    const count = new Date(year, month + 1, 0).getDate();
    const out: (number | null)[] = Array(first).fill(null);
    for (let d = 1; d <= count; d++) out.push(d);
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [year, month]);

  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const upcoming = bookings.filter((b) => b.status === 'accepted' && b.end > Date.now()).sort((a, b) => a.start - b.start);
  const selectedParts = selected ? selected.split('-').map(Number) : null;
  const selectedJobs = selectedParts
    ? [...onDay(selectedParts[0], selectedParts[1] - 1, selectedParts[2], 'accepted'), ...onDay(selectedParts[0], selectedParts[1] - 1, selectedParts[2], 'pending')]
    : [];

  return (
    <View>
      {/* zaglavlje s mjesecom */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Btn title="‹" small variant="ghost" onPress={() => changeMonth(-1)} />
        <Text style={{ color: C.text, fontWeight: '900', fontSize: 15 }}>{MONTHS[month]} {year}.</Text>
        <Btn title="›" small variant="ghost" onPress={() => changeMonth(1)} />
      </View>

      <View style={{ flexDirection: 'row' }}>
        {WEEKDAYS.map((w) => (
          <Text key={w} style={{ width: `${100 / 7}%`, textAlign: 'center', color: C.dim, fontSize: 11, fontWeight: '700', marginBottom: 4 }}>{w}</Text>
        ))}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((d, i) => {
          if (d === null) return <View key={`e${i}`} style={{ width: `${100 / 7}%`, height: 42 }} />;
          const key = dayKey(year, month, d);
          const dayStart = new Date(year, month, d).getTime();
          const past = dayStart < todayStart;
          const isToday = dayStart === todayStart;
          const booked = onDay(year, month, d, 'accepted').length > 0;
          const pending = !booked && onDay(year, month, d, 'pending').length > 0;
          const isBlocked = !booked && blocked.has(key);

          let bg = 'transparent';
          let border = C.border;
          let color = C.text;
          if (booked) { bg = 'rgba(248,113,113,0.85)'; border = C.red; color = '#fff'; }
          else if (isBlocked) { bg = '#334155'; border = '#475569'; color = C.dim; }
          else if (pending) { border = C.sky; color = C.sky; }
          if (isToday && !booked) border = C.amber;
          if (selected === key) border = C.text;

          return (
            <Pressable
              key={key}
              onPress={() => {
                if (booked || pending) setSelected(selected === key ? null : key);
                else if (!past) toggleBlocked(key);
              }}
              style={{ width: `${100 / 7}%`, height: 42, padding: 2 }}
            >
              <View style={{
                flex: 1, borderRadius: 10, borderWidth: 1, borderColor: border, backgroundColor: bg,
                alignItems: 'center', justifyContent: 'center', opacity: past ? 0.35 : 1,
              }}>
                <Text style={{ color, fontWeight: booked || isToday ? '900' : '600', textDecorationLine: isBlocked ? 'line-through' : 'none' }}>{d}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* legenda */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
        <Legend color="rgba(248,113,113,0.85)" text="Zauzeto (prihvaćen posao)" />
        <Legend color="transparent" border={C.sky} text="Prijava na čekanju" />
        <Legend color="#334155" text="Nedostupan (moj odabir)" />
        <Legend color="transparent" border={C.amber} text="Danas" />
      </View>
      <Text style={{ color: C.dim, fontSize: 11, marginTop: 4 }}>
        Dodirnite slobodan dan da ga označite kao nedostupan (ili ponovno slobodan). Za zauzete dane ne primate ponude i prijava nije moguća.
      </Text>

      {selectedJobs.length > 0 ? (
        <View style={{ marginTop: 10, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.bg }}>
          {selectedJobs.map((b) => (
            <View key={b.id} style={{ marginBottom: 4 }}>
              <Text style={{ color: b.status === 'accepted' ? C.red : C.sky, fontWeight: '800' }}>
                {b.status === 'accepted' ? '⛵ ' : '⏳ '}{b.title}
              </Text>
              <Text style={{ color: C.muted, fontSize: 12 }}>
                {b.company} · {formatRange(b.startIso, b.endIso)}{b.status === 'pending' ? ' · čeka odgovor' : ''}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <Text style={{ color: C.text, fontWeight: '800', marginTop: 14, marginBottom: 6 }}>Nadolazeći poslovi</Text>
      {upcoming.length === 0
        ? <Text style={{ color: C.dim, fontSize: 12 }}>Nemate rezerviranih poslova.</Text>
        : upcoming.map((b) => (
            <View key={b.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.red, marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: '700', fontSize: 13 }}>{b.title} · {b.company}</Text>
                <Text style={{ color: C.muted, fontSize: 12 }}>{formatRange(b.startIso, b.endIso)}</Text>
              </View>
            </View>
          ))}
    </View>
  );
}

function Legend(props: { color: string; border?: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12, marginBottom: 4 }}>
      <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: props.color, borderWidth: 1, borderColor: props.border ?? props.color, marginRight: 4 }} />
      <Text style={{ color: C.muted, fontSize: 11 }}>{props.text}</Text>
    </View>
  );
}
