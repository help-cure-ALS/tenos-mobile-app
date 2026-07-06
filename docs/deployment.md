# Deployment

Release-Workflow für TENOS.

## 1 — Release-Branch erstellen

```bash
git checkout main
git pull
git checkout -b release/1.0.2
```

## 2 — Release Notes prüfen

Sicherstellen, dass die Fastlane Release Notes für alle Sprachen aktuell sind:

```text
fastlane/metadata/de-DE/release_notes.txt
fastlane/metadata/en-US/release_notes.txt
fastlane/metadata/es-ES/release_notes.txt
fastlane/metadata/fr-FR/release_notes.txt
fastlane/metadata/it/release_notes.txt
fastlane/metadata/ja/release_notes.txt
fastlane/metadata/nl-NL/release_notes.txt
fastlane/metadata/pl/release_notes.txt
fastlane/metadata/pt-PT/release_notes.txt
fastlane/metadata/ro/release_notes.txt
fastlane/metadata/tr/release_notes.txt
fastlane/metadata/zh-Hans/release_notes.txt
```

## 3 — Metadata hochladen

```bash
bundle exec fastlane ios metadata
bundle exec fastlane android metadata
```

Die Android-Lane liest die gleichen Dateien aus `fastlane/metadata/` und mappt
Locales und Dateinamen automatisch auf das Google Play Format
(z.B. `it` → `it-IT`, `zh-Hans` → `zh-CN`, `release_notes.txt` → `changelogs/default.txt`).

## 4 — Release-Branch pushen

```bash
git add .
git commit -m "release 1.0.2"
git push -u origin release/1.0.2
```

## 5 — Tag erstellen und pushen

```bash
git tag v1.0.2
git push origin v1.0.2
```

## 6 — Andere Repos (falls betroffen)

Wenn Änderungen in abhängigen Projekten enthalten sind (z.B. `hca-medical-care`),
dort den gleichen Ablauf durchführen: Release-Branch, Tag, Push.

## 7 — Build & Submit

```bash
eas build --auto-submit --profile production
```

## 8 — Release in main mergen

```bash
git checkout main
git pull
git merge release/1.0.2
git push
```

## 9 — Version erhöhen

In `app.json` die nächste Version setzen:

```jsonc
{
  "expo": {
    "version": "1.0.3"   // ← nächste Version
  }
}
```

```bash
git add app.json
git commit -m "bump version to 1.0.3"
git push
```
