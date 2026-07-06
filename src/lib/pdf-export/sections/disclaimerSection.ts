export function buildDisclaimerSection(isDE: boolean): string {
    const text = isDE
        ? 'Dieser Bericht wurde automatisch aus den in der App erfassten Gesundheitsdaten erstellt. Er dient ausschließlich der Information und ersetzt keine ärztliche Diagnose, Beratung oder Behandlung. Alle Angaben ohne Gewähr.'
        : 'This report was automatically generated from health data recorded in the app. It is for informational purposes only and does not replace medical diagnosis, advice, or treatment. All information without guarantee.';

    return `<div class="disclaimer">${text}</div>`;
}
