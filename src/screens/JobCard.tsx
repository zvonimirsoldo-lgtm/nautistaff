import React from 'react';
import { Text, View } from 'react-native';
import { Badge, Btn, Card } from '../components';
import { C } from '../theme';
import { formatCountdown, formatDateTime, formatPay, parseTs } from '../utils';

export type FeedJob = {
  id: string;
  company_name: string;
  company_verified: boolean;
  company_rating: number | null;
  category: string;
  title: string;
  vessel: string;
  location_name: string;
  start_at: string;
  duration: string;
  licence: string;
  spots: number;
  filled: number;
  pay_amount: number;
  pay_unit: string;
  tips: boolean;
  is_live: boolean;
  is_vip: boolean;
  expires_at: string;
  distance_km: number | null;
  my_application_status: string | null;
};

export default function JobCard(props: {
  job: FeedJob; now: number; applying: boolean; onApply: () => void;
}) {
  const j = props.job;
  const left = parseTs(j.expires_at) - props.now;
  const urgent = left < 15 * 60 * 1000;
  const spotsLeft = j.spots - j.filled;
  const st = j.my_application_status;

  const border = j.is_vip ? { borderColor: C.amber, borderWidth: 2 } : j.is_live ? { borderColor: 'rgba(56,189,248,0.5)' } : {};

  return (
    <Card style={border}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        {j.is_vip
          ? <Badge text="👑 VIP flota partner" color={C.bg} bg={C.amber} />
          : j.is_live ? <Badge text="⚡ LIVE · hitno" color={C.red} /> : <Badge text="Oglas" color={C.muted} />}
        {j.company_verified
          ? <Text style={{ color: C.amberLight, fontSize: 11, fontWeight: '700' }}>
              ✔ Verificiran{j.company_rating ? ` · ★ ${Number(j.company_rating).toFixed(1)}` : ''}
            </Text>
          : <Text style={{ color: C.dim, fontSize: 10 }}>Neverificiran poslodavac</Text>}
      </View>

      <Text style={{ color: C.text, fontWeight: '900', fontSize: 15 }}>{j.title}</Text>
      <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>
        {j.vessel ? `${j.vessel} · ` : ''}<Text style={{ color: j.is_vip ? C.amberLight : C.sky, fontWeight: '700' }}>{j.company_name}</Text>
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
        <Info text={`📍 ${j.location_name}${j.distance_km != null ? ` (${Math.round(j.distance_km)} km)` : ''}`} />
        <Info text={`📅 ${formatDateTime(j.start_at)}`} />
        {j.duration ? <Info text={`⏳ ${j.duration}`} /> : null}
        {j.licence ? <Info text={`🪪 ${j.licence}`} /> : null}
        <Info text={`👥 ${spotsLeft} ${spotsLeft === 1 ? 'mjesto' : 'mjesta'}`} />
      </View>

      <View style={{
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8,
        backgroundColor: C.bg, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 10, paddingVertical: 7,
      }}>
        <Text style={{ color: C.muted, fontSize: 11, fontWeight: '800' }}>PONUDA ISTJEČE ZA</Text>
        <Text style={{ color: urgent ? C.red : C.amberLight, fontWeight: '900', fontSize: 16, fontVariant: ['tabular-nums'] }}>
          {formatCountdown(left)}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border }}>
        <View>
          <Text style={{ color: C.green, fontWeight: '900', fontSize: 15 }}>{formatPay(j.pay_amount, j.pay_unit)}</Text>
          {j.tips ? <Text style={{ color: C.dim, fontSize: 11 }}>+ napojnice</Text> : null}
        </View>
        {st === 'pending' ? <Text style={{ color: C.sky, fontWeight: '800' }}>⏳ Prijava poslana</Text>
          : st === 'accepted' ? <Text style={{ color: C.green, fontWeight: '900' }}>✔ Prihvaćeni ste!</Text>
          : st === 'rejected' ? <Text style={{ color: C.dim, fontWeight: '700' }}>Nije odabrano</Text>
          : <Btn title="⚡ PRIJAVI SE ODMAH" small variant={j.is_vip ? 'gold' : 'primary'} loading={props.applying} onPress={props.onApply} />}
      </View>
    </Card>
  );
}

function Info(props: { text: string }) {
  return <Text style={{ color: C.muted, fontSize: 11, marginRight: 10, marginTop: 2 }}>{props.text}</Text>;
}
