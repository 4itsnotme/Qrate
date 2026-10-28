// Data-only official MIT SDK IDL subset. SDK 1.5.1 / IDL 0.2.5.
// Pinned b66412daefab1edfddbc98f9655ddd2733fe021d; DBC migration from 3a965ec0.
// See backend/vendor/meteora/damm-provenance.md.
export const dammSchema = {
  "address": "cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG",
  "accounts": {
    "Pool": [
      241,
      154,
      109,
      4,
      17,
      177,
      109,
      188
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
    ]
  },
  "instructions": {
    "add_liquidity": {
      "discriminator": [
        181,
        157,
        89,
        67,
        143,
        182,
        52,
        72
      ],
      "accounts": [
        "pool",
        "position",
        "token_a_account",
        "token_b_account",
        "token_a_vault",
        "token_b_vault",
        "token_a_mint",
        "token_b_mint",
        "position_nft_account",
        "signer",
        "token_a_program",
        "token_b_program",
        "event_authority",
        "program"
      ]
    },
    "claim_position_fee": {
      "discriminator": [
        180,
        38,
        154,
        17,
        133,
        33,
        162,
        211
      ],
      "accounts": [
        "pool_authority",
        "pool",
        "position",
        "token_a_account",
        "token_b_account",
        "token_a_vault",
        "token_b_vault",
        "token_a_mint",
        "token_b_mint",
        "position_nft_account",
        "signer",
        "token_a_program",
        "token_b_program",
        "event_authority",
        "program"
      ]
    },
    "claim_protocol_fee2": {
      "discriminator": [
        235,
        194,
        54,
        69,
        65,
        10,
        236,
        112
      ],
      "accounts": [
        "receiver_token_account",
        "token_a_mint",
        "token_b_mint",
        "token_a_program",
        "token_b_program",
        "pool",
        "token_a_vault",
        "token_b_vault",
        "pool_authority",
        "signer"
      ]
    },
    "claim_reward": {
      "discriminator": [
        149,
        95,
        181,
        242,
        94,
        90,
        158,
        162
      ],
      "accounts": [
        "pool_authority",
        "pool",
        "position",
        "reward_vault",
        "reward_mint",
        "user_token_account",
        "position_nft_account",
        "signer",
        "token_program",
        "event_authority",
        "program"
      ]
    },
    "close_config": {
      "discriminator": [
        145,
        9,
        72,
        157,
        95,
        125,
        61,
        85
      ],
      "accounts": [
        "config",
        "operator",
        "signer",
        "rent_receiver",
        "event_authority",
        "program"
      ]
    },
    "close_operator_account": {
      "discriminator": [
        171,
        9,
        213,
        74,
        120,
        23,
        3,
        29
      ],
      "accounts": [
        "operator",
        "signer",
        "rent_receiver",
        "event_authority",
        "program"
      ]
    },
    "close_position": {
      "discriminator": [
        123,
        134,
        81,
        0,
        49,
        68,
        98,
        98
      ],
      "accounts": [
        "position_nft_mint",
        "position_nft_account",
        "pool",
        "position",
        "pool_authority",
        "rent_receiver",
        "owner",
        "token_program",
        "event_authority",
        "program"
      ]
    },
    "close_token_badge": {
      "discriminator": [
        108,
        146,
        86,
        110,
        179,
        254,
        10,
        104
      ],
      "accounts": [
        "token_badge",
        "operator",
        "signer",
        "rent_receiver",
        "event_authority",
        "program"
      ]
    },
    "create_config": {
      "discriminator": [
        201,
        207,
        243,
        114,
        75,
        111,
        47,
        189
      ],
      "accounts": [
        "config",
        "operator",
        "signer",
        "payer",
        "system_program",
        "event_authority",
        "program"
      ]
    },
    "create_dynamic_config": {
      "discriminator": [
        81,
        251,
        122,
        78,
        66,
        57,
        208,
        82
      ],
      "accounts": [
        "config",
        "operator",
        "signer",
        "payer",
        "system_program",
        "event_authority",
        "program"
      ]
    },
    "create_operator_account": {
      "discriminator": [
        221,
        64,
        246,
        149,
        240,
        153,
        229,
        163
      ],
      "accounts": [
        "operator",
        "whitelisted_address",
        "signer",
        "payer",
        "system_program",
        "event_authority",
        "program"
      ]
    },
    "create_position": {
      "discriminator": [
        48,
        215,
        197,
        153,
        96,
        203,
        180,
        133
      ],
      "accounts": [
        "owner",
        "position_nft_mint",
        "position_nft_account",
        "pool",
        "position",
        "pool_authority",
        "payer",
        "token_program",
        "system_program",
        "event_authority",
        "program"
      ]
    },
    "create_token_badge": {
      "discriminator": [
        88,
        206,
        0,
        91,
        60,
        175,
        151,
        118
      ],
      "accounts": [
        "token_badge",
        "token_mint",
        "operator",
        "signer",
        "payer",
        "system_program",
        "event_authority",
        "program"
      ]
    },
    "dummy_ix": {
      "discriminator": [
        234,
        95,
        176,
        185,
        7,
        42,
        35,
        159
      ],
      "accounts": [
        "pod_aligned_fee_time_scheduler",
        "pod_aligned_fee_rate_limiter",
        "pod_aligned_fee_market_cap_scheduler"
      ]
    },
    "fix_config_fee_params": {
      "discriminator": [
        38,
        30,
        216,
        81,
        250,
        177,
        243,
        254
      ],
      "accounts": [
        "config",
        "operator",
        "signer"
      ]
    },
    "fix_pool_fee_params": {
      "discriminator": [
        132,
        98,
        81,
        196,
        44,
        58,
        120,
        193
      ],
      "accounts": [
        "pool",
        "operator",
        "signer"
      ]
    },
    "fix_pool_layout_version": {
      "discriminator": [
        166,
        158,
        69,
        35,
        81,
        167,
        200,
        215
      ],
      "accounts": [
        "pool",
        "operator",
        "signer"
      ]
    },
    "fund_reward": {
      "discriminator": [
        188,
        50,
        249,
        165,
        93,
        151,
        38,
        63
      ],
      "accounts": [
        "pool",
        "reward_vault",
        "reward_mint",
        "funder_token_account",
        "funder",
        "token_program",
        "event_authority",
        "program"
      ]
    },
    "initialize_customizable_pool": {
      "discriminator": [
        20,
        161,
        241,
        24,
        189,
        221,
        180,
        2
      ],
      "accounts": [
        "creator",
        "position_nft_mint",
        "position_nft_account",
        "payer",
        "pool_authority",
        "pool",
        "position",
        "token_a_mint",
        "token_b_mint",
        "token_a_vault",
        "token_b_vault",
        "payer_token_a",
        "payer_token_b",
        "token_a_program",
        "token_b_program",
        "token_2022_program",
        "system_program",
        "event_authority",
        "program"
      ]
    },
    "initialize_pool": {
      "discriminator": [
        95,
        180,
        10,
        172,
        84,
        174,
        232,
        40
      ],
      "accounts": [
        "creator",
        "position_nft_mint",
        "position_nft_account",
        "payer",
        "config",
        "pool_authority",
        "pool",
        "position",
        "token_a_mint",
        "token_b_mint",
        "token_a_vault",
        "token_b_vault",
        "payer_token_a",
        "payer_token_b",
        "token_a_program",
        "token_b_program",
        "token_2022_program",
        "system_program",
        "event_authority",
        "program"
      ]
    },
    "initialize_pool_with_dynamic_config": {
      "discriminator": [
        149,
        82,
        72,
        197,
        253,
        252,
        68,
        15
      ],
      "accounts": [
        "creator",
        "position_nft_mint",
        "position_nft_account",
        "payer",
        "pool_creator_authority",
        "config",
        "pool_authority",
        "pool",
        "position",
        "token_a_mint",
        "token_b_mint",
        "token_a_vault",
        "token_b_vault",
        "payer_token_a",
        "payer_token_b",
        "token_a_program",
        "token_b_program",
        "token_2022_program",
        "system_program",
        "event_authority",
        "program"
      ]
    },
    "initialize_reward": {
      "discriminator": [
        95,
        135,
        192,
        196,
        242,
        129,
        230,
        68
      ],
      "accounts": [
        "pool_authority",
        "pool",
        "reward_vault",
        "reward_mint",
        "signer",
        "payer",
        "token_program",
        "system_program",
        "event_authority",
        "program"
      ]
    },
    "lock_inner_position": {
      "discriminator": [
        72,
        19,
        49,
        204,
        18,
        122,
        23,
        90
      ],
      "accounts": [
        "pool",
        "position",
        "position_nft_account",
        "signer",
        "event_authority",
        "program"
      ]
    },
    "lock_position": {
      "discriminator": [
        227,
        62,
        2,
        252,
        247,
        10,
        171,
        185
      ],
      "accounts": [
        "pool",
        "position",
        "vesting",
        "position_nft_account",
        "signer",
        "payer",
        "system_program",
        "event_authority",
        "program"
      ]
    },
    "permanent_lock_position": {
      "discriminator": [
        165,
        176,
        125,
        6,
        231,
        171,
        186,
        213
      ],
      "accounts": [
        "pool",
        "position",
        "position_nft_account",
        "signer",
        "event_authority",
        "program"
      ]
    },
    "refresh_vesting": {
      "discriminator": [
        9,
        94,
        216,
        14,
        116,
        204,
        247,
        0
      ],
      "accounts": [
        "pool",
        "position",
        "position_nft_account",
        "owner"
      ]
    },
    "remove_all_liquidity": {
      "discriminator": [
        10,
        51,
        61,
        35,
        112,
        105,
        24,
        85
      ],
      "accounts": [
        "pool_authority",
        "pool",
        "position",
        "token_a_account",
        "token_b_account",
        "token_a_vault",
        "token_b_vault",
        "token_a_mint",
        "token_b_mint",
        "position_nft_account",
        "signer",
        "token_a_program",
        "token_b_program",
        "event_authority",
        "program"
      ]
    },
    "remove_liquidity": {
      "discriminator": [
        80,
        85,
        209,
        72,
        24,
        206,
        177,
        108
      ],
      "accounts": [
        "pool_authority",
        "pool",
        "position",
        "token_a_account",
        "token_b_account",
        "token_a_vault",
        "token_b_vault",
        "token_a_mint",
        "token_b_mint",
        "position_nft_account",
        "signer",
        "token_a_program",
        "token_b_program",
        "event_authority",
        "program"
      ]
    },
    "set_pool_status": {
      "discriminator": [
        112,
        87,
        135,
        223,
        83,
        204,
        132,
        53
      ],
      "accounts": [
        "pool",
        "operator",
        "signer",
        "event_authority",
        "program"
      ]
    },
    "split_position": {
      "discriminator": [
        172,
        241,
        221,
        138,
        161,
        29,
        253,
        42
      ],
      "accounts": [
        "pool",
        "first_position",
        "first_position_nft_account",
        "second_position",
        "second_position_nft_account",
        "first_owner",
        "second_owner",
        "event_authority",
        "program"
      ]
    },
    "split_position2": {
      "discriminator": [
        221,
        147,
        228,
        207,
        140,
        212,
        17,
        119
      ],
      "accounts": [
        "pool",
        "first_position",
        "first_position_nft_account",
        "second_position",
        "second_position_nft_account",
        "first_owner",
        "second_owner",
        "event_authority",
        "program"
      ]
    },
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
        "pool",
        "input_token_account",
        "output_token_account",
        "token_a_vault",
        "token_b_vault",
        "token_a_mint",
        "token_b_mint",
        "payer",
        "token_a_program",
        "token_b_program",
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
        "pool",
        "input_token_account",
        "output_token_account",
        "token_a_vault",
        "token_b_vault",
        "token_a_mint",
        "token_b_mint",
        "payer",
        "token_a_program",
        "token_b_program",
        "referral_token_account",
        "event_authority",
        "program"
      ]
    },
    "update_delegate_permission": {
      "discriminator": [
        175,
        165,
        56,
        64,
        0,
        251,
        89,
        47
      ],
      "accounts": [
        "position",
        "position_nft_account",
        "owner",
        "event_authority",
        "program"
      ]
    },
    "update_pool_fees": {
      "discriminator": [
        118,
        217,
        203,
        179,
        60,
        8,
        70,
        89
      ],
      "accounts": [
        "pool",
        "operator",
        "signer",
        "event_authority",
        "program"
      ]
    },
    "update_reward_duration": {
      "discriminator": [
        138,
        174,
        196,
        169,
        213,
        235,
        254,
        107
      ],
      "accounts": [
        "pool",
        "signer",
        "event_authority",
        "program"
      ]
    },
    "update_reward_funder": {
      "discriminator": [
        211,
        28,
        48,
        32,
        215,
        160,
        35,
        23
      ],
      "accounts": [
        "pool",
        "signer",
        "event_authority",
        "program"
      ]
    },
    "withdraw_dead_liquidity_reward": {
      "discriminator": [
        121,
        99,
        224,
        91,
        178,
        14,
        22,
        132
      ],
      "accounts": [
        "pool_authority",
        "pool",
        "reward_vault",
        "reward_mint",
        "funder_token_account",
        "funder",
        "token_program",
        "event_authority",
        "program"
      ]
    },
    "withdraw_ineligible_reward": {
      "discriminator": [
        148,
        206,
        42,
        195,
        247,
        49,
        103,
        8
      ],
      "accounts": [
        "pool_authority",
        "pool",
        "reward_vault",
        "reward_mint",
        "funder_token_account",
        "funder",
        "token_program",
        "event_authority",
        "program"
      ]
    }
  },
  "migration": {
    "discriminator": [
      156,
      169,
      230,
      103,
      53,
      228,
      80,
      64
    ],
    "accounts": [
      "virtual_pool",
      "migration_metadata",
      "config",
      "pool_authority",
      "pool",
      "first_position_nft_mint",
      "first_position_nft_account",
      "first_position",
      "second_position_nft_mint",
      "second_position_nft_account",
      "second_position",
      "damm_pool_authority",
      "amm_program",
      "base_mint",
      "quote_mint",
      "token_a_vault",
      "token_b_vault",
      "base_vault",
      "quote_vault",
      "payer",
      "token_base_program",
      "token_quote_program",
      "token_2022_program",
      "damm_event_authority",
      "system_program"
    ]
  },
  "types": {
    "Pool": [
      {
        "name": "pool_fees",
        "type": {
          "defined": {
            "name": "PoolFeesStruct"
          }
        }
      },
      {
        "name": "token_a_mint",
        "type": "pubkey"
      },
      {
        "name": "token_b_mint",
        "type": "pubkey"
      },
      {
        "name": "token_a_vault",
        "type": "pubkey"
      },
      {
        "name": "token_b_vault",
        "type": "pubkey"
      },
      {
        "name": "whitelisted_vault",
        "type": "pubkey"
      },
      {
        "name": "padding_0",
        "type": {
          "array": [
            "u8",
            32
          ]
        }
      },
      {
        "name": "liquidity",
        "type": "u128"
      },
      {
        "name": "padding_1",
        "type": "u128"
      },
      {
        "name": "protocol_a_fee",
        "type": "u64"
      },
      {
        "name": "protocol_b_fee",
        "type": "u64"
      },
      {
        "name": "dead_liquidity_fee_checkpoint",
        "type": "u64"
      },
      {
        "name": "padding_2",
        "type": {
          "array": [
            "u8",
            8
          ]
        }
      },
      {
        "name": "sqrt_min_price",
        "type": "u128"
      },
      {
        "name": "sqrt_max_price",
        "type": "u128"
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
        "name": "activation_type",
        "type": "u8"
      },
      {
        "name": "pool_status",
        "type": "u8"
      },
      {
        "name": "token_a_flag",
        "type": "u8"
      },
      {
        "name": "token_b_flag",
        "type": "u8"
      },
      {
        "name": "collect_fee_mode",
        "type": "u8"
      },
      {
        "name": "pool_type",
        "type": "u8"
      },
      {
        "name": "fee_version",
        "type": "u8"
      },
      {
        "name": "padding_3",
        "type": "u8"
      },
      {
        "name": "fee_a_per_liquidity",
        "type": {
          "array": [
            "u8",
            32
          ]
        }
      },
      {
        "name": "fee_b_per_liquidity",
        "type": {
          "array": [
            "u8",
            32
          ]
        }
      },
      {
        "name": "permanent_lock_liquidity",
        "type": "u128"
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
        "name": "creator",
        "type": "pubkey"
      },
      {
        "name": "token_a_amount",
        "type": "u64"
      },
      {
        "name": "token_b_amount",
        "type": "u64"
      },
      {
        "name": "layout_version",
        "type": "u8"
      },
      {
        "name": "padding_4",
        "type": {
          "array": [
            "u8",
            7
          ]
        }
      },
      {
        "name": "padding_5",
        "type": {
          "array": [
            "u64",
            3
          ]
        }
      },
      {
        "name": "reward_infos",
        "type": {
          "array": [
            {
              "defined": {
                "name": "RewardInfo"
              }
            },
            2
          ]
        }
      }
    ],
    "PoolFeesStruct": [
      {
        "name": "base_fee",
        "type": {
          "defined": {
            "name": "BaseFeeStruct"
          }
        }
      },
      {
        "name": "protocol_fee_percent",
        "type": "u8"
      },
      {
        "name": "padding_0",
        "type": "u8"
      },
      {
        "name": "referral_fee_percent",
        "type": "u8"
      },
      {
        "name": "padding_1",
        "type": {
          "array": [
            "u8",
            3
          ]
        }
      },
      {
        "name": "compounding_fee_bps",
        "type": "u16"
      },
      {
        "name": "dynamic_fee",
        "type": {
          "defined": {
            "name": "DynamicFeeStruct"
          }
        }
      },
      {
        "name": "init_sqrt_price",
        "type": "u128"
      }
    ],
    "BaseFeeStruct": [
      {
        "name": "base_fee_info",
        "type": {
          "defined": {
            "name": "BaseFeeInfo"
          }
        }
      },
      {
        "name": "padding_1",
        "type": "u64"
      }
    ],
    "BaseFeeInfo": [
      {
        "name": "data",
        "type": {
          "array": [
            "u8",
            32
          ]
        }
      }
    ],
    "DynamicFeeStruct": [
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
        "name": "last_update_timestamp",
        "type": "u64"
      },
      {
        "name": "bin_step_u128",
        "type": "u128"
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
        "name": "total_lp_a_fee",
        "type": "u128"
      },
      {
        "name": "total_lp_b_fee",
        "type": "u128"
      },
      {
        "name": "total_protocol_a_fee",
        "type": "u64"
      },
      {
        "name": "total_protocol_b_fee",
        "type": "u64"
      },
      {
        "name": "padding_0",
        "type": {
          "array": [
            "u64",
            2
          ]
        }
      },
      {
        "name": "total_position",
        "type": "u64"
      },
      {
        "name": "padding",
        "type": "u64"
      }
    ],
    "RewardInfo": [
      {
        "name": "initialized",
        "type": "u8"
      },
      {
        "name": "reward_token_flag",
        "type": "u8"
      },
      {
        "name": "_padding_0",
        "type": {
          "array": [
            "u8",
            6
          ]
        }
      },
      {
        "name": "dead_liquidity_reward_checkpoint",
        "type": "u64"
      },
      {
        "name": "mint",
        "type": "pubkey"
      },
      {
        "name": "vault",
        "type": "pubkey"
      },
      {
        "name": "funder",
        "type": "pubkey"
      },
      {
        "name": "reward_duration",
        "type": "u64"
      },
      {
        "name": "reward_duration_end",
        "type": "u64"
      },
      {
        "name": "reward_rate",
        "type": "u128"
      },
      {
        "name": "reward_per_token_stored",
        "type": {
          "array": [
            "u8",
            32
          ]
        }
      },
      {
        "name": "last_update_time",
        "type": "u64"
      },
      {
        "name": "cumulative_seconds_with_empty_liquidity_reward",
        "type": "u64"
      }
    ],
    "EvtSwap2": [
      {
        "name": "pool",
        "type": "pubkey"
      },
      {
        "name": "trade_direction",
        "type": "u8"
      },
      {
        "name": "collect_fee_mode",
        "type": "u8"
      },
      {
        "name": "has_referral",
        "type": "bool"
      },
      {
        "name": "params",
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
        "name": "included_transfer_fee_amount_in",
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
        "name": "current_timestamp",
        "type": "u64"
      },
      {
        "name": "reserve_a_amount",
        "type": "u64"
      },
      {
        "name": "reserve_b_amount",
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
        "name": "claiming_fee",
        "type": "u64"
      },
      {
        "name": "protocol_fee",
        "type": "u64"
      },
      {
        "name": "compounding_fee",
        "type": "u64"
      },
      {
        "name": "referral_fee",
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
