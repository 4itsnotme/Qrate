import { dbcSchema } from './dbc-schema.js';
import { decodeBase58, decodeStruct, formatUnits, integerField, publicKey, recordField, requireThat } from './codec.js';
import { DBC_PROGRAM, EVENT_AUTHORITY, POOL_AUTHORITY, TOKEN_PROGRAM, TOKEN_2022_PROGRAM, WSOL } from './pool.js';
import type { VerifiedDbcPool } from './pool.js';
import { isRecord } from '../transaction-rpc.js';

const EVENT_CPI = Buffer.from([228, 69, 165, 46, 81, 203, 154, 29]);
const INSTRUCTIONS_SYSVAR = 'Sysvar1nstructions1111111111111111111111111';
export interface Frame { instruction: Record<string, unknown>; children: Record<string, unknown>[]; depth: number; path: string }

export interface DbcTrade {
  id: string;
  protocol: 'meteora-dbc';
  network: 'mainnet-beta';
  signature: string;
  instructionPath: string;
  pool: string;
  tokenMint: string;
  quoteMint: typeof WSOL;
  user: string;
  side: 'buy' | 'sell';
  tokenAmountRaw: string;
  tokenAmount: string;
  solAmountLamports: string;
  solAmount: string;
  priceSolPerToken: string;
  priceExact: { numerator: string; denominator: string };
  priceBasis: string;
  fees: { mint: string; tradingRaw: string; protocolRaw: string; referralRaw: string };
  transactionNetworkFeeLamports: string;
  slot: number;
  timestamp: number | null;
  eventTimestamp: string;
  verificationSlot: number;
}

export function frames(transaction: Record<string, unknown>): Frame[] {
  const message = recordField(recordField(transaction.transaction).message);
  const meta = recordField(transaction.meta);
  requireThat(Array.isArray(message.instructions) && Array.isArray(meta.innerInstructions), 'Missing instruction/CPI recording.');
  const groups = new Map<number, Record<string, unknown>[]>();
  for (const value of meta.innerInstructions) {
    const group = recordField(value);
    requireThat(typeof group.index === 'number' && Number.isInteger(group.index) && group.index >= 0 &&
      group.index < message.instructions.length && !groups.has(group.index) && Array.isArray(group.instructions), 'Invalid or duplicate CPI group.');
    let previousDepth = 1;
    const children = group.instructions.map((value: unknown) => {
      const instruction = recordField(value);
      requireThat(typeof instruction.stackHeight === 'number' && Number.isInteger(instruction.stackHeight) &&
        instruction.stackHeight >= 2 && instruction.stackHeight <= 64 && instruction.stackHeight <= previousDepth + 1,
        'Missing or inconsistent CPI stack heights.');
      previousDepth = instruction.stackHeight;
      return instruction;
    });
    groups.set(group.index, children);
  }
  const result: Frame[] = [];
  message.instructions.forEach((value: unknown, index: number) => {
    const children = groups.get(index) ?? [];
    result.push({ instruction: recordField(value), children, depth: 1, path: String(index) });
    children.forEach((instruction, childIndex) => {
      const depth = Number(instruction.stackHeight);
      let end = childIndex + 1;
      while (end < children.length && Number(children[end]!.stackHeight) > depth) end++;
      result.push({ instruction, children: children.slice(childIndex + 1, end), depth, path: `${index}.${childIndex}` });
    });
  });
  return result;
}

function readEvent(frame: Frame, name: 'EvtSwap2' | 'EvtSwap3', required: boolean): Record<string, unknown> | undefined {
  const matches: Buffer[] = [];
  for (const instruction of frame.children) {
    if (instruction.programId !== DBC_PROGRAM || instruction.stackHeight !== frame.depth + 1 || typeof instruction.data !== 'string') continue;
    const bytes = decodeBase58(instruction.data);
    if (!bytes.subarray(0, 8).equals(EVENT_CPI) || !bytes.subarray(8, 16).equals(Buffer.from(dbcSchema.events[name]))) continue;
    requireThat(Array.isArray(instruction.accounts) && instruction.accounts.length === 1 &&
      instruction.accounts[0] === EVENT_AUTHORITY, 'Event authority does not match DBC.');
    matches.push(bytes.subarray(16));
  }
  requireThat(matches.length <= 1 && (!required || matches.length === 1), `Expected one ${name} event for this invocation.`);
  return matches[0] ? decodeStruct(name, matches[0]) : undefined;
}

function decodeFrame(frame: Frame, transaction: Record<string, unknown>, pool: VerifiedDbcPool, signature: string): DbcTrade {
  const instruction = frame.instruction;
  requireThat(typeof instruction.data === 'string' && Array.isArray(instruction.accounts), 'Missing DBC instruction data/accounts.');
  const bytes = decodeBase58(instruction.data);
  const kind = (['swap', 'swap2'] as const).find((name) => bytes.subarray(0, 8).equals(Buffer.from(dbcSchema.instructions[name].discriminator)));
  requireThat(kind, 'Unsupported DBC instruction/version.');
  const params = decodeStruct(kind === 'swap' ? 'SwapParameters' : 'SwapParameters2', bytes.subarray(8));
  const amountIn = integerField(kind === 'swap' ? params.amount_in : params.amount_0);
  const minimumOut = integerField(kind === 'swap' ? params.minimum_amount_out : params.amount_1);
  requireThat(kind === 'swap' || params.swap_mode === 0, 'Only exact-input DBC swaps are supported in this slice.');
  const keys = instruction.accounts.map((value: unknown) => publicKey(value));
  requireThat(keys.length === 15 || (keys.length === 16 && keys[15] === INSTRUCTIONS_SYSVAR), 'Unexpected DBC remaining accounts.');
  const definition = dbcSchema.instructions[kind];
  const accounts = Object.fromEntries(definition.accounts.map((name, index) => [name, keys[index]]));
  requireThat(accounts.pool_authority === POOL_AUTHORITY && accounts.event_authority === EVENT_AUTHORITY &&
    accounts.program === DBC_PROGRAM && accounts.pool === pool.address && accounts.config === pool.config &&
    accounts.base_mint === pool.baseMint && accounts.quote_mint === WSOL && accounts.base_vault === pool.baseVault &&
    accounts.quote_vault === pool.quoteVault && accounts.token_base_program === pool.baseTokenProgram &&
    accounts.token_quote_program === TOKEN_PROGRAM, 'Instruction accounts do not match the verified DBC pool.');
  requireThat(accounts.referral_token_account === DBC_PROGRAM, 'Referral swaps are not supported in this slice.');
  requireThat(accounts.input_token_account !== accounts.output_token_account &&
    ![pool.baseVault, pool.quoteVault].includes(accounts.input_token_account!) &&
    ![pool.baseVault, pool.quoteVault].includes(accounts.output_token_account!), 'Invalid user token account identities.');

  const event = readEvent(frame, 'EvtSwap2', true)!;
  const event3 = readEvent(frame, 'EvtSwap3', false);
  requireThat(event.pool === pool.address && event.config === pool.config && event.has_referral === false &&
    (event.trade_direction === 0 || event.trade_direction === 1), 'Swap event pool, direction or referral mismatch.');
  const parameters = recordField(event.swap_parameters);
  requireThat(parameters.swap_mode === 0 && integerField(parameters.amount_0) === amountIn &&
    integerField(parameters.amount_1) === minimumOut, 'Swap parameters disagree with instruction bytes.');
  const result = recordField(event.swap_result);
  const input = integerField(result.included_fee_input_amount);
  const excludedInput = integerField(result.excluded_fee_input_amount);
  const output = integerField(result.output_amount);
  const tradingFee = integerField(result.trading_fee);
  const protocolFee = integerField(result.protocol_fee);
  const referralFee = integerField(result.referral_fee);
  const fees = tradingFee + protocolFee + referralFee;
  const buy = event.trade_direction === 1;
  const feeOnBase = pool.collectFeeMode === 1 && buy;
  const feesOnInput = pool.collectFeeMode === 0 && buy;
  requireThat(input > 0n && output > 0n && input <= amountIn && output >= minimumOut && referralFee === 0n &&
    integerField(result.amount_left) === amountIn - input && input - excludedInput === (feesOnInput ? fees : 0n) &&
    integerField(result.next_sqrt_price) > 0n, 'Invalid swap amounts, fee accounting or minimum output.');
  if (event3) {
    requireThat(event3.pool === event.pool && event3.config === event.config && event3.trade_direction === event.trade_direction &&
      event3.swap_mode === 0 && event3.has_referral === false && event3.fee_on_base_token === feeOnBase,
      'Newer swap event identity or fee mode disagrees.');
    for (const field of ['included_transfer_fee_amount_in', 'excluded_transfer_fee_amount_in']) {
      requireThat(integerField(event3[field]) === input, 'Transfer-fee input is unsupported or inconsistent.');
    }
    for (const field of ['included_transfer_fee_amount_out', 'excluded_transfer_fee_amount_out']) {
      requireThat(integerField(event3[field]) === output, 'Transfer-fee output is unsupported or inconsistent.');
    }
    for (const field of ['trading_fee', 'protocol_fee', 'referral_fee', 'next_sqrt_price']) {
      requireThat(integerField(event3[field]) === integerField(result[field]), 'Swap event versions disagree.');
    }
    requireThat(integerField(event3.quote_reserve) === integerField(event.quote_reserve_amount) &&
      integerField(event3.current_timestamp) === integerField(event.current_timestamp), 'Swap event reserve/timestamp mismatch.');
  }

  const tokenChildren = frame.children.filter((child) => child.stackHeight === frame.depth + 1 &&
    [TOKEN_PROGRAM, TOKEN_2022_PROGRAM].includes(String(child.programId)));
  requireThat(tokenChildren.length === 2, 'Expected exactly two direct token transfers for this supported swap.');
  const expected = [
    { source: accounts.input_token_account, destination: buy ? pool.quoteVault : pool.baseVault,
      authority: accounts.payer, mint: buy ? WSOL : pool.baseMint, amount: input,
      decimals: buy ? 9 : pool.baseDecimals, program: buy ? TOKEN_PROGRAM : pool.baseTokenProgram },
    { source: buy ? pool.baseVault : pool.quoteVault, destination: accounts.output_token_account,
      authority: POOL_AUTHORITY, mint: buy ? pool.baseMint : WSOL, amount: output,
      decimals: buy ? pool.baseDecimals : 9, program: buy ? pool.baseTokenProgram : TOKEN_PROGRAM },
  ];
  const remaining = [...tokenChildren];
  for (const transfer of expected) {
    const index = remaining.findIndex((child) => {
      if (!isRecord(child.parsed) || child.parsed.type !== 'transferChecked' || !isRecord(child.parsed.info)) return false;
      const info = child.parsed.info;
      return child.programId === transfer.program && info.source === transfer.source && info.destination === transfer.destination &&
        info.authority === transfer.authority && info.mint === transfer.mint && isRecord(info.tokenAmount) &&
        info.tokenAmount.amount === transfer.amount.toString() && info.tokenAmount.decimals === transfer.decimals;
    });
    requireThat(index >= 0, 'Swap event amounts do not match authenticated token transfers.');
    remaining.splice(index, 1);
  }

  const baseRaw = buy ? output : input;
  const lamports = buy ? input : output;
  const numerator = lamports * 10n ** BigInt(pool.baseDecimals);
  const denominator = baseRaw * 1_000_000_000n;
  const meta = recordField(transaction.meta);
  requireThat(Number.isSafeInteger(meta.fee) && Number(meta.fee) >= 0, 'Missing transaction fee evidence.');
  return { id: `mainnet-beta:${signature}:${frame.path}`, protocol: 'meteora-dbc', network: 'mainnet-beta', signature,
    instructionPath: frame.path, pool: pool.address, tokenMint: pool.baseMint, quoteMint: WSOL, user: accounts.payer!,
    side: buy ? 'buy' : 'sell', tokenAmountRaw: baseRaw.toString(), tokenAmount: formatUnits(baseRaw, pool.baseDecimals),
    solAmountLamports: lamports.toString(), solAmount: formatUnits(lamports, 9),
    priceSolPerToken: formatUnits(numerator * 10n ** 18n / denominator, 18),
    priceExact: { numerator: numerator.toString(), denominator: denominator.toString() },
    priceBasis: 'user-execution-amounts-including-dbc-fees-excluding-network-and-router-fees',
    fees: { mint: feeOnBase ? pool.baseMint : WSOL, tradingRaw: tradingFee.toString(), protocolRaw: protocolFee.toString(), referralRaw: referralFee.toString() },
    transactionNetworkFeeLamports: String(meta.fee), slot: Number(transaction.slot), timestamp: transaction.blockTime as number | null,
    eventTimestamp: integerField(event.current_timestamp).toString(), verificationSlot: pool.verificationSlot };
}

export function decodeDbcTrades(transaction: unknown, pool: VerifiedDbcPool): {
  trades: DbcTrade[];
  rejected: { instructionPath: string; reason: string }[];
} {
  const trades: DbcTrade[] = [];
  const rejected: { instructionPath: string; reason: string }[] = [];
  try {
    const tx = recordField(transaction);
    requireThat(recordField(tx.meta).err === null, 'Failed transaction or missing success status.');
    requireThat(Number.isSafeInteger(tx.slot) && Number(tx.slot) >= 0 &&
      (tx.blockTime === null || (Number.isSafeInteger(tx.blockTime) && Number(tx.blockTime) >= 0)), 'Invalid slot or block time.');
    const signatures = recordField(tx.transaction).signatures;
    requireThat(Array.isArray(signatures) && typeof signatures[0] === 'string' && decodeBase58(signatures[0], 64).length === 64, 'Missing transaction signature.');
    for (const frame of frames(tx)) {
      if (frame.instruction.programId !== DBC_PROGRAM || !Array.isArray(frame.instruction.accounts) || !frame.instruction.accounts.includes(pool.address)) continue;
      try { trades.push(decodeFrame(frame, tx, pool, signatures[0])); }
      catch (error) { rejected.push({ instructionPath: frame.path, reason: error instanceof Error ? error.message : 'Unsupported DBC invocation.' }); }
    }
  } catch (error) {
    rejected.push({ instructionPath: 'transaction', reason: error instanceof Error ? error.message : 'Invalid transaction.' });
  }
  return { trades, rejected };
}
