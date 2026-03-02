import { PublicKey, Connection, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js';
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
  deserializeLE,
} from '@arcium-hq/client';
// @ts-ignore
import coinflipIdl from '@coinflip-idl';

export const COINFLIP_PROGRAM_ID = new PublicKey('4diAQSb5erA2FVmbnVkzQfGvx3n2WftxsWeGW38Wxrqv');
export const ARCIUM_MAIN_PROGRAM_ID = getArciumProgramId();
export const CLUSTER_OFFSET = 456;

export const DISCRIMINATORS = {
  init_flip_comp_def: Buffer.from([75, 38, 202, 55, 163, 72, 59, 59]),
  flip: Buffer.from([24, 243, 78, 161, 192, 246, 102, 103]),
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

export enum CoinflipAction {
  FlipHeads = 0,
  FlipTails = 1,
}

export interface FlipResult {
  won: boolean;
  signature: string;
}

export class ArciumClient {
  private connection: Connection;
  private wallet: anchor.Wallet;
  private provider: anchor.AnchorProvider;
  private program: anchor.Program;
  private lastTransactionSignature: string | null = null;
  private programId: PublicKey;

  constructor(connection: Connection, wallet: anchor.Wallet, programId?: PublicKey) {
    this.connection = connection;
    this.wallet = wallet;
    this.programId = programId || COINFLIP_PROGRAM_ID;
    this.provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' });
    this.program = new anchor.Program(coinflipIdl as anchor.Idl, this.provider);
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
      const fallback = import.meta.env.VITE_COINFLIP_MXE_PUBLIC_KEY;
      if (!fallback) throw new Error('VITE_COINFLIP_MXE_PUBLIC_KEY is not set and MXE key fetch failed');
      return new Uint8Array(Buffer.from(fallback, 'hex'));
    }
  }

  private async sendTransaction(
    data: Buffer,
    accounts: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[],
  ): Promise<string> {
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

  async encryptAndSubmitFlip(choice: CoinflipAction): Promise<FlipResult> {
    const privateKey = x25519.utils.randomPrivateKey();
    const publicKey = x25519.getPublicKey(privateKey);
    const mxePublicKey = await this.getMXEPublicKeyWithRetry();
    const sharedSecret = x25519.getSharedSecret(privateKey, mxePublicKey);
    const cipher = new RescueCipher(sharedSecret);

    const userChoice = choice === CoinflipAction.FlipHeads ? BigInt(1) : BigInt(0);
    const nonce = randomBytes(16);
    const ciphertext = cipher.encrypt([userChoice], nonce);
    const computationOffset = new BN(randomBytes(8));

    const data = Buffer.concat([
      DISCRIMINATORS.flip,
      computationOffset.toArrayLike(Buffer, 'le', 8),
      Buffer.from(ciphertext[0]),
      Buffer.from(publicKey),
      new BN(deserializeLE(nonce).toString()).toArrayLike(Buffer, 'le', 16),
    ]);

    const signPda = PublicKey.findProgramAddressSync(
      [Buffer.from('ArciumSignerAccount')],
      this.programId,
    )[0];

    const compDefOffset = Buffer.from(getCompDefAccOffset('flip')).readUInt32LE();

    const keys = [
      { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: signPda, isSigner: false, isWritable: true },
      { pubkey: getMXEAccAddress(this.programId), isSigner: false, isWritable: true },
      { pubkey: getMempoolAccAddress(CLUSTER_OFFSET), isSigner: false, isWritable: true },
      { pubkey: getExecutingPoolAccAddress(CLUSTER_OFFSET), isSigner: false, isWritable: true },
      { pubkey: getComputationAccAddress(CLUSTER_OFFSET, computationOffset), isSigner: false, isWritable: true },
      { pubkey: getCompDefAccAddress(this.programId, compDefOffset), isSigner: false, isWritable: false },
      { pubkey: getClusterAccAddress(CLUSTER_OFFSET), isSigner: false, isWritable: true },
      { pubkey: getFeePoolAccAddress(), isSigner: false, isWritable: true },
      { pubkey: getClockAccAddress(), isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: ARCIUM_MAIN_PROGRAM_ID, isSigner: false, isWritable: false },
    ];

    const eventPromise = this.awaitEvent<any>('flipEvent');

    const signature = await this.sendTransaction(data, keys);

    await awaitComputationFinalization(this.provider, computationOffset, this.programId, 'confirmed');

    const event = await eventPromise;

    return { won: event.result, signature };
  }

  getLastTransactionSignature(): string | null {
    return this.lastTransactionSignature;
  }
}

export class CoinflipClient {
  private arciumClient: ArciumClient;

  constructor(connection: Connection, walletAdapter: any, programId?: PublicKey) {
    if (!walletAdapter?.adapter?.publicKey) {
      throw new Error('Wallet not connected or public key not available');
    }
    const provider = new anchor.AnchorProvider(connection, walletAdapter.adapter, { commitment: 'confirmed' });
    this.arciumClient = new ArciumClient(connection, provider.wallet as anchor.Wallet, programId);
  }

  async flipHeads(): Promise<FlipResult> {
    return this.arciumClient.encryptAndSubmitFlip(CoinflipAction.FlipHeads);
  }

  async flipTails(): Promise<FlipResult> {
    return this.arciumClient.encryptAndSubmitFlip(CoinflipAction.FlipTails);
  }

  getLastTransactionSignature(): string | null {
    return this.arciumClient.getLastTransactionSignature();
  }
}
