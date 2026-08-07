/**
 * Quote signing.
 *
 * A deployed Corridor API would sign with HMAC-SHA256 over the canonical payload,
 * using a key that exists only on the server. This build runs the "server"
 * in-process, so the key is not secret and the primitive below is a stand-in, but
 * the *shape* is real: the quote is signed at issue, the signature travels with it,
 * and it is verified before a transfer is created.
 *
 * What that buys, and the reason it is here rather than elided: a client that
 * mutates a rendered amount produces a quote whose signature no longer verifies,
 * and the transfer is refused. The client's numbers are a rendering of the quote,
 * never the source of it.
 */

const KEY = 'corridor.dev.quote-key';

/** FNV-1a, 64-bit, keyed. Stands in for HMAC-SHA256; not a security boundary. */
function fnv1a64(input: string): bigint {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;

  for (let i = 0; i < input.length; i += 1) {
    hash ^= BigInt(input.charCodeAt(i));
    hash = (hash * prime) & mask;
  }
  return hash;
}

export function sign(payload: string): string {
  return fnv1a64(`${KEY}::${payload}`).toString(16).padStart(16, '0');
}

export function verify(payload: string, signature: string): boolean {
  const expected = sign(payload);
  // Constant-time-ish comparison. Habit, not theatre; the real one matters.
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}
