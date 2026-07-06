/** All SecureStore keys used by the app. Shared between fresh-install cleanup and delete-all-data. */
export const SECURE_STORE_KEYS = [
    // Legacy medical_key (T-002: removed/unused) — kept here only so cleanup wipes the old slot
    "medical_sync_vault_medical_key_b64_v1",
    // Transport encryption key
    "medical_sync_vault_transport_key_b64_v1",
    // Vault identity & auth (prefixed)
    "medical_sync_vault_subject_id",
    "medical_sync_vault_device_id",
    "medical_sync_vault_access_token",
    "medical_sync_vault_cursor_since_ts",
    "medical_sync_vault_cursor_since_id",
    "medical_sync_vault_ed25519_public_key_b64",
    "medical_sync_vault_ed25519_secret_key_b64",
    "medical_sync_vault_subject_registered",
    // Managed patients (caregiver)
    "managed_patients_v1",
    "managed_patients_v2",
    // App role & aliases
    "app_role_scope_v1",
    "patient_aliases_local_v1",
    // Patient preferences (verification, units, etc.) — global key (legacy/migration)
    "patient_preferences_v1",
    // Device access list — global key (legacy/migration)
    "device_access_list_v1",
    // Donation tracking — global key (legacy/migration)
    "donation_tracking_v1",
    // Caregiver/doctor display name (legacy shared key + per-role keys)
    "caregiver_doctor_name_v1",
    "caregiver_name_v1",
    "doctor_name_v1",
    // Mnemonic (recovery words)
    "medical_sync_vault_mnemonic_v1",
    // Owned patient identity (single local patient account)
    "owned_patient_v1",
    // Auth lock
    "auth_lock_enabled_v1",
    // Display mode & preferences
    "display_mode_v1",
    "display_preferences_v1",
];
