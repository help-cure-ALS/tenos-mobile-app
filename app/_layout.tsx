import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, LogBox, Platform } from 'react-native';
import { Stack, useRouter, router as expoRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Updates from 'expo-updates';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppRoleProvider, useActivePatientId, useAppRole } from '@/src/context/AppRoleProvider';
import { AppSyncProvider } from '@/src/context/AppSyncProvider';
import { AuthLockProvider } from '@/src/context/AuthLockProvider';
import { DisplayModeProvider } from '@/src/context/DisplayModeProvider';
import { AuthGate } from '@/src/components/AuthGate';
import { AppThemeProvider } from '@/src/theme';
import { StudiesProvider } from '@/src/studies';
import { ContentProvider } from '@/src/content';
import i18n, { initI18n } from '@/src/i18n';
import { safeRouter } from '@/src/hooks/useSafeRouter';
import { isSlotFullyLogged } from '@/src/services/medicationNotificationFilter';
import { DefinitionsProvider } from '@/src/definitions';
import { MedicationsProvider } from '@/src/medications/context/MedicationsProvider';
import { PatientProvider } from '@/src/context/PatientProvider';
import { LoadingOverlayProvider } from '@/src/context/LoadingOverlayProvider';
import { SupplierProposalProvider } from '@/src/context/SupplierProposalProvider';
import { ExternalHealthAutoImportProvider } from '@/src/services/externalHealth/ExternalHealthAutoImportProvider';
import { ToastHost } from '@/src/components/ui/ToastHost';
import { ForceUpdateScreen } from '@/src/components/ForceUpdateScreen';
import { checkVersionGate, type VersionGateResult } from '@/src/services/appVersionGate';

LogBox.ignoreLogs(['Sending `onAnimatedValueUpdate`']);

Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
        const data = notification.request.content.data as Record<string, unknown> | undefined;

        // Suppress medication reminders when all doses for that time slot are already logged
        if (data?.type === 'medication_reminder') {
            const time = typeof data.time === 'string' ? data.time : '';
            const medicationIds = Array.isArray(data.medicationIds)
                ? data.medicationIds.filter((id): id is string => typeof id === 'string')
                : [];

            if (time && medicationIds.length > 0 && isSlotFullyLogged(time, medicationIds)) {
                return {
                    shouldShowBanner: false,
                    shouldShowList: false,
                    shouldPlaySound: false,
                    shouldSetBadge: false,
                };
            }
        }

        return {
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
        };
    },
});

function getIOSVersion(): number {
    if (Platform.OS !== 'ios') return 0;

    return parseInt(Platform.Version as string, 10);
}

function isIOS26OrLater(): boolean {
    return getIOSVersion() >= 26;
}

// Shared options for root-level modal screens. They live at the root (not
// inside the tab stacks) so they cover the native tab bar on Android too.
function rootModalOptions(headerTitle = '') {
    return {
        presentation: 'modal' as const,
        animation: 'slide_from_bottom' as const,
        headerShown: true,
        headerTransparent: Platform.OS === 'ios',
        headerTitle,
        headerBackButtonDisplayMode: 'minimal' as const,
        headerBlurEffect: isIOS26OrLater() ? undefined : ('regular' as const),
    };
}

// formSheet on iOS, plain modal on Android (used for detail/settings sheets)
function rootSheetOrModalOptions(headerTitle = '') {
    return {
        ...rootModalOptions(headerTitle),
        presentation: (Platform.OS === 'ios' ? 'formSheet' : 'modal') as 'formSheet' | 'modal',
        sheetCornerRadius: 24,
    };
}

// Root-level formSheet screens (wizard steps like schedule type / duration)
function rootFormSheetOptions(detent: number) {
    return {
        presentation: 'formSheet' as const,
        sheetAllowedDetents: [detent],
        sheetGrabberVisible: true,
        headerShown: true,
        headerTransparent: Platform.OS === 'ios',
        headerBlurEffect: isIOS26OrLater() ? undefined : ('regular' as const),
    };
}

// After this duration in background, reset navigation to the home tab
const NAV_RESET_THRESHOLD_MS = 60 * 60_000; // 1 hour
// After this duration in background, reload the JS bundle (applies OTA updates)
const FULL_RELOAD_THRESHOLD_MS = 8 * 60 * 60_000; // 8 hours

const cfg = {
    baseUrl: process.env.EXPO_PUBLIC_VAULT_BASE_URL ?? '',
    appIssueToken: process.env.EXPO_PUBLIC_VAULT_APP_ISSUE_TOKEN ?? ''
};

function toValidIso(value: unknown): string | null {
    if (!(typeof value === 'string' || typeof value === 'number' || value instanceof Date)) {
        return null;
    }

    const normalizedValue =
        typeof value === 'number' && value > 0 && value < 10_000_000_000
            ? value * 1000
            : value;

    const date = new Date(normalizedValue);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function fallbackIsoForReminderTime(time: string | undefined): string {
    const date = new Date();
    const match = time?.match(/^(\d{1,2}):(\d{2})$/);

    if (match) {
        const hour = Math.max(0, Math.min(23, Number(match[1]) || 0));
        const minute = Math.max(0, Math.min(59, Number(match[2]) || 0));
        date.setHours(hour, minute, 0, 0);
    }

    return date.toISOString();
}

function extractMedicationIds(data: Record<string, unknown> | undefined): string[] {
    const ids = Array.isArray(data?.medicationIds)
        ? data.medicationIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
        : [];

    if (ids.length > 0) {
        return [...new Set(ids)];
    }

    return typeof data?.medicationId === 'string' && data.medicationId.length > 0
        ? [data.medicationId]
        : [];
}

export default function RootLayout() {
    return <RootLayoutNav />;
}

function RootLayoutNav() {
    const [language, setLanguage] = useState<string>(i18n.language || 'en');
    // Native version gate: when the binary is too old, render the blocking
    // update screen instead of the navigator (checked on start + foreground)
    const [versionGate, setVersionGate] = useState<VersionGateResult>({
        updateRequired: false,
        storeUrl: null
    });

    const runVersionGateCheck = useCallback(() => {
        checkVersionGate()
            .then(setVersionGate)
            .catch(() => {
            });
    }, []);

    useEffect(() => {
        runVersionGateCheck();
    }, [runVersionGateCheck]);

    useEffect(() => {
        initI18n();
    }, []);

    useEffect(() => {
        const onLanguageChanged = (lng: string) => setLanguage(lng || 'en');
        i18n.on('languageChanged', onLanguageChanged);
        return () => {
            i18n.off('languageChanged', onLanguageChanged);
        };
    }, []);

    // Silent OTA update check — download in background, apply on next cold start
    useEffect(() => {
        if (__DEV__) {
            return;
        }
        Updates.checkForUpdateAsync()
            .then((result) => {
                if (result.isAvailable) {
                    return Updates.fetchUpdateAsync();
                }
            })
            .catch(() => {
            });
    }, []);

    // Background time tracking: nav reset after 1h, full reload after 8h
    useEffect(() => {
        let backgroundTimestamp: number | null = null;

        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'background') {
                backgroundTimestamp = Date.now();
            } else if (state === 'active' && backgroundTimestamp !== null) {
                const elapsed = Date.now() - backgroundTimestamp;
                backgroundTimestamp = null;

                runVersionGateCheck();

                if (elapsed >= FULL_RELOAD_THRESHOLD_MS && !__DEV__) {
                    Updates.reloadAsync().catch(() => {
                    });
                } else if (elapsed >= NAV_RESET_THRESHOLD_MS) {
                    safeRouter.replace('/(tabs)');
                }
            }
        });

        return () => subscription.remove();
    }, [runVersionGateCheck]);

    return (
        <GestureHandlerRootView style={ { flex: 1 } }>
            <AppRoleProvider>
                <DisplayModeProvider>
                    <AppSyncProviderWithPatient cfg={ cfg }>
                        <ExternalHealthAutoImportProvider />
                        <AppThemeProvider>
                            <LoadingOverlayProvider>
                                <AuthLockProvider>
                                    <SafeAreaProvider style={ { flex: 1 } }>
                                        { versionGate.updateRequired ? (
                                            <ForceUpdateScreen storeUrl={ versionGate.storeUrl } />
                                        ) : (
                                        <AuthGate>
                                            <PatientBoundary>
                                                <DefinitionsProvider language={ language }>
                                                    <MedicationsProvider>
                                                        <NotificationResponseRouter />
                                                        <StudiesProvider>
                                                        <ContentProvider>
                                                            <Stack screenOptions={ { headerShown: false } }>
                                                                <Stack.Screen name="index" />
                                                                <Stack.Screen
                                                                    name="(tabs)"
                                                                    options={ {
                                                                        animation: 'fade'
                                                                    } }
                                                                />
                                                                <Stack.Screen
                                                                    name="settings"
                                                                    options={ {
                                                                        presentation: 'modal',
                                                                        animation: 'slide_from_bottom'
                                                                    } }
                                                                />
                                                                <Stack.Screen
                                                                    name="researchProject"
                                                                    options={ {
                                                                        presentation: 'modal',
                                                                        animation: 'slide_from_bottom'
                                                                    } }
                                                                />
                                                                <Stack.Screen
                                                                    name="newsArticle"
                                                                    options={ {
                                                                        presentation: 'modal',
                                                                        animation: 'slide_from_bottom',
                                                                        headerShown: true,
                                                                        headerTransparent: Platform.OS === 'ios',
                                                                        headerTitle: ''
                                                                    } }
                                                                />
                                                                <Stack.Screen
                                                                    name="share/addDoctor"
                                                                    options={ rootModalOptions(i18n.t('share.addDoctor.title')) }
                                                                />
                                                                <Stack.Screen
                                                                    name="share/addCaregiver"
                                                                    options={ rootModalOptions(i18n.t('share.addCaregiver.title')) }
                                                                />
                                                                <Stack.Screen
                                                                    name="share/sharingSettings"
                                                                    options={ rootModalOptions() }
                                                                />
                                                                <Stack.Screen
                                                                    name="share/exportFhir"
                                                                    options={ rootModalOptions() }
                                                                />
                                                                <Stack.Screen
                                                                    name="share/exportPdf"
                                                                    options={ rootModalOptions() }
                                                                />
                                                                <Stack.Screen
                                                                    name="share/accessLog"
                                                                    options={ rootModalOptions() }
                                                                />
                                                                <Stack.Screen
                                                                    name="share/supplierLink"
                                                                    options={ rootModalOptions() }
                                                                />
                                                                <Stack.Screen
                                                                    name="share/supplierAccept"
                                                                    options={ rootModalOptions() }
                                                                />
                                                                <Stack.Screen
                                                                    name="share/supplierManage"
                                                                    options={ rootModalOptions() }
                                                                />
                                                                <Stack.Screen
                                                                    name="share/supplierDataPolicy"
                                                                    options={ rootModalOptions() }
                                                                />
                                                                <Stack.Screen
                                                                    name="share/supplierInbox"
                                                                    options={ rootModalOptions() }
                                                                />
                                                                <Stack.Screen
                                                                    name="share/researchProjects"
                                                                    options={ rootModalOptions(i18n.t('share.research.projectsTitle')) }
                                                                />
                                                                <Stack.Screen
                                                                    name="metric/medications/add"
                                                                    options={ {
                                                                        ...rootModalOptions(i18n.t('navigation.newMedication')),
                                                                        gestureEnabled: false
                                                                    } }
                                                                />
                                                                <Stack.Screen
                                                                    name="metric/medications/log"
                                                                    options={ rootModalOptions() }
                                                                />
                                                                <Stack.Screen
                                                                    name="metric/medications/editSchedule"
                                                                    options={ {
                                                                        ...rootModalOptions(),
                                                                        gestureEnabled: false
                                                                    } }
                                                                />
                                                                <Stack.Screen
                                                                    name="metric/medications/editDetails"
                                                                    options={ {
                                                                        ...rootModalOptions(),
                                                                        gestureEnabled: false
                                                                    } }
                                                                />
                                                                <Stack.Screen
                                                                    name="metric/medications/scheduleType"
                                                                    options={ rootFormSheetOptions(0.6) }
                                                                />
                                                                <Stack.Screen
                                                                    name="metric/medications/duration"
                                                                    options={ rootFormSheetOptions(0.4) }
                                                                />
                                                                <Stack.Screen
                                                                    name="metric/[metricId]/add"
                                                                    options={ rootModalOptions() }
                                                                />
                                                                <Stack.Screen
                                                                    name="metric/[metricId]/detail/[entryId]"
                                                                    options={ rootSheetOrModalOptions() }
                                                                />
                                                                <Stack.Screen
                                                                    name="metric/alsSubtype/add"
                                                                    options={ {
                                                                        ...rootModalOptions(),
                                                                        gestureEnabled: false
                                                                    } }
                                                                />
                                                                <Stack.Screen
                                                                    name="metric/neurologicalExam/add"
                                                                    options={ {
                                                                        ...rootModalOptions(),
                                                                        gestureEnabled: false
                                                                    } }
                                                                />
                                                                <Stack.Screen
                                                                    name="metric/alsKingsStage/add"
                                                                    options={ {
                                                                        ...rootModalOptions(),
                                                                        gestureEnabled: false
                                                                    } }
                                                                />
                                                                <Stack.Screen
                                                                    name="metric/alsGeneticBackground/add"
                                                                    options={ {
                                                                        ...rootModalOptions(),
                                                                        gestureEnabled: false
                                                                    } }
                                                                />
                                                                <Stack.Screen
                                                                    name="metric/progressRateInfo"
                                                                    options={ rootModalOptions() }
                                                                />
                                                                <Stack.Screen
                                                                    name="metric/todoSettings"
                                                                    options={ rootSheetOrModalOptions(i18n.t('todo.settingsTitle')) }
                                                                />
                                                                <Stack.Screen
                                                                    name="metric/pinOrder"
                                                                    options={ rootSheetOrModalOptions(i18n.t('navigation.pinOrder')) }
                                                                />
                                                                <Stack.Screen
                                                                    name="metric/studies/clinicPicker"
                                                                    options={ {
                                                                        ...rootModalOptions(i18n.t('studies.clinicPickerTitle', 'Ambulanzen auswählen')),
                                                                        gestureEnabled: false
                                                                    } }
                                                                />
                                                                <Stack.Screen
                                                                    name="metric/aids/add"
                                                                    options={ {
                                                                        ...rootModalOptions(i18n.t('navigation.newAid')),
                                                                        gestureEnabled: false
                                                                    } }
                                                                />
                                                                <Stack.Screen
                                                                    name="questionnaire/[questionnaireId]/index"
                                                                    options={ {
                                                                        ...rootModalOptions(),
                                                                        gestureEnabled: false
                                                                    } }
                                                                />
                                                                <Stack.Screen
                                                                    name="onboarding"
                                                                    options={ {
                                                                        animation: 'fade',
                                                                        headerShown: false,
                                                                        gestureEnabled: false
                                                                    } }
                                                                />
                                                            </Stack>
                                                            <ToastHost />
                                                        </ContentProvider>
                                                        </StudiesProvider>
                                                    </MedicationsProvider>
                                                </DefinitionsProvider>
                                            </PatientBoundary>
                                        </AuthGate>
                                        ) }
                                    </SafeAreaProvider>
                                </AuthLockProvider>
                            </LoadingOverlayProvider>
                        </AppThemeProvider>
                    </AppSyncProviderWithPatient>
                </DisplayModeProvider>
            </AppRoleProvider>
        </GestureHandlerRootView>
    );
}

function NotificationResponseRouter() {
    const lastHandledNotificationIdRef = useRef<string | null>(null);
    const { scope, isLoading } = useAppRole();

    useEffect(() => {
        if (isLoading || !scope) {
            return;
        }

        const navigationTimers = new Set<ReturnType<typeof setTimeout>>();

        function scheduleNavigation(delayMs: number, fn: () => void) {
            const timer = setTimeout(() => {
                navigationTimers.delete(timer);
                try {
                    fn();
                } catch (error) {
                    console.warn('Failed to route from notification response:', error);
                }
            }, delayMs);
            navigationTimers.add(timer);
        }

        function openMedicationRoute(target?: Parameters<typeof safeRouter.push>[0]) {
            // Use expoRouter directly — safeRouter's 600ms cooldown blocks
            // the second navigation call in this programmatic sequence.
            scheduleNavigation(250, () => {
                expoRouter.navigate('/(tabs)/(metric)/medications' as any);
            });

            if (target) {
                scheduleNavigation(700, () => {
                    expoRouter.push(target as any);
                });
            }
        }

        function routeFromNotificationResponse(response: Notifications.NotificationResponse) {
            try {
                const notification = response.notification;
                const data = notification.request.content.data as Record<string, unknown> | undefined;
                const type = typeof data?.type === 'string' ? data.type : '';

                if (type !== 'medication_reminder') {
                    return;
                }

                const identifier = notification.request.identifier;
                const notificationDate = toValidIso(notification.date);
                const handledKey = `${identifier}:${notificationDate ?? data?.scheduledFor ?? ''}:${response.actionIdentifier}`;
                if (handledKey === lastHandledNotificationIdRef.current) {
                    return;
                }
                lastHandledNotificationIdRef.current = handledKey;

                const time = typeof data?.time === 'string' ? data.time : undefined;
                const scheduledFor =
                    toValidIso(data?.scheduledFor) ??
                    notificationDate ??
                    fallbackIsoForReminderTime(time);
                const medicationIds = extractMedicationIds(data);
                const medicationId = medicationIds.length === 1 ? medicationIds[0] : undefined;

                if (time) {
                    openMedicationRoute({
                        pathname: '/metric/medications/log' as any,
                        params: {
                            time,
                            date: scheduledFor,
                            ...(medicationId ? { medicationId } : {}),
                        }
                    });
                    return;
                }

                if (medicationId) {
                    openMedicationRoute(`/(tabs)/(metric)/medications/${ medicationId }`);
                    return;
                }

                openMedicationRoute();
            } catch (error) {
                console.warn('Failed to handle notification response:', error);
            }
        }

        Notifications.getLastNotificationResponseAsync()
            .then((response) => {
                if (response) {
                    routeFromNotificationResponse(response);
                }
            })
            .catch((error) => {
                console.warn('Failed to resolve last notification response:', error);
            });

        const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
            routeFromNotificationResponse(response);
        });

        return () => {
            for (const timer of navigationTimers) {
                clearTimeout(timer);
            }
            subscription.remove();
        };
    }, [isLoading, scope]);

    return null;
}

/** Wrapper that passes activePatientId from AppRoleProvider to AppSyncProvider */
function AppSyncProviderWithPatient({ cfg, children }: {
    cfg: { baseUrl: string; appIssueToken: string };
    children: React.ReactNode
}) {
    const activePatientId = useActivePatientId();
    const { reset } = useAppRole();
    const router = useRouter();

    // T-002: when the active subject revokes this device's access, exit cleanly exactly like
    // the Settings "Rolle wechseln" flow (confirmChangeRole): reset the role scope (local data
    // and the doctor's other patients are kept) and route to the start screen.
    const handleDeviceRevoked = useCallback(async () => {
        await reset(true);
        router.replace('/onboarding');
    }, [reset, router]);

    return (
        <AppSyncProvider cfg={ cfg } activePatientId={ activePatientId } onDeviceRevoked={ handleDeviceRevoked }>
            { children }
        </AppSyncProvider>
    );
}

/**
 * Tenant boundary: key={activePatientId} forces unmount/remount of all children
 * when the active patient changes. This ensures fresh React state, no stale
 * closures, and automatic cache invalidation in DefinitionsProvider,
 * MedicationsProvider, StudiesProvider, and all screens.
 */
function PatientBoundary({ children }: { children: React.ReactNode }) {
    const activePatientId = useActivePatientId();
    return (
        <PatientProvider key={ activePatientId ?? 'none' }>
            <SupplierProposalProvider>
                { children }
            </SupplierProposalProvider>
        </PatientProvider>
    );
}
