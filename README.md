# Reddit AI BotBuster
Reddit AI BotBuster is a userscript that spots potential bots and AI posts on Reddit. It scans as you browse, highlighting suspicious content with color-coded outlines and shows a popup with usernames and snippets.

## Description

This Tampermonkey userscript scans Reddit pages in real time for posts and comments that exhibit AI- or bot-like characteristics. Using advanced heuristics with fractional weights, the script analyzes features like explicit AI disclaimers, lack of contractions, repetitive sentence structure (low burstiness), reduced lexical diversity, and low bigram uniqueness. It further enhances detection with basic semantic coherence, proper noun consistency, context shift, and syntactic complexity analyses.

A unique feature of this version is that it factors in the user's account age—if a user’s account is less than **2 months old**, a small penalty is applied, increasing the likelihood of flagging very new accounts. Flagged elements are outlined (red for bot-like, blue for AI-like, purple for mixed signals), and a persistent popup in the top-right corner shows a count and details of all flagged items.

## Installation & Usage

1. **Install Tampermonkey:**  
   Add the [Tampermonkey extension](https://www.tampermonkey.net/) to your browser.

2. **Create a New Script:**  
   Click the Tampermonkey icon, select “Create a new script…”, and delete any pre-filled code.

3. **Paste the Script Code:**  
   Copy the entire script code (from the file provided) and paste it into the editor.

4. **Save & Enable:**  
   Save the script and ensure it is enabled. Then, reload Reddit pages.

5. **View Results:**  
   The script will scan posts and comments dynamically. Flagged items will be highlighted, and you can click the popup in the top-right to view details.

## Notes

- **Threshold & Weights:**  
  The detection threshold is set to 5. Fractional weights were tuned to reduce false positives while still capturing suspicious AI-like patterns.

- **Dynamic Content:**  
  The script uses a MutationObserver and a periodic scan (every 3 seconds) to handle new and expanding content.

- **Further Adjustments:**  
  You can tweak the weights or threshold directly in the script if needed.

Enjoy a more authentic Reddit experience with enhanced detection of automated and AI-generated content!
