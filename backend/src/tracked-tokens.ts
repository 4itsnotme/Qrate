// Tracking configuration: keep token and pool addresses together instead of scattering them in code.
export interface TrackedToken {
  network: "mainnet-beta";
  mint: string;
  decimals: number;
  candidatePool: {
    address: string;
    programId: string;
    quoteMint: string;
  };
}

// First read-only target chosen by the owner. This array can hold more tokens later.
// Helius confirmed the mint's decimals and the candidate pool's owner program.
// DexScreener discovered the pair; the swap decoder must still verify pool mint fields.
export const trackedTokens: readonly TrackedToken[] = [
  {
    network: "mainnet-beta",
    mint: "H74CYmXgMkYHYuSRsZt6RJb4NYp2u72Vw8BS5huApump",
    decimals: 6,
    candidatePool: {
      address: "AFaYrFH7hUYnkv5mbvbnRHwX29M9JzUL3ySGtQz69AUv",
      programId: "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA",
      quoteMint: "So11111111111111111111111111111111111111112",
    },
  },
];
