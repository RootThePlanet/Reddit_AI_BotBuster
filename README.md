# Reddit AI BotBuster

## Reddit AI BotBuster is an advanced Firefox extension that detects potential AI-generated content and bot accounts on Reddit, providing a transparent, configurable, and powerful set of tools to help you identify inauthentic content as you browse.

> ⚠️ **Tampermonkey Script Deprecated**
>
> The Tampermonkey userscript (`main/`) has been deprecated. The fully functional **Firefox extension** (`firefox-extension/`) is now the recommended way to use Reddit AI BotBuster. The userscript is kept for reference only and will no longer receive updates.

    🚨 Compatibility Notice

    As of version 4.2.0, this extension is optimized for and fully functional on old.reddit.com. Functionality on the new Reddit design (www.reddit.com) is not guaranteed and may be unreliable. For the best experience, please use the extension with Old Reddit.

## Core Features

    -Real-Time Scanning: Uses an efficient MutationObserver to scan posts and comments as they appear on the page, including with infinite scroll.
    -Confidence-Based Highlighting: AI-generated content is highlighted with different outlines based on the detection confidence score, allowing you to see at a glance what's "possibly AI" versus "very likely AI."
    -On-Hover Score Breakdown: Hover over any highlighted comment to see a detailed tooltip explaining why it was flagged, including which heuristics were triggered and the score breakdown.
    -Configurable Sensitivity: Don't like the default settings? Open the settings panel directly from the popup to adjust the AI and Bot detection thresholds to your preference. Your settings are saved locally.
    -Advanced Heuristic Engine: The extension's detection engine is built on principles from modern AI detection methodologies.

## How It Works: The Detection Engine

The extension analyzes content using a multi-layered heuristic engine inspired by professional detection tools.

    -Stylometry & Linguistic Fingerprinting: The extension analyzes the author's writing style. It looks for an overly formal tone, a lack of common contractions, and an objective, encyclopedic voice that often lacks personal opinion or experience.
    -Burstiness & Variation: Human writing has a natural rhythm with varying sentence lengths. The extension measures this "burstiness." AI-generated text often has a uniform, consistent sentence structure, which results in a low burstiness score.
    -Paraphrase Shield: To combat users who use tools to rephrase AI content, the extension includes a heuristic that detects the "anomalous use of synonyms". It flags text that uses an unnaturally high number of complex words where simpler ones would suffice—a key trait of paraphrased content.
    -Bot & Spam Heuristics: The extension also runs checks for classic bot indicators, including suspicious username patterns (e.g., Word-Word1234) and links to known spam domains.

## Installation (Firefox Extension)

### Option A — Install as a Temporary Extension (for testing / no account required)

1. Download or clone this repository and locate the `firefox-extension/` folder.
2. Open Firefox and navigate to `about:debugging`.
3. Click **"This Firefox"** in the left sidebar.
4. Click **"Load Temporary Add-on…"**.
5. Browse to the `firefox-extension/` folder and select the `manifest.json` file.
6. The extension is now active. It will remain loaded until you restart Firefox.

### Option B — Install as a Permanent Extension via Firefox Add-ons (AMO)

If the extension is published on [addons.mozilla.org](https://addons.mozilla.org), you can install it directly from there like any other Firefox add-on. Once installed it will persist across browser restarts and update automatically.

### Option C — Pack and Install as a Signed Extension (self-distribution)

1. Ensure you have [Node.js](https://nodejs.org) and [`web-ext`](https://github.com/mozilla/web-ext) installed:
   ```
   npm install --global web-ext
   ```
2. From the `firefox-extension/` directory, run:
   ```
   web-ext build
   ```
   This creates a `.zip` file in `firefox-extension/web-ext-artifacts/`.
3. In Firefox, go to `about:addons` → click the gear icon → **"Install Add-on From File…"** and select the generated `.zip`.
   > **Note:** Firefox requires extensions to be signed by Mozilla for permanent installation outside of Developer Edition / Nightly. Use [about:debugging](#option-a) for unsigned local testing.

## Usage Guide

    Reading the Highlights:
        -Light Blue Dashed Outline = Low Confidence AI content.
        -Medium Blue Dashed Outline = Medium Confidence AI content.
        -Dark Blue Solid Outline = High Confidence AI content.
        -Purple Dashed Outline = Flagged as both Bot & AI.
        -Orange Username = Indicates a suspected bot account.

    Viewing Details:
        -Hover your mouse over any highlighted comment to see a detailed tooltip with the exact scores and the reasons for the flag.
        -Click the popup in the top-right corner to see a list of all detected items on the page.

    Adjusting Settings:
        -Click the ⚙️ gear icon in the popup to open the settings panel.
        -Change the threshold values and click "Save". Higher numbers make the extension less sensitive.
        -Your settings are persisted via browser.storage.local and survive browser restarts.

## Configuration

The detection thresholds for both AI and Bot scoring are configurable via the UI. The default values are:

    AI Threshold: 4.0
    Bot Threshold: 2.9

Your custom settings are saved in your browser's local storage and will persist across sessions.

[![ai-detection-low-confidence.png](https://i.postimg.cc/YC4cBB4T/ai-detection-low-confidence.png)](https://postimg.cc/3kHf26FZ)
[![bot-username-detection.png](https://i.postimg.cc/q7n9gcxL/bot-username-detection.png)](https://postimg.cc/HJYShyKc)
[![configure-thresholds-options.png](https://i.postimg.cc/Cx93Frk5/configure-thresholds-options.png)](https://postimg.cc/NK7JD4Nv)
[![detected-bots-and-ai.png](https://i.postimg.cc/gJW1hwMP/detected-bots-and-ai.png)](https://postimg.cc/FfTP5K5P)

