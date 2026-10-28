import type { VerifiedDbcPool } from './pool.js';
import type { VerifiedDammPool } from './damm-pool.js';
import type { DbcTrade } from './decode.js';

export type MarketPool = VerifiedDbcPool | VerifiedDammPool;
export type MarketTrade = Omit<DbcTrade, 'protocol'> & { protocol: 'meteora-dbc' | 'meteora-damm-v2' };
export interface DecodeResult { trades: MarketTrade[]; rejected: { instructionPath: string; reason: string }[] }
export function isDammPool(pool: MarketPool): pool is VerifiedDammPool { return 'protocol' in pool && pool.protocol === 'meteora-damm-v2'; }
