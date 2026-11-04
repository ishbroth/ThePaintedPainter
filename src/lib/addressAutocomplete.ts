// Google's address suggestions as someone types, and the street, city, state and ZIP a chosen suggestion stands for.
// Uses the Places library that the map already loads (the key is the same). If Google cannot be asked (no key, the service is not switched on,
// no connection) it gives nothing and the fields simply stay plain text boxes.

import { ensureGoogleMaps } from './googleMaps';

export interface AddressSuggestion {
  id: string;
  main: string;
  secondary: string;
  prediction: google.maps.places.PlacePrediction;
}

export interface PickedAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
}

let token: google.maps.places.AutocompleteSessionToken | null = null;

/** A few address suggestions for what has been typed so far, best first. */
export async function suggestAddresses(input: string): Promise<AddressSuggestion[]> {
  if (input.trim().length < 3) return [];
  try {
    if (!(await ensureGoogleMaps())) return [];
    const { AutocompleteSuggestion, AutocompleteSessionToken } = (await google.maps.importLibrary('places')) as google.maps.PlacesLibrary;
    token ??= new AutocompleteSessionToken();
    const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
      input,
      sessionToken: token,
      includedPrimaryTypes: ['street_address', 'premise', 'subpremise', 'route'],
      includedRegionCodes: ['us'],
    });
    return suggestions
      .map((s) => s.placePrediction)
      .filter((p): p is google.maps.places.PlacePrediction => !!p)
      .slice(0, 5)
      .map((p) => ({ id: p.placeId, main: p.mainText?.text ?? p.text.text, secondary: p.secondaryText?.text ?? '', prediction: p }));
  } catch {
    return [];
  }
}

/** The street, city, state and ZIP of a suggestion. Ends the typing session (Google counts one lookup for the whole of it). */
export async function resolveAddress(s: AddressSuggestion): Promise<PickedAddress | null> {
  try {
    const place = s.prediction.toPlace();
    await place.fetchFields({ fields: ['addressComponents', 'formattedAddress'] });
    token = null;
    const parts = place.addressComponents ?? [];
    const get = (type: string, short = false) => {
      const c = parts.find((x) => x.types.includes(type));
      return c ? (short ? c.shortText : c.longText) ?? '' : '';
    };
    const street = [get('street_number'), get('route')].filter(Boolean).join(' ') + (get('subpremise') ? ' #' + get('subpremise') : '');
    return {
      street: street || s.main,
      city: get('locality') || get('postal_town') || get('sublocality_level_1') || get('administrative_area_level_3'),
      state: get('administrative_area_level_1', true),
      zip: get('postal_code'),
    };
  } catch {
    token = null;
    return null;
  }
}
