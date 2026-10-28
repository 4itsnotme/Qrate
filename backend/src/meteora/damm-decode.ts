import { dammSchema } from './damm-schema.js';
import { decodeBase58, decodeStruct, formatUnits, integerField, publicKey, recordField, requireThat } from './codec.js';
import { frames } from './decode.js';
import type { Frame } from './decode.js';
import { DAMM_AUTHORITY, DAMM_EVENT_AUTHORITY, DAMM_PROGRAM } from './damm-pool.js';
import type { VerifiedDammPool } from './damm-pool.js';
import { TOKEN_PROGRAM, TOKEN_2022_PROGRAM, WSOL } from './pool.js';
import { isRecord } from '../transaction-rpc.js';
import type { DecodeResult, MarketTrade } from './market-types.js';

const EVENT_CPI = Buffer.from([228, 69, 165, 46, 81, 203, 154, 29]);
const INSTRUCTIONS_SYSVAR = 'Sysvar1nstructions1111111111111111111111111';

function decodeFrame(frame: Frame, tx: Record<string, unknown>, pool: VerifiedDammPool, signature: string): MarketTrade {
  const instruction = frame.instruction;
  requireThat(typeof instruction.data === 'string' && Array.isArray(instruction.accounts), 'Missing DAMM instruction data/accounts.');
  const bytes = decodeBase58(instruction.data);
  const kind = (['swap', 'swap2'] as const).find(name => bytes.subarray(0, 8).equals(Buffer.from(dammSchema.instructions[name].discriminator)));
  requireThat(kind, 'Unsupported DAMM instruction/version.');
  const params = decodeStruct(kind === 'swap' ? 'SwapParameters' : 'SwapParameters2', bytes.subarray(8), dammSchema.types);
  requireThat(kind === 'swap' || params.swap_mode === 0, 'Only exact-input DAMM swaps are supported.');
  const amountIn = integerField(kind === 'swap' ? params.amount_in : params.amount_0);
  const minOut = integerField(kind === 'swap' ? params.minimum_amount_out : params.amount_1);
  const keys = instruction.accounts.map((key: unknown) => publicKey(key));
  requireThat(keys.length === 14 || (keys.length === 15 && keys[14] === INSTRUCTIONS_SYSVAR), 'Unexpected DAMM remaining accounts.');
  const accounts = Object.fromEntries(dammSchema.instructions[kind].accounts.map((name, index) => [name, keys[index]]));
  requireThat(accounts.pool === pool.address && accounts.pool_authority === DAMM_AUTHORITY && accounts.program === DAMM_PROGRAM &&
    accounts.event_authority === DAMM_EVENT_AUTHORITY && accounts.token_a_mint === pool.baseMint && accounts.token_b_mint === WSOL &&
    accounts.token_a_vault === pool.baseVault && accounts.token_b_vault === pool.quoteVault &&
    accounts.token_a_program === pool.baseTokenProgram && accounts.token_b_program === TOKEN_PROGRAM, 'DAMM instruction accounts disagree with the verified pool.');
  requireThat(accounts.referral_token_account === DAMM_PROGRAM, 'DAMM referrals are unsupported.');
  requireThat(accounts.input_token_account !== accounts.output_token_account &&
    ![pool.baseVault, pool.quoteVault].includes(accounts.input_token_account!) && ![pool.baseVault, pool.quoteVault].includes(accounts.output_token_account!),
    'Invalid DAMM user token account identities.');
  const events: Record<string, unknown>[] = [];
  for (const child of frame.children) {
    if (child.programId !== DAMM_PROGRAM || child.stackHeight !== frame.depth + 1 || typeof child.data !== 'string') continue;
    const data = decodeBase58(child.data);
    if (!data.subarray(0, 8).equals(EVENT_CPI) || !data.subarray(8, 16).equals(Buffer.from(dammSchema.events.EvtSwap2))) continue;
    requireThat(Array.isArray(child.accounts) && child.accounts.length === 1 && child.accounts[0] === DAMM_EVENT_AUTHORITY,
      'DAMM event authority mismatch.');
    events.push(decodeStruct('EvtSwap2', data.subarray(16), dammSchema.types));
  }
  requireThat(events.length === 1, 'Expected one authenticated DAMM swap event.');
  const event = events[0]!, parameters = recordField(event.params), result = recordField(event.swap_result);
  requireThat(event.pool === pool.address && (event.trade_direction === 0 || event.trade_direction === 1) && event.has_referral === false &&
    event.collect_fee_mode === pool.collectFeeMode && parameters.swap_mode === 0 && integerField(parameters.amount_0) === amountIn &&
    integerField(parameters.amount_1) === minOut, 'DAMM event identity, parameters or fee mode mismatch.');
  const input = integerField(result.included_fee_input_amount), output = integerField(result.output_amount);
  const claiming = integerField(result.claiming_fee), protocol = integerField(result.protocol_fee);
  const buy = event.trade_direction === 1, feesOnInput = pool.collectFeeMode === 1 && buy;
  requireThat(input > 0n && input === amountIn && output > 0n && output >= minOut && integerField(result.amount_left) === 0n &&
    integerField(result.referral_fee) === 0n && integerField(result.compounding_fee) === 0n && integerField(result.next_sqrt_price) > 0n &&
    input - integerField(result.excluded_fee_input_amount) === (feesOnInput ? claiming + protocol : 0n) &&
    integerField(event.included_transfer_fee_amount_in) === input && integerField(event.included_transfer_fee_amount_out) === output &&
    integerField(event.excluded_transfer_fee_amount_out) === output, 'DAMM quantities, fees or transfer-fee evidence disagree.');
  const tokenChildren = frame.children.filter(child => child.stackHeight === frame.depth + 1 &&
    [TOKEN_PROGRAM, TOKEN_2022_PROGRAM].includes(String(child.programId)));
  requireThat(tokenChildren.length === 2, 'Expected two direct DAMM token transfers.');
  const expected = [
    { source: accounts.input_token_account, destination: buy ? pool.quoteVault : pool.baseVault, authority: accounts.payer,
      mint: buy ? WSOL : pool.baseMint, amount: input, decimals: buy ? 9 : pool.baseDecimals, program: buy ? TOKEN_PROGRAM : pool.baseTokenProgram },
    { source: buy ? pool.baseVault : pool.quoteVault, destination: accounts.output_token_account, authority: DAMM_AUTHORITY,
      mint: buy ? pool.baseMint : WSOL, amount: output, decimals: buy ? pool.baseDecimals : 9, program: buy ? pool.baseTokenProgram : TOKEN_PROGRAM },
  ];
  const remaining = [...tokenChildren];
  for (const transfer of expected) {
    const index = remaining.findIndex(child => {
      if (!isRecord(child.parsed) || child.parsed.type !== 'transferChecked' || !isRecord(child.parsed.info)) return false;
      const info = child.parsed.info;
      return child.programId === transfer.program && info.source === transfer.source && info.destination === transfer.destination &&
        info.authority === transfer.authority && info.mint === transfer.mint && isRecord(info.tokenAmount) &&
        info.tokenAmount.amount === transfer.amount.toString() && info.tokenAmount.decimals === transfer.decimals;
    });
    requireThat(index >= 0, 'DAMM event amounts do not match token transfers.'); remaining.splice(index, 1);
  }
  const baseRaw = buy ? output : input, lamports = buy ? input : output;
  const numerator = lamports * 10n ** BigInt(pool.baseDecimals), denominator = baseRaw * 1_000_000_000n;
  const meta = recordField(tx.meta);
  requireThat(Number.isSafeInteger(meta.fee) && Number(meta.fee) >= 0, 'Missing network fee evidence.');
  return { id: `mainnet-beta:${signature}:${frame.path}`, network: 'mainnet-beta', protocol: 'meteora-damm-v2', signature,
    instructionPath: frame.path, pool: pool.address, tokenMint: pool.baseMint, quoteMint: WSOL, user: accounts.payer!, side: buy ? 'buy' : 'sell',
    tokenAmountRaw: baseRaw.toString(), tokenAmount: formatUnits(baseRaw, pool.baseDecimals), solAmountLamports: lamports.toString(), solAmount: formatUnits(lamports, 9),
    priceSolPerToken: formatUnits(numerator * 10n ** 18n / denominator, 18), priceExact: { numerator: numerator.toString(), denominator: denominator.toString() },
    priceBasis: 'user-execution-amounts-including-damm-fees-excluding-network-and-router-fees',
    fees: { mint: pool.collectFeeMode === 0 && buy ? pool.baseMint : WSOL, tradingRaw: claiming.toString(), protocolRaw: protocol.toString(), referralRaw: '0' },
    transactionNetworkFeeLamports: String(meta.fee), slot: Number(tx.slot), timestamp: tx.blockTime as number | null,
    eventTimestamp: integerField(event.current_timestamp).toString(), verificationSlot: pool.verificationSlot };
}

export function decodeDammTrades(transaction: unknown, pool: VerifiedDammPool): DecodeResult {
  const trades: MarketTrade[] = [], rejected: DecodeResult['rejected'] = [];
  try {
    const tx = recordField(transaction);
    requireThat(recordField(tx.meta).err === null, 'Failed transaction or missing success status.');
    requireThat(Number.isSafeInteger(tx.slot) && Number(tx.slot) >= 0 && (tx.blockTime === null ||
      (Number.isSafeInteger(tx.blockTime) && Number(tx.blockTime) >= 0)), 'Invalid slot or block time.');
    const signatures = recordField(tx.transaction).signatures;
    requireThat(Array.isArray(signatures) && typeof signatures[0] === 'string' && decodeBase58(signatures[0], 64).length === 64, 'Missing transaction signature.');
    for (const frame of frames(tx)) {
      if (frame.instruction.programId !== DAMM_PROGRAM || !Array.isArray(frame.instruction.accounts) || !frame.instruction.accounts.includes(pool.address)) continue;
      // Known non-swap instructions are not trades (initialization, liquidity, claims).
      const data = typeof frame.instruction.data === 'string' ? decodeBase58(frame.instruction.data) : Buffer.alloc(0);
      const isSwap = ['swap', 'swap2'].some(name => data.subarray(0, 8).equals(Buffer.from(dammSchema.instructions[name as 'swap' | 'swap2'].discriminator)));
      if (!isSwap) {
        const known = Object.values(dammSchema.instructions).some(def => data.subarray(0, 8).equals(Buffer.from(def.discriminator)));
        if (!known) rejected.push({ instructionPath: frame.path, reason: 'Unsupported DAMM invocation; no trade inferred.' });
        continue;
      }
      try { trades.push(decodeFrame(frame, tx, pool, signatures[0])); }
      catch (error) { rejected.push({ instructionPath: frame.path, reason: error instanceof Error ? error.message : 'Unsupported DAMM invocation.' }); }
    }
  } catch (error) { rejected.push({ instructionPath: 'transaction', reason: error instanceof Error ? error.message : 'Invalid transaction.' }); }
  return { trades, rejected };
}
