import { dbcSchema } from './dbc-schema.js';
import { decodeStruct, integerField, publicKey, recordField, requireThat } from './codec.js';
import { isRecord } from '../transaction-rpc.js';

export const DBC_PROGRAM = dbcSchema.address;
export const POOL_AUTHORITY = 'FhVo3mqL8PW5pH5U2CN4XE33DokiyZnUwuGpH2hmHLuM';
export const EVENT_AUTHORITY = '8Ks12pbrD6PXxfty1hVQiE9sc289zgU1zHkvXhrSdriF';
export const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
export const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
export const WSOL = 'So11111111111111111111111111111111111111112';

export interface VerifiedDbcPool {
  address: string;
  config: string;
  baseMint: string;
  quoteMint: typeof WSOL;
  baseVault: string;
  quoteVault: string;
  baseDecimals: number;
  baseTokenProgram: string;
  collectFeeMode: 0 | 1;
  isMigrated: boolean;
  verificationSlot: number;
}

function accountData(account: unknown, name: 'VirtualPool' | 'PoolConfig'): Record<string, unknown> {
  const record = recordField(account);
  requireThat(record.owner === DBC_PROGRAM && record.executable === false && Array.isArray(record.data) &&
    record.data[1] === 'base64' && typeof record.data[0] === 'string' && record.data[0].length < 24_000 &&
    /^[A-Za-z0-9+/]+={0,2}$/.test(record.data[0]), 'Invalid DBC account owner or encoding.');
  const bytes = Buffer.from(record.data[0], 'base64');
  requireThat(bytes.subarray(0, 8).equals(Buffer.from(dbcSchema.accounts[name])), 'Unsupported DBC account discriminator.');
  return decodeStruct(name, bytes.subarray(8));
}

export function readPoolState(account: unknown): Record<string, unknown> {
  return recordField(accountData(account, 'VirtualPool').pool_state);
}

export function parsedInfo(account: unknown, program: string, type: string): Record<string, unknown> {
  const record = recordField(account);
  const data = recordField(record.data);
  const parsed = recordField(data.parsed);
  requireThat(record.owner === program && record.executable === false && parsed.type === type, 'Invalid mint/vault account owner or type.');
  return recordField(parsed.info);
}

export function mintInfo(account: unknown, program: string): Record<string, unknown> {
  const info = parsedInfo(account, program, 'mint');
  requireThat(info.isInitialized === true && typeof info.decimals === 'number' && Number.isInteger(info.decimals) &&
    info.decimals >= 0 && info.decimals <= 18 && typeof info.supply === 'string' && /^\d{1,20}$/.test(info.supply) &&
    BigInt(info.supply) <= 18446744073709551615n, 'Invalid mint decimals, supply or initialization.');
  if (program === TOKEN_2022_PROGRAM) {
    requireThat(Array.isArray(info.extensions) && info.extensions.every((extension: unknown) => isRecord(extension) &&
      ['metadataPointer', 'tokenMetadata'].includes(String(extension.extension))), 'Unsupported Token-2022 extension: only metadata-only mints are supported.');
  }
  return info;
}

// Deterministic verifier also accepts saved RPC snapshots, keeping tests independent of credentials.
export function verifyPoolSnapshot(address: string, snapshot: unknown): VerifiedDbcPool {
  publicKey(address);
  const bundle = recordField(snapshot);
  const context = recordField(bundle.context);
  requireThat(Number.isSafeInteger(context.slot) && Number(context.slot) >= 0 && Array.isArray(bundle.addresses) &&
    Array.isArray(bundle.value) && bundle.addresses.length === 6 && bundle.value.length === 6, 'Invalid pool snapshot context.');
  const pool = readPoolState(bundle.value[0]);
  const configAddress = publicKey(pool.config);
  const baseMint = publicKey(pool.base_mint);
  const baseVault = publicKey(pool.base_vault);
  const quoteVault = publicKey(pool.quote_vault);
  const expected = [address, configAddress, baseMint, WSOL, baseVault, quoteVault];
  requireThat(bundle.addresses.every((key: unknown, index: number) => key === expected[index]), 'Snapshot addresses do not match the DBC pool.');
  requireThat(new Set(expected).size === expected.length, 'Pool account identities overlap.');
  const config = accountData(bundle.value[1], 'PoolConfig');
  requireThat(config.quote_mint === WSOL && (config.collect_fee_mode === 0 || config.collect_fee_mode === 1) &&
    config.transfer_fee_flag === 0, 'Only supported WSOL configurations without transfer fees can be decoded.');
  const baseAccount = recordField(bundle.value[2]);
  requireThat(baseAccount.owner === TOKEN_PROGRAM || baseAccount.owner === TOKEN_2022_PROGRAM, 'Unsupported base token program.');
  const base = mintInfo(baseAccount, baseAccount.owner);
  const quote = mintInfo(bundle.value[3], TOKEN_PROGRAM);
  requireThat(quote.decimals === 9 && base.decimals === config.token_decimal &&
    pool.pool_type === (baseAccount.owner === TOKEN_PROGRAM ? 0 : 1) && pool.pool_type === config.token_type,
    'Pool/config/mint token programs or decimals disagree.');
  requireThat(pool.is_migrated === 0 || pool.is_migrated === 1, 'Unknown migration state.');
  for (const [index, mint, program, decimals] of [[4, baseMint, baseAccount.owner, base.decimals], [5, WSOL, TOKEN_PROGRAM, 9]] as const) {
    const vault = parsedInfo(bundle.value[index], program, 'account');
    requireThat(vault.mint === mint && vault.owner === POOL_AUTHORITY && vault.state === 'initialized' &&
      recordField(vault.tokenAmount).decimals === decimals, 'Vault mint, authority or decimals do not match the pool.');
  }
  // Parsing all fixed fields above rejects unknown account sizes rather than silently trusting offsets.
  integerField(pool.activation_point);
  return Object.freeze({ address, config: configAddress, baseMint, quoteMint: WSOL, baseVault, quoteVault,
    baseDecimals: Number(base.decimals), baseTokenProgram: baseAccount.owner, collectFeeMode: config.collect_fee_mode,
    isMigrated: pool.is_migrated === 1, verificationSlot: Number(context.slot) });
}

export async function readRpc(rpcUrl: URL, method: string, params: unknown[], signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<unknown> {
  try {
    const response = await fetcher(rpcUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]) });
    const data: unknown = await response.json();
    requireThat(response.ok && isRecord(data) && data.jsonrpc === '2.0' && data.id === 1 && !('error' in data) && 'result' in data, 'Invalid RPC response.');
    return data.result;
  } catch {
    throw new Error('Read-only Meteora RPC request failed or was cancelled; check connection and usage limits.');
  }
}

export async function loadVerifiedDbcPool(rpcUrl: URL, address: string, signal: AbortSignal, commitment: 'confirmed' | 'finalized' = 'confirmed'): Promise<VerifiedDbcPool> {
  publicKey(address);
  const first = recordField(await readRpc(rpcUrl, 'getAccountInfo', [address, { encoding: 'base64', commitment }], signal));
  const state = readPoolState(first.value);
  const slot = recordField(first.context).slot;
  requireThat(Number.isSafeInteger(slot) && Number(slot) >= 0, 'Invalid pool observation slot.');
  const addresses = [address, publicKey(state.config), publicKey(state.base_mint), WSOL, publicKey(state.base_vault), publicKey(state.quote_vault)];
  const bundle = recordField(await readRpc(rpcUrl, 'getMultipleAccounts', [addresses,
    { encoding: 'jsonParsed', commitment, minContextSlot: slot }], signal));
  const verified = verifyPoolSnapshot(address, { ...bundle, addresses });
  requireThat(verified.verificationSlot >= Number(slot), 'Pool snapshot is older than its discovery read.');
  return verified;
}
