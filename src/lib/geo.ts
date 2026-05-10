export type ItineraryCentroid = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  vibeTag: string;
  costBand: string;
  durationDays: number;
  latitude: number;
  longitude: number;
  dartThrowCount: number;
};

export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 3958.8; // miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function findClosestItinerary(
  lat: number,
  lng: number,
  itineraries: ItineraryCentroid[]
): ItineraryCentroid {
  return itineraries.reduce((closest, current) => {
    const d = haversineDistance(lat, lng, current.latitude, current.longitude);
    const dClosest = haversineDistance(lat, lng, closest.latitude, closest.longitude);
    return d < dClosest ? current : closest;
  });
}
