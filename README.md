# Nebula

In this project, we're showcasing how Arcium works in Blackjack and Coinflip. Both games guarantee full privacy, all computations occur on encrypted data throughout the entire process.

Devs - https://x.com/rodionadov, https://x.com/deundef1ned

## Getting Started

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev
```

## Nebula.Blackjack - How It Works

Physical blackjack naturally hides the dealer's hole card. Digital blackjack has a different problem: the card's value must be stored somewhere - whether that's on a game server, in a database, or in code. Trusting a server to "hide" it just means betting they won't peek.

At game initialization, a 52-card deck is shuffled using Arcium's cryptographic randomness. The entire deck, including player cards and the dealer's hole card, remains encrypted throughout gameplay.

Information disclosure follows game rules: players view their own cards and the dealer's face-up card. Game actions (hit, stand) are processed against encrypted hand values. The dealer's hole card and undealt cards remain encrypted until game resolution.

The deck is stored as encrypted values, with multiple cards packed together for efficiency. Game logic processes encrypted hand values without ever decrypting them, using Arcium's confidential instructions.

The system works through three key mechanisms: network-generated randomness creates unpredictable deck order, selective disclosure reveals only authorized information per game rules, and the MPC protocol ensures no party can manipulate game state or outcomes even with a dishonest majority—game integrity is preserved as long as one node is honest.

## Nebula.Coinflip - How It Works

Flip a coin online and you have to trust someone. Trust the server not to rig the flip, or trust yourself not to inspect the code and game the system. There's no way to prove it's actually random.

The coinflip follows this flow:
1. Player commitment: The player's choice (heads/tails) is encrypted and submitted to the network;
2. Random generation: Arcium nodes work together to generate a random boolean outcome;
3. Encrypted comparison: The system compares the encrypted choice against the encrypted random result;
4. Result disclosure: Only the win/loss outcome is revealed.

The comparison occurs on encrypted values throughout the computation.

The player's choice is encrypted as a boolean, allowing result verification without exposing the choice prematurely. Random generation uses Arcium's cryptographic primitives, where Arcium nodes contribute entropy that no single node can predict or control.