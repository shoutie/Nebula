use anchor_lang::prelude::*;
use arcium_anchor::prelude::*;
use arcium_client::idl::arcium::types::CallbackAccount;
use arcium_client::idl::arcium::types::{CircuitSource, OffChainCircuitSource};
use arcium_macros::circuit_hash;

const COMP_DEF_OFFSET_SHUFFLE_AND_DEAL_CARDS: u32 = comp_def_offset("shuffle_and_deal_cards");
const COMP_DEF_OFFSET_PLAYER_HIT: u32 = comp_def_offset("player_hit");
const COMP_DEF_OFFSET_PLAYER_STAND: u32 = comp_def_offset("player_stand");
const COMP_DEF_OFFSET_DEALER_PLAY: u32 = comp_def_offset("dealer_play");
const COMP_DEF_OFFSET_RESOLVE_GAME: u32 = comp_def_offset("resolve_game");

declare_id!("GUSwSKHUyxj66uykQz9nSDNrjyh6cBDEK2iuJuEEKHBe");

#[arcium_program]
pub mod blackjack {
    use super::*;

    pub fn init_shuffle_and_deal_cards_comp_def(
        ctx: Context<InitShuffleAndDealCardsCompDef>,
    ) -> Result<()> {
        init_comp_def(
            ctx.accounts,
            Some(CircuitSource::OffChain(OffChainCircuitSource {
                source: "https://axkmvywrufsbjfpebnmh.supabase.co/storage/v1/object/public/build/blackjack/shuffle_and_deal_cards.arcis".to_string(),
                hash: circuit_hash!("shuffle_and_deal_cards"),
            })),
            None,
        )?;
        Ok(())
    }

    pub fn initialize_blackjack_game(
        ctx: Context<InitializeBlackjackGame>,
        computation_offset: u64,
        game_id: u64,
        client_pubkey: [u8; 32],
        client_nonce: u128,
        client_again_nonce: u128,
    ) -> Result<()> {
        let blackjack_game = &mut ctx.accounts.blackjack_game;
        blackjack_game.bump = ctx.bumps.blackjack_game;
        blackjack_game.game_id = game_id;
        blackjack_game.player_pubkey = ctx.accounts.payer.key();
        blackjack_game.player_hand = [0; 32];
        blackjack_game.dealer_hand = [0; 32];
        blackjack_game.deck_nonce = 0;
        blackjack_game.client_nonce = 0;
        blackjack_game.dealer_nonce = 0;
        blackjack_game.player_enc_pubkey = client_pubkey;
        blackjack_game.game_state = GameState::Initial;
        blackjack_game.player_hand_size = 0;
        blackjack_game.dealer_hand_size = 0;

        let args = ArgBuilder::new()
            .x25519_pubkey(client_pubkey)
            .plaintext_u128(client_nonce)
            .x25519_pubkey(client_pubkey)
            .plaintext_u128(client_again_nonce)
            .build();

        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            vec![ShuffleAndDealCardsCallback::callback_ix(
                computation_offset,
                &ctx.accounts.mxe_account,
                &[CallbackAccount {
                    pubkey: ctx.accounts.blackjack_game.key(),
                    is_writable: true,
                }],
            )?],
            1,
            0,
        )?;
        Ok(())
    }

    #[arcium_callback(encrypted_ix = "shuffle_and_deal_cards")]
    pub fn shuffle_and_deal_cards_callback(
        ctx: Context<ShuffleAndDealCardsCallback>,
        output: SignedComputationOutputs<ShuffleAndDealCardsOutput>,
    ) -> Result<()> {
        let o = match output.verify_output(
            &ctx.accounts.cluster_account,
            &ctx.accounts.computation_account,
        ) {
            Ok(ShuffleAndDealCardsOutput {
                field_0:
                    ShuffleAndDealCardsOutputStruct0 {
                        field_0: deck,
                        field_1: dealer_hand,
                        field_2: player_hand,
                        field_3: dealer_face_up_card,
                    },
            }) => (deck, dealer_hand, player_hand, dealer_face_up_card),
            Err(_) => return Err(ErrorCode::AbortedComputation.into()),
        };

        let deck_nonce = o.0.nonce;

        let deck: [[u8; 32]; 2] = o.0.ciphertexts;

        let dealer_nonce = o.1.nonce;

        let dealer_hand: [u8; 32] = o.1.ciphertexts[0];

        let client_pubkey: [u8; 32] = o.2.encryption_key;

        let client_nonce = o.2.nonce;

        let player_hand: [u8; 32] = o.2.ciphertexts[0];

        let dealer_client_pubkey: [u8; 32] = o.3.encryption_key;

        let dealer_client_nonce = o.3.nonce;

        let dealer_face_up_card: [u8; 32] = o.3.ciphertexts[0];

        let blackjack_game = &mut ctx.accounts.blackjack_game;
        blackjack_game.deck = deck;
        blackjack_game.deck_nonce = deck_nonce;
        blackjack_game.client_nonce = client_nonce;
        blackjack_game.dealer_nonce = dealer_nonce;
        blackjack_game.player_enc_pubkey = client_pubkey;
        blackjack_game.game_state = GameState::PlayerTurn;

        require!(
            dealer_client_pubkey == blackjack_game.player_enc_pubkey,
            ErrorCode::InvalidDealerClientPubkey
        );

        blackjack_game.player_hand = player_hand;
        blackjack_game.dealer_hand = dealer_hand;
        blackjack_game.player_hand_size = 2;
        blackjack_game.dealer_hand_size = 2;

        emit!(CardsShuffledAndDealtEvent {
            client_nonce,
            dealer_client_nonce,
            player_hand,
            dealer_face_up_card,
            game_id: blackjack_game.game_id,
        });
        Ok(())
    }
    pub fn init_player_hit_comp_def(ctx: Context<InitPlayerHitCompDef>) -> Result<()> {
        init_comp_def(
            ctx.accounts,
            Some(CircuitSource::OffChain(OffChainCircuitSource {
                source: "https://axkmvywrufsbjfpebnmh.supabase.co/storage/v1/object/public/build/blackjack/player_hit.arcis".to_string(),
                hash: circuit_hash!("player_hit"),
            })),
            None,
        )?;
        Ok(())
    }

    pub fn player_hit(
        ctx: Context<PlayerHit>,
        computation_offset: u64,
        _game_id: u64,
    ) -> Result<()> {
        require!(
            ctx.accounts.blackjack_game.game_state == GameState::PlayerTurn,
            ErrorCode::InvalidGameState
        );
        require!(
            !ctx.accounts.blackjack_game.player_has_stood,
            ErrorCode::InvalidMove
        );

        let args = ArgBuilder::new()
            .plaintext_u128(ctx.accounts.blackjack_game.deck_nonce)
            .account(ctx.accounts.blackjack_game.key(), 8, 32 * 2)
            .x25519_pubkey(ctx.accounts.blackjack_game.player_enc_pubkey)
            .plaintext_u128(ctx.accounts.blackjack_game.client_nonce)
            .account(ctx.accounts.blackjack_game.key(), 8 + 32 * 2, 32)
            .plaintext_u8(ctx.accounts.blackjack_game.player_hand_size)
            .plaintext_u8(ctx.accounts.blackjack_game.dealer_hand_size)
            .build();

        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            vec![PlayerHitCallback::callback_ix(
                computation_offset,
                &ctx.accounts.mxe_account,
                &[CallbackAccount {
                    pubkey: ctx.accounts.blackjack_game.key(),
                    is_writable: true,
                }],
            )?],
            1,
            0,
        )?;
        Ok(())
    }

    #[arcium_callback(encrypted_ix = "player_hit")]
    pub fn player_hit_callback(
        ctx: Context<PlayerHitCallback>,
        output: SignedComputationOutputs<PlayerHitOutput>,
    ) -> Result<()> {
        let o = match output.verify_output(
            &ctx.accounts.cluster_account,
            &ctx.accounts.computation_account,
        ) {
            Ok(PlayerHitOutput {
                field_0:
                    PlayerHitOutputStruct0 {
                        field_0: player_hand,
                        field_1: is_bust,
                    },
            }) => (player_hand, is_bust),
            Err(_) => return Err(ErrorCode::AbortedComputation.into()),
        };

        let client_nonce = o.0.nonce;

        let player_hand: [u8; 32] = o.0.ciphertexts[0];

        let is_bust: bool = o.1;

        let blackjack_game = &mut ctx.accounts.blackjack_game;
        blackjack_game.player_hand = player_hand;
        blackjack_game.client_nonce = client_nonce;
        blackjack_game.player_hand_size += 1;

        if is_bust {
            blackjack_game.game_state = GameState::DealerTurn;
            emit!(PlayerBustEvent {
                client_nonce,
                game_id: blackjack_game.game_id,
            });
        } else {
            blackjack_game.game_state = GameState::PlayerTurn;
            emit!(PlayerHitEvent {
                player_hand,
                client_nonce,
                game_id: blackjack_game.game_id,
            });
        }

        Ok(())
    }

    pub fn init_player_stand_comp_def(ctx: Context<InitPlayerStandCompDef>) -> Result<()> {
        init_comp_def(
            ctx.accounts,
            Some(CircuitSource::OffChain(OffChainCircuitSource {
                source: "https://axkmvywrufsbjfpebnmh.supabase.co/storage/v1/object/public/build/blackjack/player_stand.arcis".to_string(),
                hash: circuit_hash!("player_stand"),
            })),
            None,
        )?;
        Ok(())
    }

    pub fn player_stand(
        ctx: Context<PlayerStand>,
        computation_offset: u64,
        _game_id: u64,
    ) -> Result<()> {
        require!(
            ctx.accounts.blackjack_game.game_state == GameState::PlayerTurn,
            ErrorCode::InvalidGameState
        );
        require!(
            !ctx.accounts.blackjack_game.player_has_stood,
            ErrorCode::InvalidMove
        );

        let args = ArgBuilder::new()
            .x25519_pubkey(ctx.accounts.blackjack_game.player_enc_pubkey)
            .plaintext_u128(ctx.accounts.blackjack_game.client_nonce)
            .account(ctx.accounts.blackjack_game.key(), 8 + 32 * 2, 32)
            .plaintext_u8(ctx.accounts.blackjack_game.player_hand_size)
            .build();

        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            vec![PlayerStandCallback::callback_ix(
                computation_offset,
                &ctx.accounts.mxe_account,
                &[CallbackAccount {
                    pubkey: ctx.accounts.blackjack_game.key(),
                    is_writable: true,
                }],
            )?],
            1,
            0,
        )?;
        Ok(())
    }

    #[arcium_callback(encrypted_ix = "player_stand")]
    pub fn player_stand_callback(
        ctx: Context<PlayerStandCallback>,
        output: SignedComputationOutputs<PlayerStandOutput>,
    ) -> Result<()> {
        let is_bust = match output.verify_output(
            &ctx.accounts.cluster_account,
            &ctx.accounts.computation_account,
        ) {
            Ok(PlayerStandOutput { field_0 }) => field_0,
            Err(_) => return Err(ErrorCode::AbortedComputation.into()),
        };

        let blackjack_game = &mut ctx.accounts.blackjack_game;
        blackjack_game.player_has_stood = true;

        if is_bust {
            blackjack_game.game_state = GameState::PlayerTurn;
            emit!(PlayerBustEvent {
                client_nonce: blackjack_game.client_nonce,
                game_id: blackjack_game.game_id,
            });
        } else {
            blackjack_game.game_state = GameState::DealerTurn;
            emit!(PlayerStandEvent {
                is_bust,
                game_id: blackjack_game.game_id
            });
        }

        Ok(())
    }

    pub fn init_dealer_play_comp_def(ctx: Context<InitDealerPlayCompDef>) -> Result<()> {
        init_comp_def(
            ctx.accounts,
            Some(CircuitSource::OffChain(OffChainCircuitSource {
                source: "https://axkmvywrufsbjfpebnmh.supabase.co/storage/v1/object/public/build/blackjack/dealer_play.arcis".to_string(),
                hash: circuit_hash!("dealer_play"),
            })),
            None,
        )?;
        Ok(())
    }

    pub fn dealer_play(
        ctx: Context<DealerPlay>,
        computation_offset: u64,
        _game_id: u64,
        nonce: u128,
    ) -> Result<()> {
        require!(
            ctx.accounts.blackjack_game.game_state == GameState::DealerTurn,
            ErrorCode::InvalidGameState
        );

        let args = ArgBuilder::new()
            .plaintext_u128(ctx.accounts.blackjack_game.deck_nonce)
            .account(ctx.accounts.blackjack_game.key(), 8, 32 * 2)
            .plaintext_u128(ctx.accounts.blackjack_game.dealer_nonce)
            .account(ctx.accounts.blackjack_game.key(), 8 + 32 * 2 + 32, 32)
            .x25519_pubkey(ctx.accounts.blackjack_game.player_enc_pubkey)
            .plaintext_u128(nonce)
            .plaintext_u8(ctx.accounts.blackjack_game.player_hand_size)
            .plaintext_u8(ctx.accounts.blackjack_game.dealer_hand_size)
            .build();

        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            vec![DealerPlayCallback::callback_ix(
                computation_offset,
                &ctx.accounts.mxe_account,
                &[CallbackAccount {
                    pubkey: ctx.accounts.blackjack_game.key(),
                    is_writable: true,
                }],
            )?],
            1,
            0,
        )?;
        Ok(())
    }

    #[arcium_callback(encrypted_ix = "dealer_play")]
    pub fn dealer_play_callback(
        ctx: Context<DealerPlayCallback>,
        output: SignedComputationOutputs<DealerPlayOutput>,
    ) -> Result<()> {
        let o = match output.verify_output(
            &ctx.accounts.cluster_account,
            &ctx.accounts.computation_account,
        ) {
            Ok(DealerPlayOutput {
                field_0:
                    DealerPlayOutputStruct0 {
                        field_0: dealer_hand,
                        field_1: dealer_client_hand,
                        field_2: dealer_hand_size,
                    },
            }) => (dealer_hand, dealer_client_hand, dealer_hand_size),
            Err(_) => return Err(ErrorCode::AbortedComputation.into()),
        };

        let dealer_nonce = o.0.nonce;
        let dealer_hand = o.0.ciphertexts[0];
        let dealer_client_hand = o.1.ciphertexts[0];
        let dealer_hand_size = o.2;
        let client_nonce = o.1.nonce;

        let blackjack_game = &mut ctx.accounts.blackjack_game;
        blackjack_game.dealer_hand = dealer_hand;
        blackjack_game.dealer_nonce = dealer_nonce;
        blackjack_game.dealer_hand_size = dealer_hand_size;
        blackjack_game.game_state = GameState::Resolving;

        emit!(DealerPlayEvent {
            dealer_hand: dealer_client_hand,
            dealer_hand_size,
            client_nonce,
            game_id: ctx.accounts.blackjack_game.game_id,
        });

        Ok(())
    }

    pub fn init_resolve_game_comp_def(ctx: Context<InitResolveGameCompDef>) -> Result<()> {
        init_comp_def(
            ctx.accounts,
            Some(CircuitSource::OffChain(OffChainCircuitSource {
                source: "https://axkmvywrufsbjfpebnmh.supabase.co/storage/v1/object/public/build/blackjack/resolve_game.arcis".to_string(),
                hash: circuit_hash!("resolve_game"),
            })),
            None,
        )?;
        Ok(())
    }

    pub fn resolve_game(
        ctx: Context<ResolveGame>,
        computation_offset: u64,
        _game_id: u64,
    ) -> Result<()> {
        require!(
            ctx.accounts.blackjack_game.game_state == GameState::Resolving,
            ErrorCode::InvalidGameState
        );

        let args = ArgBuilder::new()
            .x25519_pubkey(ctx.accounts.blackjack_game.player_enc_pubkey)
            .plaintext_u128(ctx.accounts.blackjack_game.client_nonce)
            .account(ctx.accounts.blackjack_game.key(), 8 + 32 * 2, 32)
            .plaintext_u128(ctx.accounts.blackjack_game.dealer_nonce)
            .account(ctx.accounts.blackjack_game.key(), 8 + 32 * 2 + 32, 32)
            .plaintext_u8(ctx.accounts.blackjack_game.player_hand_size)
            .plaintext_u8(ctx.accounts.blackjack_game.dealer_hand_size)
            .build();

        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            vec![ResolveGameCallback::callback_ix(
                computation_offset,
                &ctx.accounts.mxe_account,
                &[CallbackAccount {
                    pubkey: ctx.accounts.blackjack_game.key(),
                    is_writable: true,
                }],
            )?],
            1,
            0,
        )?;
        Ok(())
    }

    #[arcium_callback(encrypted_ix = "resolve_game")]
    pub fn resolve_game_callback(
        ctx: Context<ResolveGameCallback>,
        output: SignedComputationOutputs<ResolveGameOutput>,
    ) -> Result<()> {
        let result = match output.verify_output(
            &ctx.accounts.cluster_account,
            &ctx.accounts.computation_account,
        ) {
            Ok(ResolveGameOutput { field_0 }) => field_0,
            Err(_) => return Err(ErrorCode::AbortedComputation.into()),
        };

        if result == 0 {
            emit!(ResultEvent {
                winner: "Dealer".to_string(),
                game_id: ctx.accounts.blackjack_game.game_id,
            });
        } else if result == 1 {
            emit!(ResultEvent {
                winner: "Player".to_string(),
                game_id: ctx.accounts.blackjack_game.game_id,
            });
        } else if result == 2 {
            emit!(ResultEvent {
                winner: "Player".to_string(),
                game_id: ctx.accounts.blackjack_game.game_id,
            });
        } else if result == 3 {
            emit!(ResultEvent {
                winner: "Dealer".to_string(),
                game_id: ctx.accounts.blackjack_game.game_id,
            });
        } else {
            emit!(ResultEvent {
                winner: "Tie".to_string(),
                game_id: ctx.accounts.blackjack_game.game_id,
            });
        }

        let blackjack_game = &mut ctx.accounts.blackjack_game;
        blackjack_game.game_state = GameState::Resolved;

        Ok(())
    }
}

#[queue_computation_accounts("shuffle_and_deal_cards", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64, game_id: u64)]
pub struct InitializeBlackjackGame<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init_if_needed,
        space = 9,
        payer = payer,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, ArciumSignerAccount>,
    #[account(
        address = derive_mxe_pda!()
    )]
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(
        mut,
        address = derive_mempool_pda!(mxe_account, ErrorCode::ClusterNotSet)
    )]
    pub mempool_account: UncheckedAccount<'info>,
    #[account(
        mut,
        address = derive_execpool_pda!(mxe_account, ErrorCode::ClusterNotSet)
    )]
    pub executing_pool: UncheckedAccount<'info>,
    #[account(
        mut,
        address = derive_comp_pda!(computation_offset, mxe_account, ErrorCode::ClusterNotSet)
    )]
    pub computation_account: UncheckedAccount<'info>,
    #[account(
        address = derive_comp_def_pda!(COMP_DEF_OFFSET_SHUFFLE_AND_DEAL_CARDS)
    )]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(
        mut,
        address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet)
    )]
    pub cluster_account: Account<'info, Cluster>,
    #[account(
        mut,
        address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS,
    )]
    pub pool_account: Account<'info, FeePool>,
    #[account(
        mut,
        address = ARCIUM_CLOCK_ACCOUNT_ADDRESS,
    )]
    pub clock_account: Account<'info, ClockAccount>,
    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
    #[account(
        init,
        payer = payer,
        space = 8 + BlackjackGame::INIT_SPACE,
        seeds = [b"blackjack_game".as_ref(), game_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub blackjack_game: Account<'info, BlackjackGame>,
}

#[callback_accounts("shuffle_and_deal_cards")]
#[derive(Accounts)]
pub struct ShuffleAndDealCardsCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    #[account(
        address = derive_comp_def_pda!(COMP_DEF_OFFSET_SHUFFLE_AND_DEAL_CARDS)
    )]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(
        address = derive_mxe_pda!()
    )]
    pub mxe_account: Account<'info, MXEAccount>,
    pub computation_account: UncheckedAccount<'info>,
    #[account(
        address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet)
    )]
    pub cluster_account: Account<'info, Cluster>,
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions_sysvar: AccountInfo<'info>,
    #[account(mut)]
    pub blackjack_game: Account<'info, BlackjackGame>,
}

#[init_computation_definition_accounts("shuffle_and_deal_cards", payer)]
#[derive(Accounts)]
pub struct InitShuffleAndDealCardsCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        address = derive_mxe_pda!()
    )]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    #[account(mut)]
    pub comp_def_account: UncheckedAccount<'info>,
    #[account(mut, address = derive_mxe_lut_pda!(mxe_account.lut_offset_slot))]
    pub address_lookup_table: UncheckedAccount<'info>,
    #[account(address = LUT_PROGRAM_ID)]
    pub lut_program: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

#[queue_computation_accounts("player_hit", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64, _game_id: u64)]
pub struct PlayerHit<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init_if_needed,
        space = 9,
        payer = payer,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, ArciumSignerAccount>,
    #[account(
        address = derive_mxe_pda!()
    )]
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(
        mut,
        address = derive_mempool_pda!(mxe_account, ErrorCode::ClusterNotSet)
    )]
    pub mempool_account: UncheckedAccount<'info>,
    #[account(
        mut,
        address = derive_execpool_pda!(mxe_account, ErrorCode::ClusterNotSet)
    )]
    pub executing_pool: UncheckedAccount<'info>,
    #[account(
        mut,
        address = derive_comp_pda!(computation_offset, mxe_account, ErrorCode::ClusterNotSet)
    )]
    pub computation_account: UncheckedAccount<'info>,
    #[account(
        address = derive_comp_def_pda!(COMP_DEF_OFFSET_PLAYER_HIT)
    )]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(
        mut,
        address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet)
    )]
    pub cluster_account: Account<'info, Cluster>,
    #[account(
        mut,
        address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS,
    )]
    pub pool_account: Account<'info, FeePool>,
    #[account(
        mut,
        address = ARCIUM_CLOCK_ACCOUNT_ADDRESS,
    )]
    pub clock_account: Account<'info, ClockAccount>,
    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
    #[account(
        mut,
        seeds = [b"blackjack_game".as_ref(), _game_id.to_le_bytes().as_ref()],
        bump = blackjack_game.bump,
    )]
    pub blackjack_game: Account<'info, BlackjackGame>,
}

#[callback_accounts("player_hit")]
#[derive(Accounts)]
pub struct PlayerHitCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    #[account(
        address = derive_comp_def_pda!(COMP_DEF_OFFSET_PLAYER_HIT)
    )]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(
        address = derive_mxe_pda!()
    )]
    pub mxe_account: Account<'info, MXEAccount>,
    pub computation_account: UncheckedAccount<'info>,
    #[account(
        address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet)
    )]
    pub cluster_account: Account<'info, Cluster>,
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions_sysvar: AccountInfo<'info>,
    #[account(mut)]
    pub blackjack_game: Account<'info, BlackjackGame>,
}

#[init_computation_definition_accounts("player_hit", payer)]
#[derive(Accounts)]
pub struct InitPlayerHitCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        address = derive_mxe_pda!()
    )]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    #[account(mut)]
    pub comp_def_account: UncheckedAccount<'info>,
    #[account(mut, address = derive_mxe_lut_pda!(mxe_account.lut_offset_slot))]
    pub address_lookup_table: UncheckedAccount<'info>,
    #[account(address = LUT_PROGRAM_ID)]
    pub lut_program: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}


#[queue_computation_accounts("player_stand", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64, _game_id: u64)]
pub struct PlayerStand<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init_if_needed,
        space = 9,
        payer = payer,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, ArciumSignerAccount>,
    #[account(
        address = derive_mxe_pda!()
    )]
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(
        mut,
        address = derive_mempool_pda!(mxe_account, ErrorCode::ClusterNotSet)
    )]
    pub mempool_account: UncheckedAccount<'info>,
    #[account(
        mut,
        address = derive_execpool_pda!(mxe_account, ErrorCode::ClusterNotSet)
    )]
    pub executing_pool: UncheckedAccount<'info>,
    #[account(
        mut,
        address = derive_comp_pda!(computation_offset, mxe_account, ErrorCode::ClusterNotSet)
    )]
    pub computation_account: UncheckedAccount<'info>,
    #[account(
        address = derive_comp_def_pda!(COMP_DEF_OFFSET_PLAYER_STAND)
    )]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(
        mut,
        address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet)
    )]
    pub cluster_account: Account<'info, Cluster>,
    #[account(
        mut,
        address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS,
    )]
    pub pool_account: Account<'info, FeePool>,
    #[account(
        mut,
        address = ARCIUM_CLOCK_ACCOUNT_ADDRESS,
    )]
    pub clock_account: Account<'info, ClockAccount>,
    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
    #[account(
        mut,
        seeds = [b"blackjack_game".as_ref(), _game_id.to_le_bytes().as_ref()],
        bump = blackjack_game.bump,
    )]
    pub blackjack_game: Account<'info, BlackjackGame>,
}

#[callback_accounts("player_stand")]
#[derive(Accounts)]
pub struct PlayerStandCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    #[account(
        address = derive_comp_def_pda!(COMP_DEF_OFFSET_PLAYER_STAND)
    )]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(
        address = derive_mxe_pda!()
    )]
    pub mxe_account: Account<'info, MXEAccount>,
    pub computation_account: UncheckedAccount<'info>,
    #[account(
        address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet)
    )]
    pub cluster_account: Account<'info, Cluster>,
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions_sysvar: AccountInfo<'info>,
    #[account(mut)]
    pub blackjack_game: Account<'info, BlackjackGame>,
}

#[init_computation_definition_accounts("player_stand", payer)]
#[derive(Accounts)]
pub struct InitPlayerStandCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        address = derive_mxe_pda!()
    )]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    #[account(mut)]
    pub comp_def_account: UncheckedAccount<'info>,
    #[account(mut, address = derive_mxe_lut_pda!(mxe_account.lut_offset_slot))]
    pub address_lookup_table: UncheckedAccount<'info>,
    #[account(address = LUT_PROGRAM_ID)]
    pub lut_program: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

#[queue_computation_accounts("dealer_play", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64, _game_id: u64)]
pub struct DealerPlay<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init_if_needed,
        space = 9,
        payer = payer,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, ArciumSignerAccount>,
    #[account(
        address = derive_mxe_pda!()
    )]
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(
        mut,
        address = derive_mempool_pda!(mxe_account, ErrorCode::ClusterNotSet)
    )]
    pub mempool_account: UncheckedAccount<'info>,
    #[account(
        mut,
        address = derive_execpool_pda!(mxe_account, ErrorCode::ClusterNotSet)
    )]
    pub executing_pool: UncheckedAccount<'info>,
    #[account(
        mut,
        address = derive_comp_pda!(computation_offset, mxe_account, ErrorCode::ClusterNotSet)
    )]
    pub computation_account: UncheckedAccount<'info>,
    #[account(
        address = derive_comp_def_pda!(COMP_DEF_OFFSET_DEALER_PLAY)
    )]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(
        mut,
        address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet)
    )]
    pub cluster_account: Account<'info, Cluster>,
    #[account(
        mut,
        address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS,
    )]
    pub pool_account: Account<'info, FeePool>,
    #[account(
        mut,
        address = ARCIUM_CLOCK_ACCOUNT_ADDRESS,
    )]
    pub clock_account: Account<'info, ClockAccount>,
    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
    #[account(
        mut,
        seeds = [b"blackjack_game".as_ref(), _game_id.to_le_bytes().as_ref()],
        bump = blackjack_game.bump,
    )]
    pub blackjack_game: Account<'info, BlackjackGame>,
}

#[callback_accounts("dealer_play")]
#[derive(Accounts)]
pub struct DealerPlayCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    #[account(
        address = derive_comp_def_pda!(COMP_DEF_OFFSET_DEALER_PLAY)
    )]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(
        address = derive_mxe_pda!()
    )]
    pub mxe_account: Account<'info, MXEAccount>,
    pub computation_account: UncheckedAccount<'info>,
    #[account(
        address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet)
    )]
    pub cluster_account: Account<'info, Cluster>,
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions_sysvar: AccountInfo<'info>,
    #[account(mut)]
    pub blackjack_game: Account<'info, BlackjackGame>,
}

#[init_computation_definition_accounts("dealer_play", payer)]
#[derive(Accounts)]
pub struct InitDealerPlayCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        address = derive_mxe_pda!()
    )]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    #[account(mut)]
    pub comp_def_account: UncheckedAccount<'info>,
    #[account(mut, address = derive_mxe_lut_pda!(mxe_account.lut_offset_slot))]
    pub address_lookup_table: UncheckedAccount<'info>,
    #[account(address = LUT_PROGRAM_ID)]
    pub lut_program: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

#[queue_computation_accounts("resolve_game", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64, _game_id: u64)]
pub struct ResolveGame<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init_if_needed,
        space = 9,
        payer = payer,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, ArciumSignerAccount>,
    #[account(
        address = derive_mxe_pda!()
    )]
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(
        mut,
        address = derive_mempool_pda!(mxe_account, ErrorCode::ClusterNotSet)
    )]
    pub mempool_account: UncheckedAccount<'info>,
    #[account(
        mut,
        address = derive_execpool_pda!(mxe_account, ErrorCode::ClusterNotSet)
    )]
    pub executing_pool: UncheckedAccount<'info>,
    #[account(
        mut,
        address = derive_comp_pda!(computation_offset, mxe_account, ErrorCode::ClusterNotSet)
    )]
    pub computation_account: UncheckedAccount<'info>,
    #[account(
        address = derive_comp_def_pda!(COMP_DEF_OFFSET_RESOLVE_GAME)
    )]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(
        mut,
        address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet)
    )]
    pub cluster_account: Account<'info, Cluster>,
    #[account(
        mut,
        address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS,
    )]
    pub pool_account: Account<'info, FeePool>,
    #[account(
        mut,
        address = ARCIUM_CLOCK_ACCOUNT_ADDRESS,
    )]
    pub clock_account: Account<'info, ClockAccount>,
    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
    #[account(
        mut,
        seeds = [b"blackjack_game".as_ref(), _game_id.to_le_bytes().as_ref()],
        bump = blackjack_game.bump,
    )]
    pub blackjack_game: Account<'info, BlackjackGame>,
}

#[callback_accounts("resolve_game")]
#[derive(Accounts)]
pub struct ResolveGameCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    #[account(
        address = derive_comp_def_pda!(COMP_DEF_OFFSET_RESOLVE_GAME)
    )]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(
        address = derive_mxe_pda!()
    )]
    pub mxe_account: Account<'info, MXEAccount>,
    pub computation_account: UncheckedAccount<'info>,
    #[account(
        address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet)
    )]
    pub cluster_account: Account<'info, Cluster>,
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions_sysvar: AccountInfo<'info>,
    #[account(mut)]
    pub blackjack_game: Account<'info, BlackjackGame>,
}

#[init_computation_definition_accounts("resolve_game", payer)]
#[derive(Accounts)]
pub struct InitResolveGameCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        address = derive_mxe_pda!()
    )]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    #[account(mut)]
    pub comp_def_account: UncheckedAccount<'info>,
    #[account(mut, address = derive_mxe_lut_pda!(mxe_account.lut_offset_slot))]
    pub address_lookup_table: UncheckedAccount<'info>,
    #[account(address = LUT_PROGRAM_ID)]
    pub lut_program: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct BlackjackGame {
    pub deck: [[u8; 32]; 2],
    pub player_hand: [u8; 32],
    pub dealer_hand: [u8; 32],
    pub deck_nonce: u128,
    pub client_nonce: u128,
    pub dealer_nonce: u128,
    pub game_id: u64,
    pub player_pubkey: Pubkey,
    pub player_enc_pubkey: [u8; 32],
    pub bump: u8,
    pub game_state: GameState,
    pub player_hand_size: u8,
    pub dealer_hand_size: u8,
    pub player_has_stood: bool,
    pub game_result: u8,
}

#[repr(u8)]
#[derive(InitSpace, AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum GameState {
    Initial = 0,
    PlayerTurn = 1,
    DealerTurn = 2,
    Resolving = 3,
    Resolved = 4,
}

#[event]
pub struct CardsShuffledAndDealtEvent {
    pub player_hand: [u8; 32],
    pub dealer_face_up_card: [u8; 32],
    pub client_nonce: u128,
    pub dealer_client_nonce: u128,
    pub game_id: u64,
}

#[event]
pub struct PlayerHitEvent {
    pub player_hand: [u8; 32],
    pub client_nonce: u128,
    pub game_id: u64,
}

#[event]
pub struct PlayerStandEvent {
    pub is_bust: bool,
    pub game_id: u64,
}

#[event]
pub struct PlayerBustEvent {
    pub client_nonce: u128,
    pub game_id: u64,
}

#[event]
pub struct DealerPlayEvent {
    pub dealer_hand: [u8; 32],
    pub dealer_hand_size: u8,
    pub client_nonce: u128,
    pub game_id: u64,
}

#[event]
pub struct ResultEvent {
    pub winner: String,
    pub game_id: u64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("The computation was aborted")]
    AbortedComputation,
    #[msg("Invalid game state")]
    InvalidGameState,
    #[msg("Invalid move")]
    InvalidMove,
    #[msg("Invalid dealer client pubkey")]
    InvalidDealerClientPubkey,
    #[msg("Cluster not set")]
    ClusterNotSet,
}