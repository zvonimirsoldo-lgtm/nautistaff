import React, { useState } from 'react';
import { Alert, Modal, Text, View } from 'react-native';
import { supabase } from './supabase';
import { Btn, Chips, Field, useToast } from './components';
import { useAuth } from './auth';
import { C } from './theme';
import { errorText } from './utils';

const REASONS = [
  'Lažan ili obmanjujući oglas',
  'Neprijavljeni rad ili nezakoniti uvjeti',
  'Uvredljiv ili diskriminirajući sadržaj',
  'Prijevara ili zlouporaba',
  'Nešto drugo',
];

export type ReportTarget = { jobId?: string; userId?: string; label: string } | null;

// Prijava sumnjivog oglasa ili korisnika administratoru
export default function ReportModal(props: { target: ReportTarget; onClose: () => void }) {
  const { profile } = useAuth();
  const toast = useToast();
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!props.target || !profile) return;
    setBusy(true);
    const { error } = await supabase.from('reports').insert({
      reporter_id: profile.id,
      job_id: props.target.jobId ?? null,
      reported_user_id: props.target.userId ?? null,
      reason,
      details: details.trim(),
    });
    setBusy(false);
    if (error) return Alert.alert('Prijava nije poslana', errorText(error));
    setDetails('');
    props.onClose();
    toast('⚑ Hvala! Prijavu ćemo pregledati.');
  }

  return (
    <Modal visible={!!props.target} transparent animationType="fade" onRequestClose={props.onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 16 }}>
        <View style={{ backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 16 }}>
          <Text style={{ color: C.text, fontWeight: '900', fontSize: 16 }}>⚑ Prijavi</Text>
          <Text style={{ color: C.muted, fontSize: 12, marginBottom: 12 }}>{props.target?.label}</Text>
          <Chips label="Razlog" options={REASONS.map((r) => ({ value: r, label: r }))} value={reason} onChange={setReason} />
          <Field label="Opis (neobavezno)" value={details} onChangeText={setDetails} multiline maxLength={1000}
                 style={{ minHeight: 70, textAlignVertical: 'top' }} placeholder="Što se dogodilo?" />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
            <Btn title="Odustani" small variant="ghost" onPress={props.onClose} />
            <Btn title="Pošalji prijavu" small variant="danger" onPress={send} loading={busy} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
