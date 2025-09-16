# Reddit AI BotBuster

## Reddit AI BotBuster is an advanced userscript that detects potential AI-generated content and bot accounts on Reddit, providing a transparent, configurable, and powerful set of tools to help you identify inauthentic content as you browse.

    🚨 Compatibility Notice

    As of version 4.1.0, this script is optimized for and fully functional on old.reddit.com. Functionality on the new Reddit design (www.reddit.com) is not guaranteed and may be unreliable. For the best experience, please use the script with Old Reddit.

## Core Features

    -Real-Time Scanning: Uses an efficient MutationObserver to scan posts and comments as they appear on the page, including with infinite scroll.
    -Confidence-Based Highlighting: AI-generated content is highlighted with different outlines based on the detection confidence score, allowing you to see at a glance what's "possibly AI" versus "very likely AI."
    -On-Hover Score Breakdown: Hover over any highlighted comment to see a detailed tooltip explaining why it was flagged, including which heuristics were triggered and the score breakdown.
    -Configurable Sensitivity: Don't like the default settings? Open the settings panel directly from the popup to adjust the AI and Bot detection thresholds to your preference. Your settings are saved locally.
    -Advanced Heuristic Engine: The script's detection engine is built on principles from modern AI detection methodologies.

## How It Works: The Detection Engine

The script analyzes content using a multi-layered heuristic engine inspired by professional detection tools.

    -Stylometry & Linguistic Fingerprinting: The script analyzes the author's writing style. It looks for an overly formal tone, a lack of common contractions, and an objective, encyclopedic voice that often lacks personal opinion or experience.
    -Burstiness & Variation: Human writing has a natural rhythm with varying sentence lengths. The script measures this "burstiness." AI-generated text often has a uniform, consistent sentence structure, which results in a low burstiness score.
    -Paraphrase Shield: To combat users who use tools to rephrase AI content, the script includes a heuristic that detects the "anomalous use of synonyms". It flags text that uses an unnaturally high number of complex words where simpler ones would suffice—a key trait of paraphrased content.
    -Bot & Spam Heuristics: The script also runs checks for classic bot indicators, including suspicious username patterns (e.g., Word-Word1234) and links to known spam domains.

## Installation

    -Install a Userscript Manager: You need an extension like Tampermonkey for your browser (Chrome, Firefox, Edge, Safari).
    -Install the Script:
        --Click the Tampermonkey icon in your browser and select "Create a new script...".
        --Delete the default code that appears in the editor.
        --Copy the entire main.js script code.
        --Paste the code into the empty Tampermonkey editor.
    -Save: Press Ctrl+S or go to File > Save. Ensure the script is enabled in your Tampermonkey dashboard.
    -Browse Reddit: The script is now active. Remember to use it on old.reddit.com for best results.

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
        -Change the threshold values and click "Save". Higher numbers make the script less sensitive.

## Configuration

The detection thresholds for both AI and Bot scoring are configurable via the UI. The default values are:

    AI Threshold: 4.0
    Bot Threshold: 2.9

Your custom settings are saved in your browser's local storage and will persist across sessions.

[![ai-detection-low-confidence.png](https://i.postimg.cc/YC4cBB4T/ai-detection-low-confidence.png)](https://postimg.cc/3kHf26FZ)
[![bot-username-detection.png](https://i.postimg.cc/q7n9gcxL/bot-username-detection.png)](https://postimg.cc/HJYShyKc)
[![configure-thresholds-options.png](https://i.postimg.cc/Cx93Frk5/configure-thresholds-options.png)](https://postimg.cc/NK7JD4Nv)
[![detected-bots-and-ai.png](https://i.postimg.cc/gJW1hwMP/detected-bots-and-ai.png)](https://postimg.cc/FfTP5K5P)

