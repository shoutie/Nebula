use arcis::*;

#[encrypted]
mod circuits {
    use arcis::*;

    const INITIAL_DECK: [u8; 52] = [
        0u8, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24,
        25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47,
        48, 49, 50, 51,
    ];

    type Deck = Pack<[u8; 52]>;
    type Hand = Pack<[u8; 11]>;

    #[instruction]
    pub fn shuffle_and_deal_cards(
        client: Shared,
        client_again: Shared,
    ) -> (
        Enc<Mxe, Deck>,
        Enc<Mxe, Hand>,
        Enc<Shared, Hand>,
        Enc<Shared, u8>,
    ) {
        let mut initial_deck: [u8; 52] = INITIAL_DECK;
        ArcisRNG::shuffle(&mut initial_deck);

        let deck_packed: Deck = Pack::new(initial_deck);
        let deck = Mxe::get().from_arcis(deck_packed);

        let mut dealer_cards = [53u8; 11];
        dealer_cards[0] = initial_deck[1];
        dealer_cards[1] = initial_deck[3];

        let dealer_hand = Mxe::get().from_arcis(Pack::new(dealer_cards));

        let mut player_cards = [53u8; 11];
        player_cards[0] = initial_deck[0];
        player_cards[1] = initial_deck[2];

        let player_hand = client.from_arcis(Pack::new(player_cards));

        (
            deck,
            dealer_hand,
            player_hand,
            client_again.from_arcis(initial_deck[1]),
        )
    }

    #[instruction]
    pub fn player_hit(
        deck_ctxt: Enc<Mxe, Deck>,
        player_hand_ctxt: Enc<Shared, Hand>,
        player_hand_size: u8,
        dealer_hand_size: u8,
    ) -> (Enc<Shared, Hand>, bool) {
        let deck = deck_ctxt.to_arcis().unpack();

        let mut player_hand = player_hand_ctxt.to_arcis().unpack();

        let card_index = (player_hand_size + dealer_hand_size) as usize;
        player_hand[player_hand_size as usize] = deck[card_index];

        let new_hand_value = calculate_hand_value(&player_hand, player_hand_size + 1);
        let is_bust = new_hand_value > 21;

        (
            player_hand_ctxt.owner.from_arcis(Pack::new(player_hand)),
            is_bust.reveal(),
        )
    }

    #[instruction]
    pub fn player_stand(player_hand_ctxt: Enc<Shared, Hand>, player_hand_size: u8) -> bool {
        let player_hand = player_hand_ctxt.to_arcis().unpack();
        let value = calculate_hand_value(&player_hand, player_hand_size);
        (value > 21).reveal()
    }

    #[instruction]
    pub fn dealer_play(
        deck_ctxt: Enc<Mxe, Deck>,
        dealer_hand_ctxt: Enc<Mxe, Hand>,
        client: Shared,
        player_hand_size: u8,
        dealer_hand_size: u8,
    ) -> (Enc<Mxe, Hand>, Enc<Shared, Hand>, u8) {
        let deck_array = deck_ctxt.to_arcis().unpack();
        let mut dealer = dealer_hand_ctxt.to_arcis().unpack();
        let mut size = dealer_hand_size as usize;

        for _ in 0..7 {
            let val = calculate_hand_value(&dealer, size as u8);
            if val < 17 {
                let idx = (player_hand_size as usize + size) as usize;
                dealer[size] = deck_array[idx];
                size += 1;
            }
        }

        (
            dealer_hand_ctxt.owner.from_arcis(Pack::new(dealer)),
            client.from_arcis(Pack::new(dealer)),
            (size as u8).reveal(),
        )
    }

    fn calculate_hand_value(hand: &[u8; 11], hand_length: u8) -> u8 {
        let mut value: u8 = 0;
        let mut aces: u8 = 0;

        for i in 0..11 {
            if i < hand_length as usize {
                let rank = hand[i] % 13;
                if rank == 0 {
                    value += 11;
                    aces += 1;
                } else if rank >= 10 {
                    value += 10;
                } else {
                    value += rank + 1;
                }
            }
        }

        for _ in 0..4 {
            if value > 21 && aces > 0 {
                value -= 10;
                aces -= 1;
            }
        }

        value
    }

    #[instruction]
    pub fn resolve_game(
        player_hand: Enc<Shared, Hand>,
        dealer_hand: Enc<Mxe, Hand>,
        player_hand_length: u8,
        dealer_hand_length: u8,
    ) -> u8 {
        let player_hand = player_hand.to_arcis().unpack();
        let dealer_hand = dealer_hand.to_arcis().unpack();

        let player_value = calculate_hand_value(&player_hand, player_hand_length);
        let dealer_value = calculate_hand_value(&dealer_hand, dealer_hand_length);

        let result = if player_value > 21 {
            0
        } else if dealer_value > 21 {
            1
        } else if player_value > dealer_value {
            2
        } else if dealer_value > player_value {
            3
        } else {
            4
        };

        result.reveal()
    }
}
