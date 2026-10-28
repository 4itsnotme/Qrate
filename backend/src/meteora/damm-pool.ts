import { dammSchema } from './damm-schema.js';
import { decodeStruct, integerField, publicKey, recordField, requireThat } from './codec.js';
import { mintInfo, parsedInfo, readRpc, TOKEN_PROGRAM, TOKEN_2022_PROGRAM, WSOL } from './pool.js';

export const DAMM_PROGRAM = dammSchema.address;
export const DAMM_AUTHORITY = 'HLnpSz9h2S4hiLQ43rnSD9XkcUThA7B8hQMKmDaiTLcC';
export const DAMM_EVENT_AUTHORITY = '3rmHSu74h1ZcmAisVcWerTCiRDQbUrBKmcwptYGjHfet';

export class DammVerificationError extends Error {}

export interface VerifiedDammPool {
  protocol: 'meteora-damm-v2';
  address: string;
  baseMint: string;
  quoteMint: typeof WSOL;
  baseVault: string;
  quoteVault: string;
  baseDecimals: number;
  baseTokenProgram: string;
  collectFeeMode: 0 | 1;
  verificationSlot: number;
}

export function readDammState(account: unknown): Record<string, unknown> {
  const record = recordField(account);
  requireThat(record.owner === DAMM_PROGRAM && record.executable === false && Array.isArray(record.data) &&
    record.data[1] === 'base64' && typeof record.data[0] === 'string' && record.data[0].length < 24_000 &&
    /^[A-Za-z0-9+/]+={0,2}$/.test(record.data[0]), 'Invalid DAMM pool owner or encoding.');
  const bytes = Buffer.from(record.data[0], 'base64');
  requireThat(bytes.subarray(0, 8).equals(Buffer.from(dammSchema.accounts.Pool)), 'Unsupported DAMM account discriminator.');
  return decodeStruct('Pool', bytes.subarray(8), dammSchema.types);
}

export function verifyDammSnapshot(address: string, snapshot: unknown): VerifiedDammPool {
  publicKey(address);
  const bundle = recordField(snapshot), context = recordField(bundle.context);
  requireThat(Number.isSafeInteger(context.slot) && Number(context.slot) >= 0 && Array.isArray(bundle.addresses) &&
    Array.isArray(bundle.value) && bundle.addresses.length === 5 && bundle.value.length === 5, 'Invalid DAMM snapshot context.');
  const state = readDammState(bundle.value[0]);
  const baseMint = publicKey(state.token_a_mint), baseVault = publicKey(state.token_a_vault), quoteVault = publicKey(state.token_b_vault);
  const expected = [address, baseMint, WSOL, baseVault, quoteVault];
  requireThat(state.token_b_mint === WSOL && new Set(expected).size === 5 &&
    bundle.addresses.every((key: unknown, index: number) => key === expected[index]), 'Only token-A/WSOL DAMM pools are supported.');
  requireThat((state.collect_fee_mode === 0 || state.collect_fee_mode === 1) &&
    (state.layout_version === 0 || state.layout_version === 1) && (state.fee_version === 0 || state.fee_version === 1) &&
    (state.pool_status === 0 || state.pool_status === 1) && (state.activation_type === 0 || state.activation_type === 1),
    'Unsupported DAMM fee mode or account version.');
  const baseProgram = recordField(bundle.value[1]).owner;
  requireThat(baseProgram === TOKEN_PROGRAM || baseProgram === TOKEN_2022_PROGRAM, 'Unsupported DAMM base token program.');
  requireThat(state.token_a_flag === (baseProgram === TOKEN_PROGRAM ? 0 : 1) && state.token_b_flag === 0,
    'DAMM token program flags disagree with mints.');
  const base = mintInfo(bundle.value[1], baseProgram), quote = mintInfo(bundle.value[2], TOKEN_PROGRAM);
  requireThat(quote.decimals === 9 && integerField(state.sqrt_price) > 0n, 'Invalid WSOL decimals or DAMM price state.');
  for (const [index, mint, program, decimals] of [[3, baseMint, baseProgram, base.decimals], [4, WSOL, TOKEN_PROGRAM, 9]] as const) {
    const vault = parsedInfo(bundle.value[index], program, 'account');
    requireThat(vault.mint === mint && vault.owner === DAMM_AUTHORITY && vault.state === 'initialized' &&
      recordField(vault.tokenAmount).decimals === decimals, 'DAMM vault identity or authority mismatch.');
  }
  return Object.freeze({ protocol: 'meteora-damm-v2', address, baseMint, quoteMint: WSOL, baseVault, quoteVault,
    baseDecimals: Number(base.decimals), baseTokenProgram: baseProgram, collectFeeMode: state.collect_fee_mode, verificationSlot: Number(context.slot) });
}

export async function loadVerifiedDammPool(rpcUrl: URL, address: string, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<VerifiedDammPool> {
  publicKey(address);
  const first = recordField(await readRpc(rpcUrl, 'getAccountInfo', [address, { encoding: 'base64', commitment: 'finalized' }], signal, fetcher));
  let state: Record<string, unknown>;
  try { state = readDammState(first.value); }
  catch (error) { throw new DammVerificationError(error instanceof Error ? error.message : 'Unsupported DAMM pool.'); }
  const slot = recordField(first.context).slot;
  requireThat(Number.isSafeInteger(slot) && Number(slot) >= 0, 'Invalid DAMM observation slot.');
  const addresses = [address, publicKey(state.token_a_mint), WSOL, publicKey(state.token_a_vault), publicKey(state.token_b_vault)];
  const bundle = recordField(await readRpc(rpcUrl, 'getMultipleAccounts', [addresses,
    { encoding: 'jsonParsed', commitment: 'finalized', minContextSlot: slot }], signal, fetcher));
  let verified: VerifiedDammPool;
  try { verified = verifyDammSnapshot(address, { ...bundle, addresses }); }
  catch (error) { throw new DammVerificationError(error instanceof Error ? error.message : 'Unsupported DAMM snapshot.'); }
  requireThat(verified.verificationSlot >= Number(slot), 'DAMM snapshot predates discovery.');
  return verified;
}
