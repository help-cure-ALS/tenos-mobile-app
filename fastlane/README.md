fastlane documentation
----

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

## iOS

### ios metadata

```sh
[bundle exec] fastlane ios metadata
```

Upload metadata and screenshots to App Store Connect

### ios fetch_metadata

```sh
[bundle exec] fastlane ios fetch_metadata
```

Download current metadata from App Store Connect

----


## Android

### android metadata

```sh
[bundle exec] fastlane android metadata
```

Upload store listing metadata to Google Play (reuses shared iOS metadata with locale mapping)

### android release_notes

```sh
[bundle exec] fastlane android release_notes
```

Upload release notes to Google Play for a specific track

### android fetch_metadata

```sh
[bundle exec] fastlane android fetch_metadata
```

Download current metadata from Google Play

----

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
