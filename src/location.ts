import * as Location from 'expo-location';

export type LatLng = { lat: number; lng: number };

// Traži dopuštenje i vraća približnu trenutnu lokaciju (ili null ako korisnik ne dopusti)
export async function getMyLocation(): Promise<LatLng | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const last = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60 * 1000 });
    const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}
