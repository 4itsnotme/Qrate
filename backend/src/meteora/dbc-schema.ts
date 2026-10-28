// Data-only subset of Meteora SDK IDL 0.2.2 (SDK 2.0.0).
// Pinned commit 3a965ec0c0a527c2be3c48b8b479366705bf4926; see backend/vendor/meteora for MIT license/provenance.
export const dbcSchema = {
  "address": "dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN",
  "accounts": {
    "PoolConfig": [
      26,
      108,
      14,
      123,
      116,
      230,
      129,
      43
    ],
    "VirtualPool": [
      213,
      224,
      5,
      209,
      98,
      69,
      119,
      92
    ]
  },
  "events": {
    "EvtSwap2": [
      189,
      66,
      51,
      168,
      38,
      80,
      117,
      153
    ],
    "EvtSwap3": [
      187,
      119,
      248,
      13,
      175,
      255,
      64,
      63
    ]
  },
  "instructions": {
    "swap": {
      "discriminator": [
        248,
        198,
        158,
        145,
        225,
        117,
        135,
        200
      ],
      "accounts": [
        "pool_authority",
        "config",
        "pool",
        "input_token_account",
        "output_token_account",
        "base_vault",
        "quote_vault",
        "base_mint",
        "quote_mint",
        "payer",
        "token_base_program",
        "token_quote_program",
        "referral_token_account",
        "event_authority",
        "program"
      ]
    },
    "swap2": {
      "discriminator": [
        65,
        75,
        63,
        76,
        235,
        91,
        91,
        136
      ],
      "accounts": [
        "pool_authority",
        "config",
        "pool",
        "input_token_account",
        "output_token_account",
        "base_vault",
        "quote_vault",
        "base_mint",
        "quote_mint",
        "payer",
        "token_base_program",
        "token_quote_program",
        "referral_token_account",
        "event_authority",
        "program"
      ]
    }
  },
  "types": {
    "VirtualPool": [
      {
        "name": "pool_state",
        "type": {
          "defined": {
            "name": "PoolState"
          }
        }
      }
    ],
    "PoolState": [
      {
        "name": "volatility_tracker",
        "type": {
          "defined": {
            "name": "VolatilityTracker"
          }
        }
      },
      {
        "name": "config",
        "type": "pubkey"
      },
      {
        "name": "creator",
        "type": "pubkey"
      },
      {
        "name": "base_mint",
        "type": "pubkey"
      },
      {
        "name": "base_vault",
        "type": "pubkey"
      },
      {
        "name": "quote_vault",
        "type": "pubkey"
      },
      {
        "name": "base_reserve",
        "type": "u64"
      },
      {
        "name": "quote_reserve",
        "type": "u64"
      },
      {
        "name": "protocol_base_fee",
        "type": "u64"
      },
      {
        "name": "protocol_quote_fee",
        "type": "u64"
      },
      {
        "name": "partner_base_fee",
        "type": "u64"
      },
      {
        "name": "partner_quote_fee",
        "type": "u64"
      },
      {
        "name": "sqrt_price",
        "type": "u128"
      },
      {
        "name": "activation_point",
        "type": "u64"
      },
      {
        "name": "pool_type",
        "type": "u8"
      },
      {
        "name": "is_migrated",
        "type": "u8"
      },
      {
        "name": "is_partner_withdraw_surplus",
        "type": "u8"
      },
      {
        "name": "is_protocol_withdraw_surplus",
        "type": "u8"
      },
      {
        "name": "migration_progress",
        "type": "u8"
      },
      {
        "name": "is_withdraw_leftover",
        "type": "u8"
      },
      {
        "name": "is_creator_withdraw_surplus",
        "type": "u8"
      },
      {
        "name": "migration_fee_withdraw_status",
        "type": "u8"
      },
      {
        "name": "metrics",
        "type": {
          "defined": {
            "name": "PoolMetrics"
          }
        }
      },
      {
        "name": "finish_curve_timestamp",
        "type": "u64"
      },
      {
        "name": "creator_base_fee",
        "type": "u64"
      },
      {
        "name": "creator_quote_fee",
        "type": "u64"
      },
      {
        "name": "legacy_creation_fee_bits",
        "type": "u8"
      },
      {
        "name": "creation_fee_bits",
        "type": "u8"
      },
      {
        "name": "has_swap",
        "type": "u8"
      },
      {
        "name": "_padding_0",
        "type": {
          "array": [
            "u8",
            5
          ]
        }
      },
      {
        "name": "protocol_liquidity_migration_fee_bps",
        "type": "u16"
      },
      {
        "name": "_padding_1",
        "type": {
          "array": [
            "u8",
            6
          ]
        }
      },
      {
        "name": "protocol_migration_base_fee_amount",
        "type": "u64"
      },
      {
        "name": "protocol_migration_quote_fee_amount",
        "type": "u64"
      },
      {
        "name": "_padding_2",
        "type": {
          "array": [
            "u64",
            3
          ]
        }
      }
    ],
    "VolatilityTracker": [
      {
        "name": "last_update_timestamp",
        "type": "u64"
      },
      {
        "name": "padding",
        "type": {
          "array": [
            "u8",
            8
          ]
        }
      },
      {
        "name": "sqrt_price_reference",
        "type": "u128"
      },
      {
        "name": "volatility_accumulator",
        "type": "u128"
      },
      {
        "name": "volatility_reference",
        "type": "u128"
      }
    ],
    "PoolMetrics": [
      {
        "name": "total_protocol_base_fee",
        "type": "u64"
      },
      {
        "name": "total_protocol_quote_fee",
        "type": "u64"
      },
      {
        "name": "total_trading_base_fee",
        "type": "u64"
      },
      {
        "name": "total_trading_quote_fee",
        "type": "u64"
      }
    ],
    "PoolConfig": [
      {
        "name": "quote_mint",
        "type": "pubkey"
      },
      {
        "name": "fee_claimer",
        "type": "pubkey"
      },
      {
        "name": "leftover_receiver",
        "type": "pubkey"
      },
      {
        "name": "pool_fees",
        "type": {
          "defined": {
            "name": "PoolFeesConfig"
          }
        }
      },
      {
        "name": "partner_liquidity_vesting_info",
        "type": {
          "defined": {
            "name": "LiquidityVestingInfo"
          }
        }
      },
      {
        "name": "creator_liquidity_vesting_info",
        "type": {
          "defined": {
            "name": "LiquidityVestingInfo"
          }
        }
      },
      {
        "name": "transfer_fee_basis_points",
        "type": "u16"
      },
      {
        "name": "transfer_fee_withheld_authority",
        "type": "u8"
      },
      {
        "name": "migrated_transfer_fee_authority_option",
        "type": "u8"
      },
      {
        "name": "transfer_fee_flag",
        "type": "u8"
      },
      {
        "name": "padding_0",
        "type": {
          "array": [
            "u8",
            9
          ]
        }
      },
      {
        "name": "padding_1",
        "type": "u16"
      },
      {
        "name": "collect_fee_mode",
        "type": "u8"
      },
      {
        "name": "migration_option",
        "type": "u8"
      },
      {
        "name": "activation_type",
        "type": "u8"
      },
      {
        "name": "token_decimal",
        "type": "u8"
      },
      {
        "name": "version",
        "type": "u8"
      },
      {
        "name": "token_type",
        "type": "u8"
      },
      {
        "name": "quote_token_flag",
        "type": "u8"
      },
      {
        "name": "partner_permanent_locked_liquidity_percentage",
        "type": "u8"
      },
      {
        "name": "partner_liquidity_percentage",
        "type": "u8"
      },
      {
        "name": "creator_permanent_locked_liquidity_percentage",
        "type": "u8"
      },
      {
        "name": "creator_liquidity_percentage",
        "type": "u8"
      },
      {
        "name": "migration_fee_option",
        "type": "u8"
      },
      {
        "name": "fixed_token_supply_flag",
        "type": "u8"
      },
      {
        "name": "creator_trading_fee_percentage",
        "type": "u8"
      },
      {
        "name": "token_update_authority",
        "type": "u8"
      },
      {
        "name": "migration_fee_percentage",
        "type": "u8"
      },
      {
        "name": "creator_migration_fee_percentage",
        "type": "u8"
      },
      {
        "name": "padding_2",
        "type": {
          "array": [
            "u8",
            7
          ]
        }
      },
      {
        "name": "swap_base_amount",
        "type": "u64"
      },
      {
        "name": "migration_quote_threshold",
        "type": "u64"
      },
      {
        "name": "migration_base_threshold",
        "type": "u64"
      },
      {
        "name": "migration_sqrt_price",
        "type": "u128"
      },
      {
        "name": "locked_vesting_config",
        "type": {
          "defined": {
            "name": "LockedVestingConfig"
          }
        }
      },
      {
        "name": "pre_migration_token_supply",
        "type": "u64"
      },
      {
        "name": "post_migration_token_supply",
        "type": "u64"
      },
      {
        "name": "migrated_collect_fee_mode",
        "type": "u8"
      },
      {
        "name": "migrated_dynamic_fee",
        "type": "u8"
      },
      {
        "name": "migrated_pool_fee_bps",
        "type": "u16"
      },
      {
        "name": "migrated_pool_base_fee_mode",
        "type": "u8"
      },
      {
        "name": "enable_first_swap_with_min_fee",
        "type": "u8"
      },
      {
        "name": "migrated_compounding_fee_bps",
        "type": "u16"
      },
      {
        "name": "pool_creation_fee",
        "type": "u64"
      },
      {
        "name": "migrated_pool_base_fee_bytes",
        "type": {
          "array": [
            "u8",
            16
          ]
        }
      },
      {
        "name": "sqrt_start_price",
        "type": "u128"
      },
      {
        "name": "curve",
        "type": {
          "array": [
            {
              "defined": {
                "name": "LiquidityDistributionConfig"
              }
            },
            20
          ]
        }
      }
    ],
    "PoolFeesConfig": [
      {
        "name": "base_fee",
        "type": {
          "defined": {
            "name": "BaseFeeConfig"
          }
        }
      },
      {
        "name": "dynamic_fee",
        "type": {
          "defined": {
            "name": "DynamicFeeConfig"
          }
        }
      }
    ],
    "BaseFeeConfig": [
      {
        "name": "cliff_fee_numerator",
        "type": "u64"
      },
      {
        "name": "second_factor",
        "type": "u64"
      },
      {
        "name": "third_factor",
        "type": "u64"
      },
      {
        "name": "first_factor",
        "type": "u16"
      },
      {
        "name": "base_fee_mode",
        "type": "u8"
      },
      {
        "name": "padding_0",
        "type": {
          "array": [
            "u8",
            5
          ]
        }
      }
    ],
    "DynamicFeeConfig": [
      {
        "name": "initialized",
        "type": "u8"
      },
      {
        "name": "padding",
        "type": {
          "array": [
            "u8",
            7
          ]
        }
      },
      {
        "name": "max_volatility_accumulator",
        "type": "u32"
      },
      {
        "name": "variable_fee_control",
        "type": "u32"
      },
      {
        "name": "bin_step",
        "type": "u16"
      },
      {
        "name": "filter_period",
        "type": "u16"
      },
      {
        "name": "decay_period",
        "type": "u16"
      },
      {
        "name": "reduction_factor",
        "type": "u16"
      },
      {
        "name": "padding2",
        "type": {
          "array": [
            "u8",
            8
          ]
        }
      },
      {
        "name": "bin_step_u128",
        "type": "u128"
      }
    ],
    "LiquidityVestingInfo": [
      {
        "name": "is_initialized",
        "type": "u8"
      },
      {
        "name": "vesting_percentage",
        "type": "u8"
      },
      {
        "name": "_padding",
        "type": {
          "array": [
            "u8",
            2
          ]
        }
      },
      {
        "name": "bps_per_period",
        "type": "u16"
      },
      {
        "name": "number_of_periods",
        "type": "u16"
      },
      {
        "name": "frequency",
        "type": "u32"
      },
      {
        "name": "cliff_duration_from_migration_time",
        "type": "u32"
      }
    ],
    "LockedVestingConfig": [
      {
        "name": "amount_per_period",
        "type": "u64"
      },
      {
        "name": "cliff_duration_from_migration_time",
        "type": "u64"
      },
      {
        "name": "frequency",
        "type": "u64"
      },
      {
        "name": "number_of_period",
        "type": "u64"
      },
      {
        "name": "cliff_unlock_amount",
        "type": "u64"
      },
      {
        "name": "_padding",
        "type": "u64"
      }
    ],
    "LiquidityDistributionConfig": [
      {
        "name": "sqrt_price",
        "type": "u128"
      },
      {
        "name": "liquidity",
        "type": "u128"
      }
    ],
    "EvtSwap2": [
      {
        "name": "pool",
        "type": "pubkey"
      },
      {
        "name": "config",
        "type": "pubkey"
      },
      {
        "name": "trade_direction",
        "type": "u8"
      },
      {
        "name": "has_referral",
        "type": "bool"
      },
      {
        "name": "swap_parameters",
        "type": {
          "defined": {
            "name": "SwapParameters2"
          }
        }
      },
      {
        "name": "swap_result",
        "type": {
          "defined": {
            "name": "SwapResult2"
          }
        }
      },
      {
        "name": "quote_reserve_amount",
        "type": "u64"
      },
      {
        "name": "migration_threshold",
        "type": "u64"
      },
      {
        "name": "current_timestamp",
        "type": "u64"
      }
    ],
    "SwapParameters2": [
      {
        "name": "amount_0",
        "type": "u64"
      },
      {
        "name": "amount_1",
        "type": "u64"
      },
      {
        "name": "swap_mode",
        "type": "u8"
      }
    ],
    "SwapResult2": [
      {
        "name": "included_fee_input_amount",
        "type": "u64"
      },
      {
        "name": "excluded_fee_input_amount",
        "type": "u64"
      },
      {
        "name": "amount_left",
        "type": "u64"
      },
      {
        "name": "output_amount",
        "type": "u64"
      },
      {
        "name": "next_sqrt_price",
        "type": "u128"
      },
      {
        "name": "trading_fee",
        "type": "u64"
      },
      {
        "name": "protocol_fee",
        "type": "u64"
      },
      {
        "name": "referral_fee",
        "type": "u64"
      }
    ],
    "EvtSwap3": [
      {
        "name": "pool",
        "type": "pubkey"
      },
      {
        "name": "config",
        "type": "pubkey"
      },
      {
        "name": "trade_direction",
        "type": "u8"
      },
      {
        "name": "swap_mode",
        "type": "u8"
      },
      {
        "name": "has_referral",
        "type": "bool"
      },
      {
        "name": "fee_on_base_token",
        "type": "bool"
      },
      {
        "name": "included_transfer_fee_amount_in",
        "type": "u64"
      },
      {
        "name": "excluded_transfer_fee_amount_in",
        "type": "u64"
      },
      {
        "name": "included_transfer_fee_amount_out",
        "type": "u64"
      },
      {
        "name": "excluded_transfer_fee_amount_out",
        "type": "u64"
      },
      {
        "name": "trading_fee",
        "type": "u64"
      },
      {
        "name": "protocol_fee",
        "type": "u64"
      },
      {
        "name": "referral_fee",
        "type": "u64"
      },
      {
        "name": "next_sqrt_price",
        "type": "u128"
      },
      {
        "name": "quote_reserve",
        "type": "u64"
      },
      {
        "name": "current_timestamp",
        "type": "u64"
      }
    ],
    "SwapParameters": [
      {
        "name": "amount_in",
        "type": "u64"
      },
      {
        "name": "minimum_amount_out",
        "type": "u64"
      }
    ]
  }
} as const;
