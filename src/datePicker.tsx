import React, { useMemo, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Btn } from './components';
import { C } from './theme';

const MONTHS = ['Siječanj', 'Veljača', 'Ožujak', 'Travanj', 'Svibanj', 'Lipanj', 'Srpanj', 'Kolovoz', 'Rujan', 'Listopad', 'Studeni', 'Prosinac'];
const WEEKDAYS = ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned'];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Kalendar za odabir jednog datuma, u rasponu [min, max]
export default function DatePickerModal(props: {
  visible: boolean; value: Date | null; min: Date; max: Date; title?: string;
  onPick: (d: Date) => void; onClose: () => void;
}) {
  const initial = props.value ?? props.min;
  const [year, setYear] = useState(initial.getFullYear());
  const [month, setMonth] = useState(initial.getMonth());
  const min = startOfDay(props.min).getTime();
  const max = startOfDay(props.max).getTime();
  const selected = props.value ? startOfDay(props.value).getTime() : null;

  const cells = useMemo(() => {
    const first = (new Date(year, month, 1).getDay() + 6) % 7;
    const count = new Date(year, month + 1, 0).getDate();
    const out: (number | null)[] = Array(first).fill(null);
    for (let d = 1; d <= count; d++) out.push(d);
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [year, month]);

  const canPrev = new Date(year, month, 1).getTime() > min;
  const canNext = new Date(year, month + 1, 1).getTime() <= max;

  function move(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  return (
    <Modal visible={props.visible} transparent animationType="fade" onRequestClose={props.onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 16 }}>
        <View style={{ backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 14 }}>
          <Text style={{ color: C.text, fontWeight: '900', fontSize: 16, marginBottom: 10 }}>{props.title ?? 'Odaberite datum'}</Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Btn title="‹" small variant="ghost" onPress={() => move(-1)} disabled={!canPrev} />
            <Text style={{ color: C.text, fontWeight: '900', fontSize: 15 }}>{MONTHS[month]} {year}.</Text>
            <Btn title="›" small variant="ghost" onPress={() => move(1)} disabled={!canNext} />
          </View>

          <View style={{ flexDirection: 'row' }}>
            {WEEKDAYS.map((w) => (
              <Text key={w} style={{ width: `${100 / 7}%`, textAlign: 'center', color: C.dim, fontSize: 11, fontWeight: '700', marginBottom: 4 }}>{w}</Text>
            ))}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {cells.map((d, i) => {
              if (d === null) return <View key={`e${i}`} style={{ width: `${100 / 7}%`, height: 42 }} />;
              const t = new Date(year, month, d).getTime();
              const disabled = t < min || t > max;
              const isSel = t === selected;
              const weekend = (i % 7) >= 5;
              return (
                <Pressable
                  key={t}
                  disabled={disabled}
                  onPress={() => { props.onPick(new Date(year, month, d)); props.onClose(); }}
                  style={{ width: `${100 / 7}%`, height: 42, padding: 2 }}
                >
                  <View style={{
                    flex: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: isSel ? C.skyDark : 'transparent',
                    borderWidth: 1, borderColor: isSel ? C.sky : C.border, opacity: disabled ? 0.25 : 1,
                  }}>
                    <Text style={{ color: isSel ? C.bg : weekend ? C.amberLight : C.text, fontWeight: isSel ? '900' : '600' }}>{d}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Btn title="Zatvori" small variant="ghost" onPress={props.onClose} style={{ alignSelf: 'flex-end', marginTop: 10 }} />
        </View>
      </View>
    </Modal>
  );
}
