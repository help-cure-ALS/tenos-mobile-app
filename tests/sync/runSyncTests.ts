import { runIdentityGuardUnitTests } from "./identityGuard.unit";
import { runKeyMismatchDiagUnitTests } from "./keyMismatchDiag.unit";
import { runResearchDonationSelectionUnitTests } from "./researchDonationSelection.unit";
import { runRecoveryPolicyUnitTests } from "./recoveryPolicy.unit";
import { runGrantWrapUnitTests } from "./grantWrap.unit";
import { runMetricUnitsUnitTests } from "./metricUnits.unit";
import { runExternalHealthUnitTests } from "./externalHealth.unit";
import { runMedicationRemindersUnitTests } from "./medicationReminders.unit";

async function runNamedSuite(name: string, run: () => void | Promise<void>) {
    await run();
    // Keep output compact but deterministic for CI logs.
    // eslint-disable-next-line no-console
    console.log(`[pass] ${name}`);
}

export async function runSyncUnitTests() {
    await runNamedSuite("identityGuard", runIdentityGuardUnitTests);
    await runNamedSuite("keyMismatchDiag", runKeyMismatchDiagUnitTests);
    await runNamedSuite("researchDonationSelection", runResearchDonationSelectionUnitTests);
    await runNamedSuite("recoveryPolicy", runRecoveryPolicyUnitTests);
    await runNamedSuite("grantWrap", runGrantWrapUnitTests);
    await runNamedSuite("metricUnits", runMetricUnitsUnitTests);
    await runNamedSuite("externalHealth", runExternalHealthUnitTests);
    await runNamedSuite("medicationReminders", runMedicationRemindersUnitTests);
}

runSyncUnitTests().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
});
