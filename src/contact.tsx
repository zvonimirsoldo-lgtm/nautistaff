import React, { useEffect, useState } from 'react';
import { Alert, Linking, Text, View } from 'react-native';
import { supabase } from './supabase';
import { Btn } from './components';
import { C } from './theme';
import { errorText } from './utils';

type Contact = { name: string; company: string; phone: string; email: string };

// Hrvatski broj u međunarodni oblik za WhatsApp: 091 123 4567 -> 385911234567
function toWhatsApp(phone: string): string {
  let d = phone.replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  else if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = '385' + d.slice(1);
  return d;
}

async function open(url: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Ne mogu otvoriti', 'Na mobitelu nije pronađena aplikacija za ovu radnju.');
  }
}

// Prikazuje kontakt druge strane nakon prihvaćanja prijave
export default function ContactBox(props: { applicationId: string; label: string }) {
  const [c, setC] = useState<Contact | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc('get_contact', { p_application_id: props.applicationId }).then(({ data, error }) => {
      if (error) setErr(errorText(error));
      else setC(((data ?? []) as Contact[])[0] ?? null);
    });
  }, [props.applicationId]);

  if (err) return <Text style={{ color: C.red, fontSize: 12, marginTop: 6 }}>{err}</Text>;
  if (!c) return <Text style={{ color: C.dim, fontSize: 12, marginTop: 6 }}>Učitavanje kontakta…</Text>;

  return (
    <View style={{ marginTop: 8, padding: 10, borderRadius: 12, backgroundColor: 'rgba(52,211,153,0.08)', borderWidth: 1, borderColor: 'rgba(52,211,153,0.4)' }}>
      <Text style={{ color: C.green, fontSize: 11, fontWeight: '800', marginBottom: 2 }}>{props.label}</Text>
      <Text style={{ color: C.text, fontWeight: '800' }}>{c.name || c.company}</Text>
      {c.phone ? <Text style={{ color: C.muted, fontSize: 12 }}>📞 {c.phone}</Text> : <Text style={{ color: C.dim, fontSize: 12 }}>Broj mobitela nije upisan</Text>}
      <Text style={{ color: C.muted, fontSize: 12 }}>✉ {c.email}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        {c.phone ? <Btn title="📞 Nazovi" small variant="green" onPress={() => open(`tel:${c.phone.replace(/\s/g, '')}`)} /> : null}
        {c.phone ? <Btn title="💬 WhatsApp" small variant="green" onPress={() => open(`https://wa.me/${toWhatsApp(c.phone)}`)} /> : null}
        <Btn title="✉ E-mail" small variant="ghost" onPress={() => open(`mailto:${c.email}`)} />
      </View>
    </View>
  );
}
