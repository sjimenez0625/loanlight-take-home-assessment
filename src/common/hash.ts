export function hashStringToBigInt(str: string): bigint {
  let hash = 0n;
  const mask = 9223372036854775807n;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31n + BigInt(str.charCodeAt(i))) & mask;
  }
  return hash;
}
