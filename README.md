# Page Metadata Inspector

A lightweight Chrome extension for inspecting page metadata, social tags and structured data in one click.

Page Metadata Inspector reads the metadata from the page you’re currently viewing and gives you a quick view of what is present, what is missing and what may need attention.

## What it checks

### Core metadata

* Page title
* Meta description
* Canonical URL
* Robots directives
* H1 count

### Open Graph

* `og:title`
* `og:description`
* `og:image`
* `og:url`
* `og:type`

### Twitter / X cards

* `twitter:card`
* `twitter:title`
* `twitter:description`
* `twitter:image`

### Structured data

* Detects JSON-LD blocks
* Counts structured-data blocks
* Identifies common `@type` values such as:

  * `Person`
  * `Organization`
  * `Product`
  * `Article`
  * `WebSite`
  * `BreadcrumbList`

## Issue guidance

Page Metadata Inspector also flags obvious metadata issues and explains what to do next.

Examples include:

* Missing title
* Missing meta description
* Missing canonical
* No H1
* Multiple H1s
* Missing Open Graph metadata
* Missing social preview image
* Missing Twitter/X card metadata
* Missing JSON-LD
* Titles or descriptions outside common length ranges

The guidance is deliberately practical rather than absolute. Search engines and social platforms can choose how they interpret page metadata, so the extension avoids presenting common conventions as hard ranking rules.

## How it works

Click the extension while viewing a webpage.

Page Metadata Inspector temporarily reads the current page, extracts its metadata and displays the results inside the extension popup.

All inspection happens locally in your browser.

The extension:

* does not modify the webpage
* does not send page data to a server
* does not store browsing history
* does not use analytics
* does not require an account
* does not use external APIs

## Copy report

Use **Copy report** to copy the current page inspection as plain text.

This makes it easy to paste the results into:

* ChatGPT
* Claude
* an issue tracker
* an email
* a development ticket
* your own notes

## Installation for local testing

Clone or download this repository.

Then open Chrome and go to:

```text
chrome://extensions
```

Turn on **Developer mode**.

Click **Load unpacked** and select the project folder containing `manifest.json`.

Pin **Page Metadata Inspector** to your Chrome toolbar and open it while viewing any normal webpage.

## Permissions

Page Metadata Inspector uses narrow Chrome permissions so it only accesses a page when you explicitly invoke the extension.

### `activeTab`

Temporarily gives the extension access to the tab you are actively inspecting.

### `scripting`

Allows the extension to read metadata from that active page.

The extension does not request permanent access to every site you visit.

## Privacy

Page Metadata Inspector processes inspected page metadata locally in the browser.

No page content, browsing activity or personal data is transmitted to an external server.

See [PRIVACY.md](./PRIVACY.md) for the full privacy statement.

## Chrome Web Store

Chrome Web Store listing coming soon.

## Built by Alfie Lambert

I’m a founder and product/GTM operator who increasingly builds the tools and systems I need myself using AI-assisted development, APIs, automation and custom code.

More of my work:

[alfielambert.com](https://alfielambert.com)
