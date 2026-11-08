export type Category = 'Eat' | 'Drink' | 'Shop' | 'Do';
export interface Photo { src: string; alt: string; credit?: string; sourceUrl?: string; license?: string; licenseUrl?: string; changes?: string }
export interface Place {
  id: string; slug: string; name: string; category: Category; area: string;
  address: string; lat: number; lng: number; description: string;
  googleMapsUrl: string; websiteUrl?: string;
  photos: Photo[];
  hours?: string; priceNote?: string; goodToKnow?: string;
  googlePlaceId?: string;
  googleBusinessStatus?: 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY';
}
