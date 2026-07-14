/**
 * Google Places API service for fetching place details including opening hours
 */

import { config } from '../config/env';

interface PlaceOpeningHours {
  open_now?: boolean;
  periods?: Array<{
    open: {
      day: number; // 0-6 (Sunday-Saturday)
      time: string; // HHmm format
    };
    close?: {
      day: number;
      time: string;
    };
  }>;
  weekday_text?: string[];
}

interface PlaceDetailsResult {
  place_id?: string;
  name?: string;
  opening_hours?: PlaceOpeningHours;
  current_opening_hours?: PlaceOpeningHours;
}

/**
 * Fetch place details from Google Places API using place name and coordinates
 */
export async function fetchPlaceDetails(
  name: string,
  lat: number,
  lng: number,
): Promise<PlaceDetailsResult | null> {
  const key = config.googleMapsKey;
  if (!key) {
    console.warn('[GooglePlaces] No API key configured');
    return null;
  }

  try {
    // Step 1: Find place ID using findplacefromtext
    const findUrl =
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json` +
      `?input=${encodeURIComponent(name)}` +
      `&inputtype=textquery` +
      `&locationbias=circle:100@${lat},${lng}` +
      `&fields=place_id,name` +
      `&language=he` +
      `&key=${key}`;

    const findResponse = await fetch(findUrl, {
      headers: { Referer: config.clientUrl || 'https://trip.kefar-sava.co.il/' },
    });

    const findData: any = await findResponse.json();

    if (findData.status !== 'OK' && findData.status !== 'ZERO_RESULTS') {
      console.warn('[GooglePlaces] findplacefromtext error:', findData.status, findData.error_message);
      return null;
    }

    const placeId = findData?.candidates?.[0]?.place_id;
    if (!placeId) {
      console.log(`[GooglePlaces] No place ID found for: ${name}`);
      return null;
    }

    // Step 2: Get place details including opening hours
    const detailsUrl =
      `https://maps.googleapis.com/maps/api/place/details/json` +
      `?place_id=${encodeURIComponent(placeId)}` +
      `&fields=place_id,name,opening_hours,current_opening_hours` +
      `&language=he` +
      `&key=${key}`;

    const detailsResponse = await fetch(detailsUrl, {
      headers: { Referer: config.clientUrl || 'https://trip.kefar-sava.co.il/' },
    });

    const detailsData: any = await detailsResponse.json();

    if (detailsData.status !== 'OK') {
      console.warn('[GooglePlaces] details error:', detailsData.status, detailsData.error_message);
      return null;
    }

    return detailsData.result || null;
  } catch (error) {
    console.error('[GooglePlaces] Error fetching place details:', error);
    return null;
  }
}

/**
 * Extract and normalize opening hours from Google Places API response
 */
export function extractOpeningHours(placeDetails: PlaceDetailsResult): any {
  if (!placeDetails) return null;

  // Prefer current_opening_hours, fallback to opening_hours
  const hours = placeDetails.current_opening_hours || placeDetails.opening_hours;
  if (!hours) return null;

  return {
    open_now: hours.open_now,
    periods: hours.periods || [],
    weekday_text: hours.weekday_text || [],
  };
}
