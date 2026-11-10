# Privacy Policy — Page Metadata Inspector

**Last updated: 2026-08-13**

Page Metadata Inspector is a browser extension that inspects the metadata of the web page you are currently viewing. It is designed to do this entirely on your device.

## What the extension does

When you click the extension icon, it reads the currently active tab's HTML — page title, meta tags, canonical link, robots directives, Open Graph tags, Twitter/X card tags, H1 headings, and JSON-LD structured data — and displays the results in the popup.

## What the extension does not do

- It does not collect, log, or store any browsing data.
- It does not transmit page content, URLs, or any other data to any server.
- It does not use analytics, telemetry, or crash reporting of any kind.
- It does not include third-party scripts, trackers, or advertising SDKs.
- It does not require an account or login.
- It does not read or act on any page unless you actively click the extension icon (it uses Chrome's `activeTab` permission, not persistent background access).

## Where data goes

All inspection happens locally in your browser, in memory, for the lifetime of the popup. Nothing is written to disk, synced, or sent anywhere. When you close the popup, the inspected data is discarded. The only exception is the **Copy report** button, which — only when you click it — copies a plain-text summary to your system clipboard using the standard browser clipboard API. That data stays on your device under your control.

## Permissions

See the [README](README.md#permissions) for a full explanation of why each requested permission is needed.

## Changes to this policy

If this policy changes in future versions, the update will be reflected in this file and in the version history of this repository.

## Contact

Questions about this policy can be raised via the project repository or [https://alfielambert.com](https://alfielambert.com).
