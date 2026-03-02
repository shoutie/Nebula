use arcis::*;

#[encrypted]
mod circuits {
    use arcis::*;

    pub struct UserChoice {
        pub choice: bool,
    }

    #[instruction]
    pub fn flip(input_ctxt: Enc<Shared, UserChoice>) -> bool {
        let input = input_ctxt.to_arcis();

        let toss = ArcisRNG::bool();

        (input.choice == toss).reveal()
    }
}
