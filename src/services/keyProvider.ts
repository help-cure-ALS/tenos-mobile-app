/**
 * KeyProvider - tracks the current role + active patient context.
 *
 * NOTE (T-002): the former encryption-key methods are gone. `medical_key` is
 * removed; FHIR sync runs on `transport_key` and local at-rest on SQLCipher.
 * This provider now only carries role/demo context.
 */

export type KeyProviderRole = 'patient' | 'caregiver' | 'doctor' | 'demo' | null;

export type KeyProviderContext = {
    role: KeyProviderRole;
    /** For patient role: their own subject_id. For caregiver/doctor: the active patient's ID */
    activePatientId: string | null;
};

export type KeyProvider = {
    /** Update the context (role and active patient). */
    setContext(context: KeyProviderContext): void;
    /** Get the current context. */
    getContext(): KeyProviderContext;
};

export function createKeyProvider(): KeyProvider {
    let context: KeyProviderContext = {
        role: null,
        activePatientId: null,
    };

    function setContext(newContext: KeyProviderContext): void {
        context = newContext;
    }

    function getContext(): KeyProviderContext {
        return { ...context };
    }

    return { setContext, getContext };
}

// Singleton instance
let _keyProvider: KeyProvider | null = null;

export function getKeyProvider(): KeyProvider {
    if (!_keyProvider) {
        _keyProvider = createKeyProvider();
    }
    return _keyProvider;
}
