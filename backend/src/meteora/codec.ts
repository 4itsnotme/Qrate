import { dbcSchema } from './dbc-schema.js';
import { isRecord } from '../transaction-rpc.js';

const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
type IdlType = string | { readonly array: readonly [IdlType, number] } | { readonly defined: { readonly name: string } };
type Field = { readonly name: string; readonly type: IdlType };
const types: Readonly<Record<string, readonly Field[]>> = dbcSchema.types;

export function requireThat(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function decodeBase58(value: string, maxBytes = 2048): Buffer {
  requireThat(value.length > 0 && value.length <= Math.ceil(maxBytes * 1.4) && /^[1-9A-HJ-NP-Za-km-z]+$/.test(value), 'Invalid base58 data.');
  let number = 0n;
  for (const character of value) number = number * 58n + BigInt(alphabet.indexOf(character));
  const hex = number.toString(16);
  const body = number === 0n ? Buffer.alloc(0) : Buffer.from(hex.length % 2 ? `0${hex}` : hex, 'hex');
  const leading = value.match(/^1*/)?.[0].length ?? 0;
  requireThat(leading + body.length <= maxBytes, 'Base58 data is too long.');
  return Buffer.concat([Buffer.alloc(leading), body]);
}

export function encodeBase58(bytes: Uint8Array): string {
  const buffer = Buffer.from(bytes);
  let number = buffer.length ? BigInt(`0x${buffer.toString('hex')}`) : 0n;
  let result = '';
  while (number > 0n) { result = alphabet[Number(number % 58n)] + result; number /= 58n; }
  let leading = 0;
  while (buffer[leading] === 0) leading++;
  return '1'.repeat(leading) + result;
}

export function publicKey(value: unknown): string {
  requireThat(typeof value === 'string' && decodeBase58(value, 32).length === 32, 'Expected a 32-byte public address.');
  return value;
}

export function recordField(value: unknown): Record<string, unknown> {
  requireThat(isRecord(value), 'Missing structured protocol data.');
  return value;
}

export function integerField(value: unknown): bigint {
  requireThat(typeof value === 'bigint' && value >= 0n, 'Missing unsigned protocol integer.');
  return value;
}

// IDL fields include explicit account padding. Events are Borsh; supported accounts have fixed C layouts.
export function decodeStruct(name: string, bytes: Buffer, schemaTypes: Readonly<Record<string, readonly Field[]>> = types): Record<string, unknown> {
  requireThat(bytes.length <= 16_384, 'Protocol data is too large.');
  let offset = 0;
  function take(size: number): Buffer {
    requireThat(offset + size <= bytes.length, 'Truncated protocol data.');
    const result = bytes.subarray(offset, offset + size);
    offset += size;
    return result;
  }
  function struct(typeName: string): Record<string, unknown> {
    const fields = schemaTypes[typeName];
    requireThat(fields, 'Unsupported protocol type.');
    return Object.fromEntries(fields.map((field) => [field.name, read(field.type)]));
  }
  function read(type: IdlType): unknown {
    if (typeof type !== 'string') {
      if ('defined' in type) return struct(type.defined.name);
      return Array.from({ length: type.array[1] }, () => read(type.array[0]));
    }
    switch (type) {
      case 'u8': return take(1)[0];
      case 'bool': {
        const value = take(1)[0];
        requireThat(value === 0 || value === 1, 'Invalid protocol boolean.');
        return value === 1;
      }
      case 'u16': return take(2).readUInt16LE();
      case 'u32': return take(4).readUInt32LE();
      case 'u64': return take(8).readBigUInt64LE();
      case 'u128': { const data = take(16); return data.readBigUInt64LE() + (data.readBigUInt64LE(8) << 64n); }
      case 'pubkey': return encodeBase58(take(32));
      default: throw new Error('Unsupported protocol field.');
    }
  }
  const decoded = struct(name);
  requireThat(offset === bytes.length, 'Unknown protocol layout or trailing data.');
  return decoded;
}

export function formatUnits(raw: bigint, decimals: number): string {
  requireThat(raw >= 0n && Number.isInteger(decimals) && decimals >= 0 && decimals <= 18, 'Invalid amount units.');
  const digits = raw.toString().padStart(decimals + 1, '0');
  if (decimals === 0) return digits;
  const fraction = digits.slice(-decimals).replace(/0+$/, '');
  return digits.slice(0, -decimals) + (fraction ? `.${fraction}` : '');
}
