import { buildMedicationReminderPlan } from "../../src/medications/reminderPlan";
import type { MedicationItem, MedicationSchedule } from "../../src/medications/types";

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
    assert(actual === expected, `${message}: expected ${String(expected)}, got ${String(actual)}`);
}

function assertDeepEqual(actual: string[] | undefined, expected: string[], message: string): void {
    assert(!!actual, `${message}: expected array`);
    assert(
        actual.length === expected.length && actual.every((value, index) => value === expected[index]),
        `${message}: expected ${expected.join(",")}, got ${actual.join(",")}`
    );
}

function medication(id: string, name: string, schedule: MedicationSchedule): MedicationItem {
    const now = "2026-06-09T08:00:00.000Z";
    return {
        id,
        name,
        form: "tablet",
        schedule,
        duration: { startDate: "2026-06-01T00:00:00.000Z" },
        createdAt: now,
        updatedAt: now,
        isActive: true,
    };
}

export function runMedicationRemindersUnitTests() {
    const dailyPlan = buildMedicationReminderPlan(
        [
            medication("med-a", "A", { type: "daily", times: ["13:30"] }),
            medication("med-b", "B", { type: "daily", times: ["13:30"] }),
            medication("med-c", "C", { type: "daily", times: ["19:00"] }),
        ],
        { now: new Date("2026-06-09T10:00:00.000Z") }
    );

    assertEqual(dailyPlan.length, 2, "daily plan should group medications at the same time");
    assertDeepEqual(
        dailyPlan.find((item) => item.time === "13:30")?.medicationIds.sort(),
        ["med-a", "med-b"],
        "daily group should contain both medication ids"
    );
    assertEqual(
        dailyPlan.find((item) => item.time === "13:30")?.identifier,
        "med-reminder:group:daily:13:30",
        "daily group should use a shared identifier"
    );

    const coveredPlan = buildMedicationReminderPlan(
        [
            medication("daily", "Daily", { type: "daily", times: ["08:00"] }),
            medication("weekly", "Weekly", { type: "weekly", times: ["08:00"], weekdays: [2] }),
            medication("rolling", "Rolling", { type: "every_x_days", times: ["08:00"], intervalDays: 1 }),
            medication("weekly-only", "Weekly only", { type: "weekly", times: ["18:00"], weekdays: [2] }),
        ],
        { now: new Date("2026-06-09T06:00:00.000Z"), lookaheadDays: 2 }
    );

    assert(
        !coveredPlan.some((item) => item.identifier === "med-reminder:group:weekly:2:08:00"),
        "daily reminder should cover weekly medications at the same time"
    );
    assert(
        !coveredPlan.some((item) => item.identifier.includes(":once:") && item.time === "08:00"),
        "daily reminder should cover rolling medications at the same time"
    );
    assert(
        coveredPlan.some((item) => item.identifier === "med-reminder:group:weekly:2:18:00"),
        "weekly-only slot should still be scheduled"
    );
}
