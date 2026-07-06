import { pbkdf2 } from "@noble/hashes/pbkdf2.js";
import { sha512 } from "@noble/hashes/sha2.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import nacl from "tweetnacl";
import { encodeBase64 } from "tweetnacl-util";
import * as Crypto from "expo-crypto";
import { getWordlist, type MnemonicLanguage } from "./wordlists";

export type DerivedKeys = {
    publicKeyB64: string;
    secretKeyB64: string;
    transportKeyB64: string;
};

const PBKDF2_SALT = "hca-vault-v1";
const PBKDF2_ITERATIONS = 2048;

/** Generate 12 random words from the word list for the given language */
export function generateMnemonic(lang: MnemonicLanguage = 'en'): string[] {
    const wordlist = getWordlist(lang);
    const bytes = Crypto.getRandomBytes(24); // 24 bytes = 12 × 2 bytes per word index
    const words: string[] = [];
    for (let i = 0; i < 12; i++) {
        const index = ((bytes[i * 2] << 8) | bytes[i * 2 + 1]) % wordlist.length;
        words.push(wordlist[index]);
    }
    return words;
}

/** Derive 64-byte master seed via PBKDF2-HMAC-SHA512 */
export function mnemonicToSeed(words: string[]): Uint8Array {
    const passphrase = new TextEncoder().encode(words.join(" "));
    const salt = new TextEncoder().encode(PBKDF2_SALT);
    return pbkdf2(sha512, passphrase, salt, { c: PBKDF2_ITERATIONS, dkLen: 64 });
}

/** Derive all encryption keys from seed via HKDF-SHA256 */
export function deriveKeysFromSeed(seed: Uint8Array): DerivedKeys {
    const enc = new TextEncoder();
    const ed25519Seed = hkdf(sha256, seed, undefined, enc.encode("hca/ed25519-seed"), 32);
    const transportKey = hkdf(sha256, seed, undefined, enc.encode("hca/transport-key"), 32);

    const keyPair = nacl.sign.keyPair.fromSeed(ed25519Seed);

    return {
        publicKeyB64: encodeBase64(keyPair.publicKey),
        secretKeyB64: encodeBase64(keyPair.secretKey),
        transportKeyB64: encodeBase64(transportKey),
    };
}

/** Convenience: words -> DerivedKeys */
export function deriveKeysFromMnemonic(words: string[]): DerivedKeys {
    const seed = mnemonicToSeed(words);
    return deriveKeysFromSeed(seed);
}
