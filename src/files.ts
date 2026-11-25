import * as DocumentPicker from 'expo-document-picker';
import { Linking } from 'react-native';
import { supabase } from './supabase';

export type PickedFile = { uri: string; name: string; mimeType: string; size: number; ext: string };

const MAX_MB = 10;

// Otvara izbornik datoteka na mobitelu (PDF i/ili slike)
export async function pickFile(types: string[]): Promise<PickedFile | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: types, copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  const size = a.size ?? 0;
  if (size > MAX_MB * 1024 * 1024) throw new Error(`Datoteka je veća od ${MAX_MB} MB.`);
  const ext = (a.name.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '') || 'pdf';
  return { uri: a.uri, name: a.name, mimeType: a.mimeType ?? 'application/octet-stream', size, ext };
}

// Šalje datoteku u privatni spremnik na Supabaseu
export async function uploadFile(bucket: 'cv' | 'certificates', path: string, file: PickedFile): Promise<void> {
  const body = await fetch(file.uri).then((r) => r.arrayBuffer());
  const { error } = await supabase.storage.from(bucket).upload(path, body, { contentType: file.mimeType, upsert: true });
  if (error) throw error;
}

// Otvara privatnu datoteku preko privremenog linka (vrijedi 10 minuta)
export async function openStored(bucket: 'cv' | 'certificates', path: string): Promise<void> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 600);
  if (error || !data) throw error ?? new Error('Datoteka nije dostupna.');
  await Linking.openURL(data.signedUrl);
}
