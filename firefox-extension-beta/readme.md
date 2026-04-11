# Redd-Eye Beta – Firefox Extension for New Reddit

Beta version of the Redd-Eye extension, built specifically for the new Reddit redesign (www.reddit.com).

## Features

All the same detection capabilities as the stable extension:

- **Bot Detection** – Flags suspected bot accounts using username patterns, suspicious link analysis, and behavioral heuristics
- **AI Content Detection** – 13-check heuristic engine detecting AI-generated text (formulaic language, lack of contractions, sentence uniformity, corporate vocabulary, and more)
- **Configurable Thresholds** – Adjust AI and Bot detection sensitivity via the settings panel
- **Persistent Settings** – Thresholds saved via `browser.storage.local`
- **Detection Dropdown** – Clickable list of all flagged users/content, sorted by confidence
- **Hover Tooltips** – Hover over flagged content to see detailed score breakdowns
- **Confidence Tiers** – AI detections shown at Low/Mid/High confidence levels with distinct visual styles
- **Live Scanning** – MutationObserver-based scanning for dynamically loaded content (infinite scroll, expanding comments)

## New Reddit Adaptations

- Targets `shreddit-post` and `shreddit-comment` web components used by the new Reddit redesign
- Shadow DOM traversal for content hidden inside web component shadow roots
- Updated username extraction from element attributes (`author`) and new Reddit link patterns
- Deep text extraction that works across shadow boundaries
- Shadow root mutation observers for content loaded inside web components

## Widget Improvements

- Repositioned to bottom-left to avoid overlapping Reddit's navigation and sidebar
- Dark theme with glassmorphic backdrop blur effect for better integration with Reddit's design
- Improved typography using system font stack
- Rounded corners, subtle shadows, and smooth hover transitions
- Reddit-themed accent color (orange) for the save button

## Installation

1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on..."
3. Select the `manifest.json` file from this directory

## Target

- `www.reddit.com` only (new Reddit redesign)
- Does NOT run on `old.reddit.com`