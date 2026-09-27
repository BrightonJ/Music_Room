import * as Location from 'expo-location';

export type PositionResult =
  | { ok: true; coords: { lat: number; lng: number } }
  | { ok: false; error: string };

// A recent position is reused (fast); otherwise a fresh one is requested.
export async function getFreshPosition(maxAgeMs = 60000): Promise<PositionResult> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return { ok: false, error: 'Allow location access in your phone settings to vote in this room.' };
    }
    const last = await Location.getLastKnownPositionAsync({ maxAge: maxAgeMs, requiredAccuracy: 200 });
    const position = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    return { ok: true, coords: { lat: position.coords.latitude, lng: position.coords.longitude } };
  } catch {
    return { ok: false, error: 'Your location is unavailable. Turn on location services and try again.' };
  }
}
