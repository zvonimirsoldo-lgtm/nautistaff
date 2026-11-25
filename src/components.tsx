import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput,
  TextInputProps, View, ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from './theme';

// ---------- Gumb ----------
type BtnVariant = 'primary' | 'gold' | 'ghost' | 'danger' | 'green';

export function Btn(props: {
  title: string; onPress: () => void; variant?: BtnVariant; loading?: boolean;
  disabled?: boolean; small?: boolean; style?: ViewStyle;
}) {
  const v = props.variant ?? 'primary';
  const bg = { primary: C.skyDark, gold: C.amber, ghost: 'transparent', danger: '#7f1d1d', green: C.green }[v];
  const fg = v === 'ghost' ? C.muted : v === 'danger' ? '#fecaca' : C.bg;
  const off = props.disabled || props.loading;
  return (
    <Pressable
      onPress={props.onPress}
      disabled={off}
      style={({ pressed }) => [
        s.btn,
        props.small && s.btnSmall,
        { backgroundColor: bg, opacity: off ? 0.5 : pressed ? 0.8 : 1 },
        v === 'ghost' && { borderWidth: 1, borderColor: C.border },
        props.style,
      ]}
    >
      {props.loading
        ? <ActivityIndicator color={fg} />
        : <Text style={[s.btnText, props.small && { fontSize: 12 }, { color: fg }]}>{props.title}</Text>}
    </Pressable>
  );
}

// ---------- Polje za unos ----------
export function Field(props: TextInputProps & { label: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput placeholderTextColor={C.dim} style={[s.input, style]} {...rest} />
    </View>
  );
}

// ---------- Odabir jedne opcije (čipovi) ----------
export function Chips<T extends string | number>(props: {
  label?: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <View style={{ marginBottom: 10 }}>
      {props.label ? <Text style={s.label}>{props.label}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {props.options.map((o) => {
          const active = o.value === props.value;
          return (
            <Pressable
              key={String(o.value)}
              onPress={() => props.onChange(o.value)}
              style={[s.chip, active && { backgroundColor: C.skyDark, borderColor: C.sky }]}
            >
              <Text style={[s.chipText, active && { color: C.bg }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ---------- Odabir više opcija ----------
export function MultiChips(props: {
  label?: string; options: { value: string; label: string }[]; values: string[]; onChange: (v: string[]) => void;
}) {
  return (
    <View style={{ marginBottom: 10 }}>
      {props.label ? <Text style={s.label}>{props.label}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {props.options.map((o) => {
          const active = props.values.includes(o.value);
          return (
            <Pressable
              key={o.value}
              onPress={() => props.onChange(active ? props.values.filter((v) => v !== o.value) : [...props.values, o.value])}
              style={[s.chip, { marginBottom: 6 }, active && { backgroundColor: C.skyDark, borderColor: C.sky }]}
            >
              <Text style={[s.chipText, active && { color: C.bg }]}>{active ? '✓ ' : ''}{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ---------- Prekidač ----------
export function Toggle(props: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
      <Text style={{ color: C.text, fontSize: 13, flex: 1, marginRight: 8 }}>{props.label}</Text>
      <Switch value={props.value} onValueChange={props.onChange} trackColor={{ true: C.skyDark, false: C.border }} />
    </View>
  );
}

// ---------- Plava značka verificiranog profila ----------
export function VerifiedBadge(props: { small?: boolean }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
      backgroundColor: 'rgba(56,189,248,0.15)', borderColor: C.sky, borderWidth: 1, borderRadius: 20,
      paddingHorizontal: props.small ? 6 : 10, paddingVertical: props.small ? 1 : 3,
    }}>
      <Text style={{ color: C.sky, fontWeight: '900', fontSize: props.small ? 10 : 12 }}>✔ VERIFICIRAN</Text>
    </View>
  );
}

// ---------- Sklopivi okvir (otvara se dodirom na naslov) ----------
export function Section(props: { title: string; subtitle?: string; initiallyOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(!!props.initiallyOpen);
  return (
    <View style={[s.card, { padding: 0, overflow: 'hidden' }]}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', padding: 14, opacity: pressed ? 0.7 : 1 })}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontWeight: '900', fontSize: 15 }}>{props.title}</Text>
          {props.subtitle ? <Text style={{ color: C.dim, fontSize: 11, marginTop: 2 }}>{props.subtitle}</Text> : null}
        </View>
        <Text style={{ color: C.sky, fontSize: 18, fontWeight: '900' }}>{open ? '▾' : '▸'}</Text>
      </Pressable>
      {open ? <View style={{ paddingHorizontal: 12, paddingBottom: 12, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12 }}>{props.children}</View> : null}
    </View>
  );
}

// ---------- Kartica, oznaka, prazno stanje ----------
export function Card(props: { children: React.ReactNode; style?: ViewStyle | ViewStyle[] }) {
  return <View style={[s.card, props.style as ViewStyle]}>{props.children}</View>;
}

export function Badge(props: { text: string; color: string; bg?: string }) {
  return (
    <View style={[s.badge, { borderColor: props.color, backgroundColor: props.bg ?? 'transparent' }]}>
      <Text style={[s.badgeText, { color: props.color }]}>{props.text}</Text>
    </View>
  );
}

export function Empty(props: { text: string }) {
  return <Text style={s.empty}>{props.text}</Text>;
}

export function Title(props: { children: React.ReactNode }) {
  return <Text style={s.title}>{props.children}</Text>;
}

// ---------- Ekran s povlačenjem za osvježavanje ----------
export function Screen(props: { children: React.ReactNode; refreshing?: boolean; onRefresh?: () => void }) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={props.onRefresh
        ? <RefreshControl refreshing={!!props.refreshing} onRefresh={props.onRefresh} tintColor={C.sky} />
        : undefined}
    >
      {props.children}
    </ScrollView>
  );
}

// ---------- Donja navigacija ----------
export function TabBar<T extends string>(props: {
  tabs: { id: T; label: string; badge?: number }[]; active: T; onChange: (t: T) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {props.tabs.map((t) => {
        const active = t.id === props.active;
        return (
          <Pressable key={t.id} onPress={() => props.onChange(t.id)} style={[s.tab, active && s.tabActive]}>
            <Text style={[s.tabText, active && { color: C.sky }]}>{t.label}</Text>
            {t.badge ? <View style={s.tabBadge}><Text style={s.tabBadgeText}>{t.badge}</Text></View> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------- Kratke obavijesti na vrhu ekrana ----------
const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider(props: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const show = useCallback((m: string) => {
    setMsg(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 3500);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {props.children}
      {msg ? (
        <Pressable onPress={() => setMsg(null)} style={[s.toast, { top: insets.top + 10 }]}>
          <Text style={s.toastText}>{msg}</Text>
        </Pressable>
      ) : null}
    </ToastCtx.Provider>
  );
}

export const s = StyleSheet.create({
  btn: { borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  btnSmall: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 10 },
  btnText: { fontWeight: '800', fontSize: 14, letterSpacing: 0.3 },
  label: { color: C.muted, fontSize: 11, fontWeight: '700', marginBottom: 4 },
  input: {
    backgroundColor: C.card, borderColor: C.border, borderWidth: 1, borderRadius: 12,
    color: C.text, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
  },
  chip: {
    borderWidth: 1, borderColor: C.border, backgroundColor: C.card, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 7, marginRight: 6,
  },
  chipText: { color: C.muted, fontWeight: '700', fontSize: 12 },
  card: { backgroundColor: C.card, borderColor: C.border, borderWidth: 1, borderRadius: 18, padding: 12, marginBottom: 12 },
  badge: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  badgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  empty: { color: C.dim, textAlign: 'center', marginTop: 40, fontSize: 14 },
  title: { color: C.text, fontWeight: '900', fontSize: 16, marginBottom: 12 },
  tabBar: { flexDirection: 'row', backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8, paddingHorizontal: 6 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 12 },
  tabActive: { backgroundColor: 'rgba(56,189,248,0.1)' },
  tabText: { color: C.muted, fontWeight: '800', fontSize: 12 },
  tabBadge: { position: 'absolute', top: 2, right: 14, backgroundColor: '#ef4444', borderRadius: 9, minWidth: 18, paddingHorizontal: 4, alignItems: 'center' },
  tabBadgeText: { color: 'white', fontSize: 10, fontWeight: '800' },
  toast: {
    position: 'absolute', left: 16, right: 16, backgroundColor: '#0b1324', borderColor: C.sky,
    borderWidth: 1, borderRadius: 16, padding: 14, elevation: 10, zIndex: 100,
  },
  toastText: { color: C.text, fontWeight: '700', fontSize: 13 },
});
