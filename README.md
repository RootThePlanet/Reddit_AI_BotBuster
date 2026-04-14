# REDD-EYE

```text
██████╗ ███████╗██████╗ ██████╗       ███████╗██╗   ██╗███████╗
██╔══██╗██╔════╝██╔══██╗██╔══██╗      ██╔════╝╚██╗ ██╔╝██╔════╝
██████╔╝█████╗  ██║  ██║██║  ██║█████╗█████╗   ╚████╔╝ █████╗
██╔══██╗██╔══╝  ██║  ██║██║  ██║╚════╝██╔══╝    ╚██╔╝  ██╔══╝
██║  ██║███████╗██████╔╝██████╔╝      ███████╗   ██║   ███████╗
╚═╝  ╚═╝╚══════╝╚═════╝ ╚═════╝       ╚══════╝   ╚═╝   ╚══════╝
```

![Manifest V3](https://img.shields.io/badge/manifest-v3-0A84FF?style=for-the-badge)
![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)
![Firefox Add-on](https://img.shields.io/badge/Firefox-Add--on-FF7139?style=for-the-badge&logo=firefoxbrowser&logoColor=white)
![License MIT](https://img.shields.io/badge/license-MIT-7CB342?style=for-the-badge)
![Store Listings Incoming](https://img.shields.io/badge/Store%20Listings-Incoming-6f42c1?style=for-the-badge)

Redd-Eye is a browser extension for Reddit that flags content likely to be AI-generated and highlights accounts that match common bot behavior patterns. It runs while you browse, scans posts/comments in real time, and gives you transparent score-based indicators so you can quickly judge credibility.

> Chrome Web Store and Firefox Add-ons store listings are **incoming**. Until then, use local developer installation.

## What Redd-Eye Does

Redd-Eye combines AI-writing heuristics and bot-account heuristics in one pass:

- **AI-content detection:** Scores writing style signals such as low burstiness, over-formal phrasing, repetitive linguistic patterns, and other statistical cues common in generated text.
- **Bot-account detection:** Checks username and behavior-linked indicators (for example, suspicious naming patterns and spam-adjacent linking patterns).
- **On-page visual warnings:** Adds confidence-based highlights so suspicious content stands out while you scroll.
- **Detailed reasoning on hover:** Hovering flagged content reveals score breakdowns and triggered checks.
- **Configurable sensitivity:** You can tune AI and bot thresholds from the extension UI to fit stricter or looser filtering.

## Screenshots

### New Reddit Screenshot
[![DCca2MLd-EX.png](https://i.postimg.cc/CLRcHP2z/DCca2MLd-EX.png)](https://postimg.cc/2VfdCwrD)

### Old Reddit Screenshot
[![screenshot-2.png](https://i.postimg.cc/Kv951dDK/screenshot-2.png)](https://postimg.cc/JGkXgYgm)

## Installation

### 1) Clone the repository

```bash
git clone https://github.com/RootThePlanet/Redd-Eye.git
cd Redd-Eye
```

### 2) Install in Chrome (unpacked)

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select: `chrome-extension/`
5. Open Reddit and start browsing; Redd-Eye activates on supported Reddit pages.

### 3) Install in Firefox (temporary load)

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on**.
3. Select: `firefox-extension/manifest.json`
4. Browse Reddit and verify highlights/tooltips appear.

> Temporary Firefox installs are removed when Firefox restarts. For distribution builds, package/sign with Mozilla tooling.

### Optional: Build a Firefox package

```bash
npm install --global web-ext
cd firefox-extension
web-ext build
```

The generated archive appears under `firefox-extension/web-ext-artifacts/`.

## Usage

- **Read highlight strength:** stronger styling indicates higher confidence.
- **Hover flagged content:** see exactly why it was flagged.
- **Adjust thresholds:** use the popup settings to tune false-positive/false-negative balance.
- **Review both content and accounts:** Redd-Eye is designed to evaluate text and author signals together.

## Default Thresholds

- **AI threshold:** `2.5`
- **Bot threshold:** `2.9`

These values can be changed at runtime from the extension settings panel.
