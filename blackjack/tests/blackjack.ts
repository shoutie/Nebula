import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair } from "@solana/web3.js";
import { Blackjack } from "../target/types/blackjack";
import { randomBytes } from "crypto";
import {
  awaitComputationFinalization,
  getArciumEnv,
  getCompDefAccOffset,
  getArciumProgramId,
  uploadCircuit,
  RescueCipher,
  deserializeLE,
  getMXEAccAddress,
  getMempoolAccAddress,
  getCompDefAccAddress,
  getExecutingPoolAccAddress,
  x25519,
  getComputationAccAddress,
  getArciumAccountBaseSeed,
  getMXEPublicKey,
  getClusterAccAddress,
  getLookupTableAddress,
  getArciumProgram,
} from "@arcium-hq/client";
import * as fs from "fs";
import * as os from "os";
import { expect } from "chai";

function calculateHandValue(cards: number[]): {
  value: number;
  isSoft: boolean;
} {
  let value = 0;
  let aceCount = 0;
  let isSoft = false;

  for (const cardIndex of cards) {
    const rank = cardIndex % 13;
    if (rank === 0) {
      aceCount++;
      value += 11;
    } else if (rank >= 10) {
      value += 10;
    } else {
      value += rank + 1;
    }
  }

  while (value > 21 && aceCount > 0) {
    value -= 10;
    aceCount--;
  }

  isSoft = aceCount > 0 && value <= 21;

  return { value, isSoft };
}

function decompressHand(
  compressedHandValue: bigint,
  handSize: number
): number[] {
  let currentHandValue = compressedHandValue;
  const cards: number[] = [];
  const numCardSlots = 11;

  for (let i = 0; i < numCardSlots; i++) {
    const card = currentHandValue % BigInt(64);
    cards.push(Number(card));
    currentHandValue >>= BigInt(6);
  }

  return cards
    .slice(0, handSize)
    .filter((card) => card <= 51)
    .reverse();
}

describe("Blackjack", () => {
  const owner = readKpJson(`${os.homedir()}/.config/solana/id.json`);

  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.Blackjack as Program<Blackjack>;
  const provider = anchor.getProvider() as anchor.AnchorProvider;

  type Event = anchor.IdlEvents<(typeof program)["idl"]>;
  const awaitEvent = async <E extends keyof Event>(
    eventName: E,
    timeoutMs = 60000
  ): Promise<Event[E]> => {
    let listenerId: number;
    let timeoutId: NodeJS.Timeout;
    const event = await new Promise<Event[E]>((res, rej) => {
      listenerId = program.addEventListener(eventName as any, (event) => {
        if (timeoutId) clearTimeout(timeoutId);
        res(event);
      });
      timeoutId = setTimeout(() => {
        program.removeEventListener(listenerId);
        rej(new Error(`Event ${eventName} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
    await program.removeEventListener(listenerId);
    return event;
  };

  const arciumEnv = getArciumEnv();
  const clusterAccount = getClusterAccAddress(arciumEnv.arciumClusterOffset);

  it("Should play a full blackjack game with state awareness", async () => {
    console.log("Owner address:", owner.publicKey.toBase58());

    await Promise.all([
      initShuffleAndDealCardsCompDef(program as any, owner),
      initPlayerHitCompDef(program as any, owner),
      initPlayerStandCompDef(program as any, owner),
      initDealerPlayCompDef(program as any, owner),
      initResolveGameCompDef(program as any, owner),
    ]);
    await new Promise((res) => setTimeout(res, 2000));

    const privateKey = x25519.utils.randomSecretKey();
    const publicKey = x25519.getPublicKey(privateKey);
    const mxePublicKey = await getMXEPublicKeyWithRetry(
      provider as anchor.AnchorProvider,
      program.programId
    );

    const sharedSecret = x25519.getSharedSecret(privateKey, mxePublicKey);
    const cipher = new RescueCipher(sharedSecret);
    const clientNonce = randomBytes(16);
    const dealerClientNonce = randomBytes(16);

    const gameId = BigInt(Math.floor(Math.random() * 1000000));

    const computationOffsetInit = new anchor.BN(randomBytes(8));

    const gameIdBuffer = Buffer.alloc(8);
    gameIdBuffer.writeBigUInt64LE(gameId);

    const blackjackGamePDA = PublicKey.findProgramAddressSync(
      [Buffer.from("blackjack_game"), gameIdBuffer],
      program.programId
    )[0];

    const cardsShuffledAndDealtEventPromise = awaitEvent(
      "cardsShuffledAndDealtEvent"
    );

    const initGameSig = await program.methods
      .initializeBlackjackGame(
        computationOffsetInit,
        new anchor.BN(gameId.toString()),
        Array.from(publicKey),
        new anchor.BN(deserializeLE(clientNonce).toString()),
        new anchor.BN(deserializeLE(dealerClientNonce).toString())
      )
      .accountsPartial({
        computationAccount: getComputationAccAddress(
          arciumEnv.arciumClusterOffset,
          computationOffsetInit
        ),
        clusterAccount: clusterAccount,
        mxeAccount: getMXEAccAddress(program.programId),
        mempoolAccount: getMempoolAccAddress(arciumEnv.arciumClusterOffset),
        executingPool: getExecutingPoolAccAddress(
          arciumEnv.arciumClusterOffset
        ),
        compDefAccount: getCompDefAccAddress(
          program.programId,
          Buffer.from(
            getCompDefAccOffset("shuffle_and_deal_cards")
          ).readUInt32LE()
        ),
        blackjackGame: blackjackGamePDA,
      })
      .signers([owner])
      .rpc({ commitment: "confirmed", preflightCommitment: "confirmed" });
    const finalizeInitSig = await awaitComputationFinalization(
      provider,
      computationOffsetInit,
      program.programId,
      "confirmed"
    );

    const cardsShuffledAndDealtEvent = await cardsShuffledAndDealtEventPromise;

    let gameState = await program.account.blackjackGame.fetch(blackjackGamePDA);
    expect(gameState.gameState).to.deep.equal({ playerTurn: {} });

    let currentClientNonce = Uint8Array.from(
      cardsShuffledAndDealtEvent.clientNonce.toArray("le", 16)
    );
    let compressedPlayerHand = cipher.decrypt(
      [cardsShuffledAndDealtEvent.playerHand],
      currentClientNonce
    );
    let playerHand = decompressHand(
      compressedPlayerHand[0],
      gameState.playerHandSize
    );
    let { value: playerValue, isSoft: playerIsSoft } =
      calculateHandValue(playerHand    );

    let currentDealerClientNonce = Uint8Array.from(
      cardsShuffledAndDealtEvent.dealerClientNonce.toArray("le", 16)
    );
    let dealerFaceUpCardEncrypted = cipher.decrypt(
      [cardsShuffledAndDealtEvent.dealerFaceUpCard],
      currentDealerClientNonce
    );
    let dealerFaceUpCard = Number(dealerFaceUpCardEncrypted[0] % BigInt(64));

    let playerBusted = false;
    let playerStood = false;

    while (
      gameState.gameState.hasOwnProperty("playerTurn") &&
      !playerBusted &&
      !playerStood
    ) {

      let action: "hit" | "stand" = "stand";
      if (playerValue < 17 || (playerValue === 17 && playerIsSoft)) {
        action = "hit";
      }

      if (action === "hit") {
        const playerHitComputationOffset = new anchor.BN(randomBytes(8));
        const playerHitEventPromise = awaitEvent("playerHitEvent");
        const playerBustEventPromise = awaitEvent("playerBustEvent");

        const playerHitSig = await program.methods
          .playerHit(
            playerHitComputationOffset,
            new anchor.BN(gameId.toString())
          )
          .accountsPartial({
            computationAccount: getComputationAccAddress(
              arciumEnv.arciumClusterOffset,
              playerHitComputationOffset
            ),
            clusterAccount: clusterAccount,
            mxeAccount: getMXEAccAddress(program.programId),
            mempoolAccount: getMempoolAccAddress(arciumEnv.arciumClusterOffset),
            executingPool: getExecutingPoolAccAddress(
              arciumEnv.arciumClusterOffset
            ),
            compDefAccount: getCompDefAccAddress(
              program.programId,
              Buffer.from(getCompDefAccOffset("player_hit")).readUInt32LE()
            ),
            blackjackGame: blackjackGamePDA,
            payer: owner.publicKey,
          })
          .signers([owner])
          .rpc({ commitment: "confirmed", preflightCommitment: "confirmed" });
        const finalizeHitSig = await awaitComputationFinalization(
          provider,
          playerHitComputationOffset,
          program.programId,
          "confirmed"
        );

        try {
          const playerHitEvent = await Promise.race([
            playerHitEventPromise,
            playerBustEventPromise,
          ]);

          gameState = await program.account.blackjackGame.fetch(
            blackjackGamePDA
          );

          if ("playerHand" in playerHitEvent) {
            currentClientNonce = Uint8Array.from(
              playerHitEvent.clientNonce.toArray("le", 16)
            );
            compressedPlayerHand = cipher.decrypt(
              [playerHitEvent.playerHand],
              currentClientNonce
            );
            playerHand = decompressHand(
              compressedPlayerHand[0],
              gameState.playerHandSize
            );
            ({ value: playerValue, isSoft: playerIsSoft } =
              calculateHandValue(playerHand));

            if (playerValue > 21) {
              playerBusted = true;
            }
          } else {
            playerBusted = true;
            expect(gameState.gameState).to.deep.equal({ dealerTurn: {} });
          }
        } catch (e) {
          console.error("Error waiting for player hit/bust event:", e);
          throw e;
        }
      } else {
        const playerStandComputationOffset = new anchor.BN(randomBytes(8));
        const playerStandEventPromise = awaitEvent("playerStandEvent");

        const playerStandSig = await program.methods
          .playerStand(
            playerStandComputationOffset,
            new anchor.BN(gameId.toString())
          )
          .accountsPartial({
            computationAccount: getComputationAccAddress(
              arciumEnv.arciumClusterOffset,
              playerStandComputationOffset
            ),
            clusterAccount: clusterAccount,
            mxeAccount: getMXEAccAddress(program.programId),
            mempoolAccount: getMempoolAccAddress(arciumEnv.arciumClusterOffset),
            executingPool: getExecutingPoolAccAddress(
              arciumEnv.arciumClusterOffset
            ),
            compDefAccount: getCompDefAccAddress(
              program.programId,
              Buffer.from(getCompDefAccOffset("player_stand")).readUInt32LE()
            ),
            blackjackGame: blackjackGamePDA,
            payer: owner.publicKey,
          })
          .signers([owner])
          .rpc({ commitment: "confirmed", preflightCommitment: "confirmed" });
        const finalizeStandSig = await awaitComputationFinalization(
          provider,
          playerStandComputationOffset,
          program.programId,
          "confirmed"
        );

        const playerStandEvent = await playerStandEventPromise;
        expect(playerStandEvent.isBust).to.be.false;

        playerStood = true;
        gameState = await program.account.blackjackGame.fetch(blackjackGamePDA);
        expect(gameState.gameState).to.deep.equal({ dealerTurn: {} });
      }

      if (!playerBusted && !playerStood) {
        await new Promise((res) => setTimeout(res, 1000));
        gameState = await program.account.blackjackGame.fetch(blackjackGamePDA);
      }
    }

    gameState = await program.account.blackjackGame.fetch(blackjackGamePDA);
    if (gameState.gameState.hasOwnProperty("dealerTurn")) {
      const dealerPlayComputationOffset = new anchor.BN(randomBytes(8));
      const dealerPlayNonce = randomBytes(16);
      const dealerPlayEventPromise = awaitEvent("dealerPlayEvent");

      const dealerPlaySig = await program.methods
        .dealerPlay(
          dealerPlayComputationOffset,
          new anchor.BN(gameId.toString()),
          new anchor.BN(deserializeLE(dealerPlayNonce).toString())
        )
        .accountsPartial({
          computationAccount: getComputationAccAddress(
            arciumEnv.arciumClusterOffset,
            dealerPlayComputationOffset
          ),
          clusterAccount: clusterAccount,
          mxeAccount: getMXEAccAddress(program.programId),
          mempoolAccount: getMempoolAccAddress(arciumEnv.arciumClusterOffset),
          executingPool: getExecutingPoolAccAddress(
            arciumEnv.arciumClusterOffset
          ),
          compDefAccount: getCompDefAccAddress(
            program.programId,
            Buffer.from(getCompDefAccOffset("dealer_play")).readUInt32LE()
          ),
          blackjackGame: blackjackGamePDA,
        })
        .signers([owner])
          .rpc({ commitment: "confirmed", preflightCommitment: "confirmed" });
      const finalizeDealerPlaySig = await awaitComputationFinalization(
        provider,
        dealerPlayComputationOffset,
        program.programId,
        "confirmed"
      );

      const dealerPlayEvent = await dealerPlayEventPromise;

      const finalDealerNonce = Uint8Array.from(
        dealerPlayEvent.clientNonce.toArray("le", 16)
      );
      const decryptedDealerHand = cipher.decrypt(
        [dealerPlayEvent.dealerHand],
        finalDealerNonce
      );
      const dealerHand = decompressHand(
        decryptedDealerHand[0],
        dealerPlayEvent.dealerHandSize
      );
      const { value: dealerValue } = calculateHandValue(dealerHand);
      gameState = await program.account.blackjackGame.fetch(blackjackGamePDA);
      expect(gameState.gameState).to.deep.equal({ resolving: {} });
    } else if (playerBusted) {
    }

    gameState = await program.account.blackjackGame.fetch(blackjackGamePDA);
    if (
      gameState.gameState.hasOwnProperty("resolving") ||
      (playerBusted && gameState.gameState.hasOwnProperty("dealerTurn"))
    ) {
      const resolveComputationOffset = new anchor.BN(randomBytes(8));
      const resultEventPromise = awaitEvent("resultEvent");

      const resolveSig = await program.methods
        .resolveGame(resolveComputationOffset, new anchor.BN(gameId.toString()))
        .accountsPartial({
          computationAccount: getComputationAccAddress(
            arciumEnv.arciumClusterOffset,
            resolveComputationOffset
          ),
          clusterAccount: clusterAccount,
          mxeAccount: getMXEAccAddress(program.programId),
          mempoolAccount: getMempoolAccAddress(arciumEnv.arciumClusterOffset),
          executingPool: getExecutingPoolAccAddress(
            arciumEnv.arciumClusterOffset
          ),
          compDefAccount: getCompDefAccAddress(
            program.programId,
            Buffer.from(getCompDefAccOffset("resolve_game")).readUInt32LE()
          ),
          blackjackGame: blackjackGamePDA,
          payer: owner.publicKey,
        })
          .signers([owner])
        .rpc({ commitment: "confirmed", preflightCommitment: "confirmed" });
      const finalizeResolveSig = await awaitComputationFinalization(
        provider,
        resolveComputationOffset,
        program.programId,
        "confirmed"
      );

      const resultEvent = await resultEventPromise;
      expect(["Player", "Dealer", "Tie"]).to.include(resultEvent.winner);

      gameState = await program.account.blackjackGame.fetch(blackjackGamePDA);
      expect(gameState.gameState).to.deep.equal({ resolved: {} });
    }
  });

  async function initShuffleAndDealCardsCompDef(
    program: Program<Blackjack>,
    owner: Keypair
  ): Promise<string> {
    const baseSeedCompDefAcc = getArciumAccountBaseSeed(
      "ComputationDefinitionAccount"
    );
    const offset = getCompDefAccOffset("shuffle_and_deal_cards");

    const compDefPDA = PublicKey.findProgramAddressSync(
      [baseSeedCompDefAcc, program.programId.toBuffer(), offset],
      getArciumProgramId()
    )[0];

    try {
      await program.account.computationDefinitionAccount.fetch(compDefPDA);
      return "Already Initialized";
    } catch (e) {
    }

    const arciumProgram = getArciumProgram(provider as anchor.AnchorProvider);
    const mxeAccount = getMXEAccAddress(program.programId);
    const mxeAcc = await arciumProgram.account.mxeAccount.fetch(mxeAccount);
    const lutAddress = getLookupTableAddress(
      program.programId,
      mxeAcc.lutOffsetSlot
    );

    const sig = await program.methods
      .initShuffleAndDealCardsCompDef()
      .accounts({
        compDefAccount: compDefPDA,
        payer: owner.publicKey,
        mxeAccount,
        addressLookupTable: lutAddress,
      })
      .rpc({ commitment: "confirmed", preflightCommitment: "confirmed" });

    const rawCircuit = fs.readFileSync("build/shuffle_and_deal_cards.arcis");
    await uploadCircuit(
      provider as anchor.AnchorProvider,
      "shuffle_and_deal_cards",
      program.programId,
      rawCircuit,
      true
    );

    return sig;
  }

  async function initPlayerHitCompDef(
    program: Program<Blackjack>,
    owner: Keypair
  ): Promise<string> {
    const baseSeedCompDefAcc = getArciumAccountBaseSeed(
      "ComputationDefinitionAccount"
    );
    const offset = getCompDefAccOffset("player_hit");
    const compDefPDA = PublicKey.findProgramAddressSync(
      [baseSeedCompDefAcc, program.programId.toBuffer(), offset],
      getArciumProgramId()
    )[0];

    try {
      await program.account.computationDefinitionAccount.fetch(compDefPDA);
      return "Already Initialized";
    } catch (e) {
    }

    const arciumProgram = getArciumProgram(provider as anchor.AnchorProvider);
    const mxeAccount = getMXEAccAddress(program.programId);
    const mxeAcc = await arciumProgram.account.mxeAccount.fetch(mxeAccount);
    const lutAddress = getLookupTableAddress(
      program.programId,
      mxeAcc.lutOffsetSlot
    );

    const sig = await program.methods
      .initPlayerHitCompDef()
      .accounts({
        compDefAccount: compDefPDA,
        payer: owner.publicKey,
        mxeAccount,
        addressLookupTable: lutAddress,
      })
      .rpc({ commitment: "confirmed", preflightCommitment: "confirmed" });

    const rawCircuit = fs.readFileSync("build/player_hit.arcis");
    await uploadCircuit(
      provider as anchor.AnchorProvider,
      "player_hit",
      program.programId,
      rawCircuit,
      true
    );

    return sig;
  }

  async function initPlayerStandCompDef(
    program: Program<Blackjack>,
    owner: Keypair
  ): Promise<string> {
    const baseSeedCompDefAcc = getArciumAccountBaseSeed(
      "ComputationDefinitionAccount"
    );
    const offset = getCompDefAccOffset("player_stand");
    const compDefPDA = PublicKey.findProgramAddressSync(
      [baseSeedCompDefAcc, program.programId.toBuffer(), offset],
      getArciumProgramId()
    )[0];

    try {
      await program.account.computationDefinitionAccount.fetch(compDefPDA);
      return "Already Initialized";
    } catch (e) {
    }

    const arciumProgram = getArciumProgram(provider as anchor.AnchorProvider);
    const mxeAccount = getMXEAccAddress(program.programId);
    const mxeAcc = await arciumProgram.account.mxeAccount.fetch(mxeAccount);
    const lutAddress = getLookupTableAddress(
      program.programId,
      mxeAcc.lutOffsetSlot
    );

    const sig = await program.methods
      .initPlayerStandCompDef()
      .accounts({
        compDefAccount: compDefPDA,
        payer: owner.publicKey,
        mxeAccount,
        addressLookupTable: lutAddress,
      })
      .rpc({ commitment: "confirmed", preflightCommitment: "confirmed" });

    const rawCircuit = fs.readFileSync("build/player_stand.arcis");
    await uploadCircuit(
      provider as anchor.AnchorProvider,
      "player_stand",
      program.programId,
      rawCircuit,
      true
    );

    return sig;
  }


  async function initDealerPlayCompDef(
    program: Program<Blackjack>,
    owner: Keypair
  ): Promise<string> {
    const baseSeedCompDefAcc = getArciumAccountBaseSeed(
      "ComputationDefinitionAccount"
    );
    const offset = getCompDefAccOffset("dealer_play");
    const compDefPDA = PublicKey.findProgramAddressSync(
      [baseSeedCompDefAcc, program.programId.toBuffer(), offset],
      getArciumProgramId()
    )[0];

    try {
      await program.account.computationDefinitionAccount.fetch(compDefPDA);
      return "Already Initialized";
    } catch (e) {
    }

    const arciumProgram = getArciumProgram(provider as anchor.AnchorProvider);
    const mxeAccount = getMXEAccAddress(program.programId);
    const mxeAcc = await arciumProgram.account.mxeAccount.fetch(mxeAccount);
    const lutAddress = getLookupTableAddress(
      program.programId,
      mxeAcc.lutOffsetSlot
    );

    const sig = await program.methods
      .initDealerPlayCompDef()
      .accounts({
        compDefAccount: compDefPDA,
        payer: owner.publicKey,
        mxeAccount,
        addressLookupTable: lutAddress,
      })
      .rpc({ commitment: "confirmed", preflightCommitment: "confirmed" });

    const rawCircuit = fs.readFileSync("build/dealer_play.arcis");
    await uploadCircuit(
      provider as anchor.AnchorProvider,
      "dealer_play",
      program.programId,
      rawCircuit,
      true
    );

    return sig;
  }

  async function initResolveGameCompDef(
    program: Program<Blackjack>,
    owner: Keypair
  ): Promise<string> {
    const baseSeedCompDefAcc = getArciumAccountBaseSeed(
      "ComputationDefinitionAccount"
    );
    const offset = getCompDefAccOffset("resolve_game");
    const compDefPDA = PublicKey.findProgramAddressSync(
      [baseSeedCompDefAcc, program.programId.toBuffer(), offset],
      getArciumProgramId()
    )[0];

    try {
      await program.account.computationDefinitionAccount.fetch(compDefPDA);
      return "Already Initialized";
    } catch (e) {
    }

    const arciumProgram = getArciumProgram(provider as anchor.AnchorProvider);
    const mxeAccount = getMXEAccAddress(program.programId);
    const mxeAcc = await arciumProgram.account.mxeAccount.fetch(mxeAccount);
    const lutAddress = getLookupTableAddress(
      program.programId,
      mxeAcc.lutOffsetSlot
    );

    const sig = await program.methods
      .initResolveGameCompDef()
      .accounts({
        compDefAccount: compDefPDA,
        payer: owner.publicKey,
        mxeAccount,
        addressLookupTable: lutAddress,
      })
      .rpc({ commitment: "confirmed", preflightCommitment: "confirmed" });

    const rawCircuit = fs.readFileSync("build/resolve_game.arcis");
    await uploadCircuit(
      provider as anchor.AnchorProvider,
      "resolve_game",
      program.programId,
      rawCircuit,
      true
    );

    return sig;
  }
});

async function getMXEPublicKeyWithRetry(
  provider: anchor.AnchorProvider,
  programId: PublicKey,
  maxRetries: number = 20,
  retryDelayMs: number = 500
): Promise<Uint8Array> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const mxePublicKey = await getMXEPublicKey(provider, programId);
      if (mxePublicKey) {
        return mxePublicKey;
      }
    } catch (error) {
    }

    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  throw new Error(
    `Failed to fetch MXE public key after ${maxRetries} attempts`
  );
}

function readKpJson(path: string): anchor.web3.Keypair {
  const file = fs.readFileSync(path);
  return anchor.web3.Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(file.toString()))
  );
}