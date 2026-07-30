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

## 10 — Update erzwingen (Versions-Gate, optional)

Für Releases mit Breaking Changes (inkompatible Server-API, kaputtes
Datenformat, Sicherheitsfix) kann eine Mindestversion erzwungen werden.
Installationen unterhalb der Mindestversion zeigen einen blockierenden
Update-Screen mit Store-Link — die App ist bis zum Update nicht nutzbar.

Konfiguriert wird das im **Sync Vault** (`.env` neben der
`docker-compose.yml`, siehe dort `docs/api.md` → App Config):

```bash
MIN_APP_VERSION_IOS=1.1.0
MIN_APP_VERSION_ANDROID=1.1.0
APP_STORE_URL_IOS=https://apps.apple.com/app/id<apple-id>
APP_STORE_URL_ANDROID=https://play.google.com/store/apps/details?id=<package>
```

Danach Container neu erstellen (ein `restart` übernimmt Env-Änderungen nicht):

```bash
docker compose up -d api
```

Regeln:

- Mindestversion **erst anheben, wenn die neue Version in beiden Stores
  live ist** — Review (iOS) und Rollout (Android) enden nie gleichzeitig,
  deshalb sind die Werte pro Plattform getrennt.
- Leerer Wert = Gate für die Plattform deaktiviert.
- Die App prüft beim Kaltstart und bei jedem Foreground-Wechsel
  (`src/services/appVersionGate.ts`). Verglichen wird die native
  Binary-Version; EAS-/OTA-Updates sind davon unabhängig und erreichen
  ohnehin nur Installationen derselben Store-Version.
- Fail-open: Ist der Vault nicht erreichbar, gilt die zuletzt gecachte
  Konfiguration; ohne Cache startet die App normal. Nutzer werden nie
  durch ein Serverproblem ausgesperrt.

Prüfen:

```bash
curl https://<vault-domain>/app-config
```
