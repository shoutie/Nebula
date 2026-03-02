import { PublicKey, Connection, Transaction, TransactionInstruction, SystemProgram, SendTransactionError } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { BN } from '@coral-xyz/anchor';
import {
  getCompDefAccOffset,
  RescueCipher,
  getMXEAccAddress,
  getMempoolAccAddress,
  getCompDefAccAddress,
  getExecutingPoolAccAddress,
  x25519,
  getComputationAccAddress,
  awaitComputationFinalization,
  getClusterAccAddress,
  getMXEPublicKey,
  getFeePoolAccAddress,
  getClockAccAddress,
  getArciumProgramId,
  deserializeLE
} from '@arcium-hq/client';
import { Card, Suit, Rank, getCardValue } from './blackjack';
// @ts-ignore
import blackjackIdl from '@blackjack-idl';

export const GAME_PROGRAM_ID = new PublicKey('GUSwSKHUyxj66uykQz9nSDNrjyh6cBDEK2iuJuEEKHBe');
export const ARCIUM_MAIN_PROGRAM_ID = getArciumProgramId();
export const CLUSTER_OFFSET = 456;

export const DISCRIMINATORS = {
  initialize_blackjack_game: Buffer.from([9, 80, 117, 159, 82, 63, 20, 94]),
  player_hit: Buffer.from([29, 3, 180, 101, 8, 106, 205, 34]),
  player_stand: Buffer.from([128, 194, 19, 170, 132, 217, 87, 255]),
  dealer_play: Buffer.from([231, 236, 27, 254, 217, 70, 48, 134]),
  resolve_game: Buffer.from([25, 119, 183, 229, 196, 69, 169, 79]),
};

function randomBytes(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < size; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

function cardIndexToCard(index: number): Card {
  const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
  const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const rank = RANKS[index % 13];
  const suit = SUITS[Math.floor(index / 13)];
  return { suit, rank, value: getCardValue(rank) };
}

function decompressHand(compressedHandValue: bigint, handSize: number): number[] {
  let val = compressedHandValue;
  const cards: number[] = [];
  for (let i = 0; i < 11; i++) {
    cards.push(Number(val & BigInt(0xFF)));
    val >>= BigInt(8);
  }
  return cards.slice(0, handSize).filter(c => c <= 51);
}

function decryptHand(
  cipher: RescueCipher,
  encryptedHand: any,
  nonceBN: any,
  handSize: number
): Card[] {
  const nonce = Uint8Array.from(nonceBN.toArray('le', 16));
  const decrypted = cipher.decrypt([encryptedHand], nonce);
  const indices = decompressHand(decrypted[0], handSize);
  return indices.map(cardIndexToCard);
}

function decryptSingleCard(cipher: RescueCipher, encryptedCard: any, nonceBN: any): Card {
  const nonce = Uint8Array.from(nonceBN.toArray('le', 16));
  const decrypted = cipher.decrypt([encryptedCard], nonce);
  const index = Number(decrypted[0] % BigInt(64));
  return cardIndexToCard(index <= 51 ? index : 0);
}

export interface DealResult {
  playerHand: Card[];
  dealerFaceUpCard: Card;
  signature: string;
}

export interface HitResult {
  playerHand: Card[];
  isBust: boolean;
  signature: string;
}

export interface StandResult {
  isBust: boolean;
  signature: string;
}

export interface DealerPlayResult {
  dealerHand: Card[];
  signature: string;
}

export interface GameResult {
  winner: 'Player' | 'Dealer' | 'Tie';
}

interface GameSession {
  cipher: RescueCipher;
  gameId: number;
}

export class ArciumClient {
  private connection: Connection;
  private wallet: anchor.Wallet;
  private provider: anchor.AnchorProvider;
  private programId: PublicKey;
  private program: anchor.Program;
  private session: GameSession | null = null;
  private lastTransactionSignature: string | null = null;

  constructor(connection: Connection, wallet: anchor.Wallet, programId?: PublicKey) {
    this.connection = connection;
    this.wallet = wallet;
    this.programId = programId || GAME_PROGRAM_ID;
    this.provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' });
    this.program = new anchor.Program(blackjackIdl as anchor.Idl, this.provider);
  }

  private awaitEvent<T>(eventName: string, timeoutMs = 90000): Promise<T> {
    let listenerId: number;
    let timeoutId: ReturnType<typeof setTimeout>;
    return new Promise<T>((resolve, reject) => {
      listenerId = this.program.addEventListener(eventName, (event: T) => {
        clearTimeout(timeoutId);
        this.program.removeEventListener(listenerId);
        resolve(event);
      });
      timeoutId = setTimeout(() => {
        this.program.removeEventListener(listenerId);
        reject(new Error(`Event "${eventName}" timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  async getMXEPublicKeyWithRetry(): Promise<Uint8Array> {
    try {
      const key = await getMXEPublicKey(this.provider, this.programId);
      if (key) return key;
      throw new Error('MXE public key is null');
    } catch {
      const fallback = import.meta.env.VITE_BLACKJACK_MXE_PUBLIC_KEY;
      if (!fallback) throw new Error('VITE_BLACKJACK_MXE_PUBLIC_KEY is not set and MXE key fetch failed');
      return new Uint8Array(Buffer.from(fallback, 'hex'));
    }
  }

  private async sendTransaction(data: Buffer, accounts: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[]): Promise<string> {
    const ix = new TransactionInstruction({ keys: accounts, programId: this.programId, data });
    const tx = new Transaction();
    tx.add(ix);
    const { blockhash } = await this.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = this.wallet.publicKey;
    const signed = await this.wallet.signTransaction(tx);
    const sig = await this.connection.sendRawTransaction(signed.serialize());
    await this.connection.confirmTransaction(sig, 'confirmed');
    this.lastTransactionSignature = sig;
    return sig;
  }

  private buildAccounts(computationOffset: BN, compDefName: string, gameId: number) {
    const blackjackGamePda = PublicKey.findProgramAddressSync(
      [Buffer.from('blackjack_game'), new BN(gameId).toArrayLike(Buffer, 'le', 8)],
      this.programId
    )[0];
    const signPda = PublicKey.findProgramAddressSync([Buffer.from('ArciumSignerAccount')], this.programId)[0];

    return {
      blackjackGamePda,
      keys: [
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: signPda, isSigner: false, isWritable: true },
        { pubkey: getMXEAccAddress(this.programId), isSigner: false, isWritable: true },
        { pubkey: getMempoolAccAddress(CLUSTER_OFFSET), isSigner: false, isWritable: true },
        { pubkey: getExecutingPoolAccAddress(CLUSTER_OFFSET), isSigner: false, isWritable: true },
        { pubkey: getComputationAccAddress(CLUSTER_OFFSET, computationOffset), isSigner: false, isWritable: true },
        { pubkey: getCompDefAccAddress(this.programId, Buffer.from(getCompDefAccOffset(compDefName)).readUInt32LE()), isSigner: false, isWritable: false },
        { pubkey: getClusterAccAddress(CLUSTER_OFFSET), isSigner: false, isWritable: true },
        { pubkey: getFeePoolAccAddress(), isSigner: false, isWritable: true },
        { pubkey: getClockAccAddress(), isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: ARCIUM_MAIN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: blackjackGamePda, isSigner: false, isWritable: true },
      ],
    };
  }

  async initializeEncryptedGame(gameId: number): Promise<DealResult> {
    const privateKey = x25519.utils.randomSecretKey();
    const publicKey = x25519.getPublicKey(privateKey);
    const mxePublicKey = await this.getMXEPublicKeyWithRetry();
    const sharedSecret = x25519.getSharedSecret(privateKey, mxePublicKey);
    const cipher = new RescueCipher(sharedSecret);

    this.session = { cipher, gameId };

    const computationOffset = new BN(randomBytes(8));
    const clientNonce = randomBytes(16);
    const dealerClientNonce = randomBytes(16);

    const eventPromise = this.awaitEvent<any>('cardsShuffledAndDealtEvent');

    const { keys } = this.buildAccounts(computationOffset, 'shuffle_and_deal_cards', gameId);
    const data = Buffer.concat([
      DISCRIMINATORS.initialize_blackjack_game,
      computationOffset.toArrayLike(Buffer, 'le', 8),
      new BN(gameId).toArrayLike(Buffer, 'le', 8),
      Buffer.from(publicKey),
      Buffer.from(clientNonce),
      Buffer.from(dealerClientNonce),
    ]);

    const signature = await this.sendTransaction(data, keys);

    await awaitComputationFinalization(this.provider, computationOffset, this.programId, 'confirmed');

    const event = await eventPromise;

    const blackjackGamePda = PublicKey.findProgramAddressSync(
      [Buffer.from('blackjack_game'), new BN(gameId).toArrayLike(Buffer, 'le', 8)],
      this.programId
    )[0];
    const gameAccount = await (this.program.account as any).blackjackGame.fetch(blackjackGamePda);

    const playerHand = decryptHand(cipher, event.playerHand, event.clientNonce, gameAccount.playerHandSize);
    const dealerFaceUpCard = decryptSingleCard(cipher, event.dealerFaceUpCard, event.dealerClientNonce);

    return { playerHand, dealerFaceUpCard, signature };
  }

  async playerEncryptedHit(): Promise<HitResult> {
    if (!this.session) throw new Error('Game not initialized');
    const { cipher, gameId } = this.session;

    const computationOffset = new BN(randomBytes(8));

    const hitEventPromise = this.awaitEvent<any>('playerHitEvent');
    const bustEventPromise = this.awaitEvent<any>('playerBustEvent');

    const { keys } = this.buildAccounts(computationOffset, 'player_hit', gameId);
    const data = Buffer.concat([
      DISCRIMINATORS.player_hit,
      computationOffset.toArrayLike(Buffer, 'le', 8),
      new BN(gameId).toArrayLike(Buffer, 'le', 8),
    ]);

    const signature = await this.sendTransaction(data, keys);

    await awaitComputationFinalization(this.provider, computationOffset, this.programId, 'confirmed');

    const event = await Promise.race([hitEventPromise, bustEventPromise]);

    const blackjackGamePda = PublicKey.findProgramAddressSync(
      [Buffer.from('blackjack_game'), new BN(gameId).toArrayLike(Buffer, 'le', 8)],
      this.programId
    )[0];
    const gameAccount = await (this.program.account as any).blackjackGame.fetch(blackjackGamePda);

    if ('playerHand' in event) {
      const playerHand = decryptHand(cipher, event.playerHand, event.clientNonce, gameAccount.playerHandSize);
      return { playerHand, isBust: false, signature };
    } else {
      const playerHand = decryptHand(cipher, gameAccount.playerHand, event.clientNonce, gameAccount.playerHandSize);
      return { playerHand, isBust: true, signature };
    }
  }

  async playerEncryptedStand(): Promise<StandResult> {
    if (!this.session) throw new Error('Game not initialized');
    const { gameId } = this.session;

    const computationOffset = new BN(randomBytes(8));
    const eventPromise = this.awaitEvent<any>('playerStandEvent');

    const { keys } = this.buildAccounts(computationOffset, 'player_stand', gameId);
    const data = Buffer.concat([
      DISCRIMINATORS.player_stand,
      computationOffset.toArrayLike(Buffer, 'le', 8),
      new BN(gameId).toArrayLike(Buffer, 'le', 8),
    ]);

    const signature = await this.sendTransaction(data, keys);

    await awaitComputationFinalization(this.provider, computationOffset, this.programId, 'confirmed');

    const event = await eventPromise;

    return { isBust: event.isBust, signature };
  }

  async dealerEncryptedPlay(): Promise<DealerPlayResult> {
    if (!this.session) throw new Error('Game not initialized');
    const { cipher, gameId } = this.session;

    const computationOffset = new BN(randomBytes(8));
    const dealerNonce = randomBytes(16);
    const eventPromise = this.awaitEvent<any>('dealerPlayEvent', 180000);

    const { keys } = this.buildAccounts(computationOffset, 'dealer_play', gameId);
    const data = Buffer.concat([
      DISCRIMINATORS.dealer_play,
      computationOffset.toArrayLike(Buffer, 'le', 8),
      new BN(gameId).toArrayLike(Buffer, 'le', 8),
      Buffer.from(dealerNonce),
    ]);

    const signature = await this.sendTransaction(data, keys);

    await awaitComputationFinalization(this.provider, computationOffset, this.programId, 'confirmed');

    const event = await eventPromise;

    const dealerHand = decryptHand(cipher, event.dealerHand, event.clientNonce, event.dealerHandSize);

    return { dealerHand, signature };
  }

  async resolveEncryptedGame(): Promise<GameResult> {
    if (!this.session) throw new Error('Game not initialized');
    const { gameId } = this.session;

    const computationOffset = new BN(randomBytes(8));
    const eventPromise = this.awaitEvent<any>('resultEvent');

    const { keys } = this.buildAccounts(computationOffset, 'resolve_game', gameId);
    const data = Buffer.concat([
      DISCRIMINATORS.resolve_game,
      computationOffset.toArrayLike(Buffer, 'le', 8),
      new BN(gameId).toArrayLike(Buffer, 'le', 8),
    ]);

    const signature = await this.sendTransaction(data, keys);

    await awaitComputationFinalization(this.provider, computationOffset, this.programId, 'confirmed');

    const event = await eventPromise;

    this.lastTransactionSignature = signature;

    const winner = event.winner as 'Player' | 'Dealer' | 'Tie';
    return { winner };
  }

  getLastTransactionSignature(): string | null {
    return this.lastTransactionSignature;
  }
}

export class BlackjackClient {
  private arciumClient: ArciumClient;

  constructor(connection: Connection, walletAdapter: any, programId?: PublicKey) {
    if (!walletAdapter?.adapter?.publicKey) {
      throw new Error('Wallet not connected');
    }
    const provider = new anchor.AnchorProvider(connection, walletAdapter.adapter, { commitment: 'confirmed' });
    this.arciumClient = new ArciumClient(connection, provider.wallet as anchor.Wallet, programId);
  }

  async initializeGame(gameId: number): Promise<DealResult> {
    return this.arciumClient.initializeEncryptedGame(gameId);
  }

  async playerHit(gameId: number): Promise<HitResult> {
    return this.arciumClient.playerEncryptedHit();
  }

  async playerStand(gameId: number): Promise<StandResult> {
    return this.arciumClient.playerEncryptedStand();
  }

  async dealerPlay(gameId: number): Promise<DealerPlayResult> {
    return this.arciumClient.dealerEncryptedPlay();
  }

  async resolveGame(gameId: number): Promise<GameResult> {
    return this.arciumClient.resolveEncryptedGame();
  }

  getLastTransactionSignature(): string | null {
    return this.arciumClient.getLastTransactionSignature();
  }
}
