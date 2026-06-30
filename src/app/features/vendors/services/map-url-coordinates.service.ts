import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface MapCoordinates {
  latitude: number;
  longitude: number;
}

@Injectable({
  providedIn: 'root',
})
export class MapUrlCoordinatesService {
  private baseUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  extractCoordinatesFromMapUrl(url: string): MapCoordinates | null {
    const normalizedUrl = this.decodeUrl(url);
    const numberPattern = '(-?\\d+(?:\\.\\d+)?)';
    const patterns = [
      new RegExp(`@${numberPattern},\\s*${numberPattern}`),
      new RegExp(`!3d${numberPattern}!4d${numberPattern}`),
      new RegExp(`[?&](?:q|query|ll|center)=${numberPattern},\\s*${numberPattern}`),
      new RegExp(`/maps/search/${numberPattern},\\s*${numberPattern}`),
    ];

    for (const pattern of patterns) {
      const match = normalizedUrl.match(pattern);
      if (!match) continue;

      const latitude = Number(match[1]);
      const longitude = Number(match[2]);
      if (this.isValidCoordinates(latitude, longitude)) {
        return { latitude, longitude };
      }
    }

    const reversedDataMatch = normalizedUrl.match(new RegExp(`!4d${numberPattern}!3d${numberPattern}`));
    if (reversedDataMatch) {
      const longitude = Number(reversedDataMatch[1]);
      const latitude = Number(reversedDataMatch[2]);
      if (this.isValidCoordinates(latitude, longitude)) {
        return { latitude, longitude };
      }
    }

    return null;
  }

  getCoordinatesFromMapUrl(url: string): Observable<MapCoordinates> {
    const encoded = encodeURIComponent(url);
    return this.http.get<MapCoordinates>(`${this.baseUrl}/vendor/map-url-coordinates?url=${encoded}`);
  }

  private decodeUrl(url: string): string {
    try {
      return decodeURIComponent(url);
    } catch {
      return url;
    }
  }

  private isValidCoordinates(latitude: number, longitude: number): boolean {
    return (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    );
  }
}
