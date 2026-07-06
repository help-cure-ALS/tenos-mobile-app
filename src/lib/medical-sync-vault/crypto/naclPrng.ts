import nacl from "tweetnacl";
import * as Crypto from "expo-crypto";

let initialized = false;

export function ensureNaclPrng() {
    if (initialized) {
        return;
    }

    nacl.setPRNG((x, n) => {
        const bytes = Crypto.getRandomBytes(n);
        for (let i = 0; i < n; i++) {
            x[i] = bytes[i];
        }
    });

    initialized = true;
}
