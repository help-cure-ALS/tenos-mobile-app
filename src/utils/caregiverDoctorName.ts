/**
 * Stores and retrieves the caregiver/doctor display name per role.
 * This name is shown to patients in the DeviceAccessList.
 */
import * as SecureStore from 'expo-secure-store';

type ManagedRole = 'caregiver' | 'doctor';

const NAME_KEYS: Record<ManagedRole, string> = {
    caregiver: 'caregiver_name_v1',
    doctor: 'doctor_name_v1',
};

// Legacy key — used for migration only
const LEGACY_KEY = 'caregiver_doctor_name_v1';

export async function getCaregiverDoctorName(role: ManagedRole): Promise<string | null> {
    const name = await SecureStore.getItemAsync(NAME_KEYS[role]);
    if (name) return name;

    // Migrate from legacy shared key
    const legacy = await SecureStore.getItemAsync(LEGACY_KEY);
    if (legacy) {
        await SecureStore.setItemAsync(NAME_KEYS[role], legacy, {
            keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        });
        return legacy;
    }

    return null;
}

export async function setCaregiverDoctorName(role: ManagedRole, name: string): Promise<void> {
    await SecureStore.setItemAsync(NAME_KEYS[role], name, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
}
