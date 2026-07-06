/**
 * Clears all locally stored data for a specific patient.
 * Called when a caregiver/doctor removes a patient from their list.
 */
import { getPatientFhirStore } from '@/src/stores/patientFhirStore';
import { clearFhirOutboxForPatient } from '@/src/stores/fhirOutbox';
import { createPatientPreferencesStore, deletePatientPreferencesData } from '@/src/stores/patientPreferencesStore';
import { deleteDeviceAccessData } from '@/src/stores/deviceAccessStore';
import { deleteDonationTrackingData } from '@/src/stores/donationTrackingStore';
import { deleteSupplierExchangeData } from '@/src/stores/supplierExchangeStore';
import { deleteToken } from '@/src/services/supplierExchange';
import { getNotificationKeysForPatient } from '@/src/services/notificationPrefs';
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function clearPatientLocalData(patientId: string): Promise<void> {
    // Drop pending sync pointers for this patient before removing the local resources they reference.
    await clearFhirOutboxForPatient(patientId).catch(() => {});

    // Clean up supplier tokens before deleting preferences (needs integration IDs)
    try {
        const prefsStore = createPatientPreferencesStore(patientId);
        const integrations = await prefsStore.getSupplierIntegrations();
        await Promise.all(
            integrations.map(integ => deleteToken(integ.id).catch(() => {}))
        );
    } catch {
        // Best effort — preferences may already be gone
    }

    // Supplier exchange store (per-patient AsyncStorage)
    await deleteSupplierExchangeData(patientId).catch(() => {});

    // Per-patient SecureStore keys
    await deletePatientPreferencesData(patientId);
    await deleteDeviceAccessData(patientId);
    await deleteDonationTrackingData(patientId);

    // Per-patient Notification prefs (AsyncStorage)
    const notifKeys = getNotificationKeysForPatient(patientId);
    await AsyncStorage.multiRemove(notifKeys);

    // FHIR data for this patient from SQLite
    await getPatientFhirStore().clearForPatient(patientId);
}
