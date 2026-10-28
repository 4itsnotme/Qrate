// Tracking configuration: keep token and pool addresses together instead of scattering them in code.
export interface TrackedToken {
  protocol: "meteora-dbc";
  network: "mainnet-beta";
  mint: string;
  decimals: number;
  candidatePool: {
    address: string;
    programId: string;
    quoteMint: string;
  };
}

// No implicit Mainnet target. The old PumpSwap sample was outside Qrate's Meteora scope.
// market:listen takes --pool and verifies its owner/config/mints/vaults before subscribing.
// The raw listen command can still use an explicitly configured Meteora reference here.
export const trackedTokens: readonly TrackedToken[] = [];
