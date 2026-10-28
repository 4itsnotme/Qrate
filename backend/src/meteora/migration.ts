import { dammSchema } from './damm-schema.js';
import { decodeBase58, publicKey, recordField, requireThat } from './codec.js';
import { frames } from './decode.js';
import type { Frame } from './decode.js';
import { DBC_PROGRAM, POOL_AUTHORITY, TOKEN_PROGRAM, TOKEN_2022_PROGRAM, WSOL } from './pool.js';
import type { VerifiedDbcPool } from './pool.js';
import { DAMM_AUTHORITY, DAMM_EVENT_AUTHORITY, DAMM_PROGRAM } from './damm-pool.js';
import type { VerifiedDammPool } from './damm-pool.js';

export interface VerifiedMigration {
  sourcePool: string; destinationPool: string; signature: string; slot: number; instructionPath: string; destination: VerifiedDammPool;
}

function candidate(tx: Record<string, unknown>, pool: VerifiedDbcPool): { frame: Frame; accounts: Record<string, string> } | undefined {
  requireThat(recordField(tx.meta).err === null, 'Migration transaction must succeed.');
  const matches = frames(tx).filter(frame => frame.instruction.programId === DBC_PROGRAM &&
    Array.isArray(frame.instruction.accounts) && frame.instruction.accounts.includes(pool.address) &&
    typeof frame.instruction.data === 'string' && decodeBase58(frame.instruction.data).subarray(0, 8).equals(Buffer.from(dammSchema.migration.discriminator)));
  requireThat(matches.length <= 1, 'Ambiguous DBC migration receipt.');
  if (!matches[0]) return;
  const frame = matches[0], data = decodeBase58(String(frame.instruction.data));
  const keys = (frame.instruction.accounts as unknown[]).map(key => publicKey(key));
  // Three remaining accounts are the current dynamic-config migration extension.
  requireThat(data.length === 8 && (keys.length === 25 || keys.length === 28), 'Unsupported DBC migration layout.');
  const accounts = Object.fromEntries(dammSchema.migration.accounts.map((name, index) => [name, keys[index]! ]));
  requireThat(accounts.virtual_pool === pool.address && accounts.config === pool.config && accounts.base_mint === pool.baseMint &&
    accounts.quote_mint === WSOL && accounts.base_vault === pool.baseVault && accounts.quote_vault === pool.quoteVault &&
    accounts.pool_authority === POOL_AUTHORITY && accounts.damm_pool_authority === DAMM_AUTHORITY &&
    accounts.amm_program === DAMM_PROGRAM && accounts.token_base_program === pool.baseTokenProgram &&
    accounts.token_quote_program === TOKEN_PROGRAM && accounts.token_2022_program === TOKEN_2022_PROGRAM &&
    accounts.damm_event_authority === DAMM_EVENT_AUTHORITY && accounts.system_program === '11111111111111111111111111111111',
    'DBC migration accounts do not match the verified source pool.');
  return { frame, accounts };
}

export function migrationDestination(transaction: unknown, pool: VerifiedDbcPool): string | undefined {
  return candidate(recordField(transaction), pool)?.accounts.pool;
}

export function verifyMigration(transaction: unknown, source: VerifiedDbcPool, destination: VerifiedDammPool): VerifiedMigration {
  const tx = recordField(transaction), found = candidate(tx, source);
  requireThat(found && found.accounts.pool === destination.address && destination.baseMint === source.baseMint &&
    destination.quoteMint === source.quoteMint && destination.baseDecimals === source.baseDecimals &&
    destination.baseTokenProgram === source.baseTokenProgram && found.accounts.token_a_vault === destination.baseVault &&
    found.accounts.token_b_vault === destination.quoteVault, 'Migration destination does not match source token/vault identities.');
  const initializations = found.frame.children.filter(child => child.programId === DAMM_PROGRAM &&
    child.stackHeight === found.frame.depth + 1 && typeof child.data === 'string' &&
    ['initialize_pool', 'initialize_pool_with_dynamic_config'].some(name => decodeBase58(child.data as string).subarray(0, 8)
      .equals(Buffer.from(dammSchema.instructions[name as 'initialize_pool'].discriminator))));
  requireThat(initializations.length === 1, 'Expected one direct DAMM initialization CPI in the migration.');
  const init = initializations[0]!, bytes = decodeBase58(String(init.data));
  const kind = bytes.subarray(0, 8).equals(Buffer.from(dammSchema.instructions.initialize_pool.discriminator)) ? 'initialize_pool' : 'initialize_pool_with_dynamic_config';
  const definition = dammSchema.instructions[kind];
  requireThat(Array.isArray(init.accounts) && init.accounts.length >= definition.accounts.length, 'Missing DAMM initialization accounts.');
  const keys = init.accounts.map((key: unknown) => publicKey(key));
  const accounts = Object.fromEntries(definition.accounts.map((name, index) => [name, keys[index]]));
  requireThat(accounts.creator === POOL_AUTHORITY && accounts.payer === POOL_AUTHORITY && accounts.pool_authority === DAMM_AUTHORITY &&
    accounts.pool === destination.address && accounts.token_a_mint === destination.baseMint && accounts.token_b_mint === WSOL &&
    accounts.token_a_vault === destination.baseVault && accounts.token_b_vault === destination.quoteVault &&
    accounts.payer_token_a === source.baseVault && accounts.payer_token_b === source.quoteVault &&
    accounts.token_a_program === destination.baseTokenProgram && accounts.token_b_program === TOKEN_PROGRAM &&
    accounts.event_authority === DAMM_EVENT_AUTHORITY && accounts.program === DAMM_PROGRAM,
    'DAMM initialization CPI does not prove the source-to-destination migration.');
  const signatures = recordField(tx.transaction).signatures;
  requireThat(Array.isArray(signatures) && typeof signatures[0] === 'string' && decodeBase58(signatures[0], 64).length === 64 &&
    Number.isSafeInteger(tx.slot) && Number(tx.slot) >= 0 && destination.verificationSlot >= Number(tx.slot), 'Invalid finalized migration identity/snapshot slot.');
  return { sourcePool: source.address, destinationPool: destination.address, signature: signatures[0], slot: Number(tx.slot), instructionPath: found.frame.path, destination };
}
