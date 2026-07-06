import { base as temperatureBase } from "../../src/metrics/definitions/bodyTemperature/base";
import { base as weightBase } from "../../src/metrics/definitions/weight/base";
import {
    convertMetricDelta,
    convertMetricValues,
    createDisplayDefinition,
    deriveMeasurementSystemFromCountry,
    getDisplayUnit,
    toCanonicalEntry,
    toDisplayEntry,
} from "../../src/metrics/units";
import type { MetricDefinition, MetricEntry } from "../../src/metrics/types";

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

function assertClose(actual: number | undefined, expected: number, message: string): void {
    assert(typeof actual === "number", `${message}: expected a number`);
    const delta = Math.abs(actual - expected);
    assert(delta < 0.0001, `${message}: expected ${expected}, got ${actual}`);
}

export function runMetricUnitsUnitTests(): void {
    const weight = weightBase as MetricDefinition;
    const temperature = temperatureBase as MetricDefinition;

    assert(deriveMeasurementSystemFromCountry("US") === "us", "US should prefer us units");
    assert(deriveMeasurementSystemFromCountry("DE") === "metric", "DE should prefer metric units");
    assert(getDisplayUnit(weight, undefined, "us") === "lb", "weight should default to lb for US");
    assert(getDisplayUnit(weight, undefined, "metric") === "kg", "weight should default to kg for metric");

    {
        const converted = convertMetricValues({ value: 100 }, "kg", "lb", weight);
        assertClose(converted.value, 220.462262185, "100 kg should convert to lb");

        const canonical = convertMetricValues(converted, "lb", "kg", weight);
        assertClose(canonical.value, 100, "lb should round-trip to kg");
    }

    {
        const fahrenheit = convertMetricValues({ value: 37 }, "°C", "°F", temperature);
        assertClose(fahrenheit.value, 98.6, "37 C should convert to Fahrenheit");

        const celsius = convertMetricValues(fahrenheit, "°F", "°C", temperature);
        assertClose(celsius.value, 37, "Fahrenheit should round-trip to Celsius");

        const delta = convertMetricDelta(1, "°C", "°F", temperature);
        assertClose(delta, 1.8, "temperature deltas must not apply the Fahrenheit offset");
    }

    {
        const entry: MetricEntry = {
            id: "weight-test",
            values: { value: 220.462262185 },
            unit: "lb",
            date: new Date("2026-06-08T00:00:00.000Z"),
        };

        const canonical = toCanonicalEntry(entry, weight);
        assert(canonical.unit === "kg", "canonical weight entry should use kg");
        assertClose(canonical.values.value, 100, "canonical entry should be converted to kg");

        const display = toDisplayEntry(canonical, weight, "lb");
        assert(display.unit === "lb", "display weight entry should use lb");
        assertClose(display.values.value, 220.462262185, "display entry should be converted to lb");
    }

    {
        const displayDefinition = createDisplayDefinition(weight, "lb");
        assert(displayDefinition.defaultUnit === "lb", "display definition should expose selected unit");
        assertClose(displayDefinition.fields[0]?.validation?.min, 44.092452437, "min validation should convert to lb");
        assertClose(displayDefinition.fields[0]?.validation?.max, 661.386786555, "max validation should convert to lb");
    }
}
