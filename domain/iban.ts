/**
 * IBAN validation: ISO 13616 structure + ISO 7064 mod-97 checksum.
 *
 * This runs locally, synchronously, before any network call. Screen 07 gives the
 * user an answer as they type, offline, with zero round trips.
 *
 * What it catches: typos, transpositions, wrong-country pastes, wrong length.
 * What it cannot catch: a structurally valid IBAN belonging to the wrong person.
 * Türkiye has no name-check service to resolve that, which is why screen 07 warns
 * about name matching up front and screen 11c makes the returned payout cheap.
 */

export const TR_IBAN_LENGTH = 26;

/** Turkish bank codes: digits 5-8 of the IBAN. Enough to echo the bank back. */
const TR_BANKS: Record<string, string> = {
  '0010': 'Ziraat Bankası',
  '0012': 'Halkbank',
  '0015': 'Vakıfbank',
  '0046': 'Akbank',
  '0059': 'Şekerbank',
  '0062': 'Garanti BBVA',
  '0064': 'İş Bankası',
  '0067': 'Yapı Kredi',
  '0111': 'QNB Finansbank',
  '0134': 'Denizbank',
};

export type IbanProblem =
  | 'empty'
  | 'wrong_country'
  | 'bad_length'
  | 'bad_charset'
  | 'bad_checksum'
  | 'unsupported_bank';

export type IbanResult =
  | { readonly ok: true; readonly normalised: string; readonly bank: string; readonly bankCode: string }
  | { readonly ok: false; readonly problem: IbanProblem };

/** Strips spaces and upper-cases. Users paste IBANs formatted every possible way. */
export function normaliseIban(input: string): string {
  return input.replace(/[\s -]/g, '').toUpperCase();
}

/** `TR64 0062 0001 2345 6789 0123 45`, grouped in fours for display. */
export function formatIban(input: string): string {
  return normaliseIban(input).replace(/(.{4})/g, '$1 ').trim();
}

/** `TR64 ···· 2345`, the masked form shown after a recipient is saved. */
export function maskIban(input: string): string {
  const n = normaliseIban(input);
  if (n.length < 8) return n;
  return `${n.slice(0, 4)} ···· ${n.slice(-4)}`;
}

/**
 * ISO 7064 mod-97-10.
 *
 * Computed in a streaming fashion rather than by building one enormous BigInt.
 * An IBAN expands to ~30 digits, and chunking keeps this in Number range and fast
 * enough to run on every keystroke.
 */
export function mod97(rearranged: string): number {
  let remainder = 0;
  for (let i = 0; i < rearranged.length; i += 1) {
    const code = rearranged.charCodeAt(i);
    if (code >= 48 && code <= 57) {
      remainder = (remainder * 10 + (code - 48)) % 97;
    } else if (code >= 65 && code <= 90) {
      // A → 10 … Z → 35, i.e. two digits
      remainder = (remainder * 100 + (code - 55)) % 97;
    } else {
      return -1;
    }
  }
  return remainder;
}

export function validateTurkishIban(input: string): IbanResult {
  const n = normaliseIban(input);

  if (n.length === 0) return { ok: false, problem: 'empty' };
  if (!/^[A-Z0-9]+$/.test(n)) return { ok: false, problem: 'bad_charset' };
  if (!n.startsWith('TR')) return { ok: false, problem: 'wrong_country' };
  if (n.length !== TR_IBAN_LENGTH) return { ok: false, problem: 'bad_length' };

  // Move the first four characters to the end, then mod-97 must equal 1.
  if (mod97(n.slice(4) + n.slice(0, 4)) !== 1) {
    return { ok: false, problem: 'bad_checksum' };
  }

  const bankCode = n.slice(4, 8);
  const bank = TR_BANKS[bankCode];
  if (bank === undefined) return { ok: false, problem: 'unsupported_bank' };

  return { ok: true, normalised: n, bank, bankCode };
}

/**
 * Compute the correct check digits for an account portion, used to build valid
 * fixtures rather than hand-guessing them, and to explain a `bad_checksum` result
 * ("did you mean TR64…?") instead of only rejecting it.
 */
export function turkishCheckDigits(bodyAfterCheckDigits: string): string {
  const body = normaliseIban(bodyAfterCheckDigits);
  const remainder = mod97(`${body}TR00`);
  if (remainder < 0) throw new RangeError('non-alphanumeric input');
  const check = 98 - remainder;
  return check.toString().padStart(2, '0');
}

/** Copy for each failure, in the phase 2 error voice: what happened, what to do. */
export const IBAN_MESSAGES: Record<IbanProblem, string> = {
  empty: 'Enter the recipient’s IBAN',
  wrong_country: 'This corridor pays out to Turkish accounts, so the IBAN must start with TR',
  bad_length: 'A Turkish IBAN is 26 characters',
  bad_charset: 'IBANs contain only letters and numbers',
  bad_checksum: 'That IBAN isn’t valid. Check for a mistyped digit',
  unsupported_bank: 'We don’t pay out to that bank yet',
};
