export interface Location {
  lat: number;
  lng: number;
  name?: string;
}

export interface LocationWithAddress extends Location {
  address: string;
}
