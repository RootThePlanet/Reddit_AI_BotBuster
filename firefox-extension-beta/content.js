/*
 Redd-Eye Beta – Firefox WebExtension content script.
 Version 5.0.0 – New Reddit (www.reddit.com) redesign support.
 */

(function() {
    'use strict';

    /************************************
     * 1. STYLES & UI INJECTION
     ************************************/
    const style = document.createElement('style');
    style.textContent = `
        .botUsername { color: orange !important; font-size: 14px !important; font-weight: bold !important; }
        .botAndAiContentDetected { outline: 3px dashed purple !important; outline-offset: -3px; }
        .aiContentLow  { outline: 2px dashed #007bff !important; outline-offset: -2px; }
        .aiContentMid  { outline: 3px dashed #0056b3 !important; outline-offset: -3px; }
        .aiContentHigh { outline: 3px solid  #00234d !important; outline-offset: -3px; }

        #botCounterPopup {
            position: fixed;
            bottom: 16px;
            left: 16px;
            width: 300px;
            z-index: 99999;
            background: rgba(30, 30, 30, 0.92);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.35);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            font-size: 13px;
            color: #e0e0e0;
            border: 1px solid rgba(255,255,255,0.08);
            user-select: none;
            transition: opacity 0.2s;
        }
        #botCounterPopup:hover { opacity: 1 !important; }

        #botPopupHeader {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-weight: 600;
            padding: 12px 14px;
            cursor: pointer;
            border-bottom: 1px solid rgba(255,255,255,0.06);
            letter-spacing: 0.3px;
        }
        #botPopupHeader span:first-child {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        #botPopupHeader .reddeye-logo {
            width: 18px;
            height: 18px;
            border-radius: 4px;
        }
        #settingsIcon {
            cursor: pointer;
            font-size: 16px;
            opacity: 0.7;
            transition: opacity 0.15s;
        }
        #settingsIcon:hover { opacity: 1; }
        #settingsPanel {
            display: none;
            padding: 12px 14px;
            border-top: 1px solid rgba(255,255,255,0.06);
            background: rgba(0,0,0,0.2);
        }
        #settingsPanel label {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 6px 0;
            font-size: 12px;
            color: #b0b0b0;
        }
        #settingsPanel input {
            width: 60px;
            margin-left: 10px;
            padding: 4px 6px;
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 4px;
            background: rgba(255,255,255,0.08);
            color: #e0e0e0;
            font-size: 12px;
        }
        #saveSettingsBtn {
            background: linear-gradient(135deg, #ff4500, #ff6a33);
            color: white;
            border: none;
            border-radius: 6px;
            padding: 6px 14px;
            cursor: pointer;
            margin-top: 8px;
            font-size: 12px;
            font-weight: 600;
            width: 100%;
            transition: filter 0.15s;
        }
        #saveSettingsBtn:hover { filter: brightness(1.1); }

        #botDropdown {
            display: none;
            max-height: 260px;
            overflow-y: auto;
            padding: 4px 0;
            scrollbar-width: thin;
            scrollbar-color: rgba(255,255,255,0.15) transparent;
        }
        #botDropdown a {
            display: block;
            padding: 6px 14px;
            text-decoration: none;
            color: #c0c0c0;
            font-size: 12px;
            transition: background-color 0.1s;
        }
        #botDropdown a:hover { background-color: rgba(255,255,255,0.06); color: #fff; }

        #aiScoreTooltip {
            position: fixed;
            display: none;
            background: rgba(20, 20, 20, 0.95);
            color: #e8e8e8;
            border-radius: 8px;
            padding: 10px 12px;
            font-size: 12px;
            z-index: 100000;
            max-width: 320px;
            pointer-events: none;
            box-shadow: 0 4px 16px rgba(0,0,0,0.4);
            border: 1px solid rgba(255,255,255,0.1);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        #aiScoreTooltip ul { margin: 4px 0 0; padding: 0 0 0 16px; }
        #aiScoreTooltip li { margin-bottom: 3px; color: #b0b0b0; }
    `;
    document.head.appendChild(style);

    /************************************
     * 2. CONFIGURATION & STATE
     ************************************/
    const DEFAULT_AI_THRESHOLD  = 2.5;
    const DEFAULT_BOT_THRESHOLD = 2.9;
    const CONFIDENCE_MID_TIER   = 2.5;
    const CONFIDENCE_HIGH_TIER  = 5.0;

    let AI_THRESHOLD  = DEFAULT_AI_THRESHOLD;
    let BOT_THRESHOLD = DEFAULT_BOT_THRESHOLD;

    const suspiciousUserPatterns = [
        /bot/i,
        /^[A-Za-z]+-[A-Za-z]+\d{4}$/,
        /^[A-Za-z]+[_-][A-Za-z]+\d{2,4}$/,
        /^[A-Za-z]+\d{4,}$/,
        /^(user|redditor)\d{6,}$/i
    ];
    const genericResponses = [
        "i agree dude", "yes you are right", "well said", "totally agree",
        "i agree", "right you are", "well spoken, you are", "perfectly said this is"
    ];
    const scamLinkRegex = /\.(live|life|shop|xyz|buzz|top|click|fun|site|online|store|blog|app|digital|network|cloud)\b/i;
    const MIN_WORD_COUNT_FOR_AI_DETECTION = 25;

    /* New Reddit redesign DOM selectors */
    const CONTENT_SELECTORS = [
        'shreddit-post',
        'shreddit-comment',
        'article',
        'div[data-testid="post-container"]',
        'div[data-testid="comment"]',
        'div[slot="comment"]'
    ];
    const USERNAME_SELECTORS = [
        'a[data-testid="post_author_link"]',
        'a[data-click-id="user"]',
        'a.author',
        'a[href*="/user/"]'
    ].join(', ');

    let botCount = 0;
    let detectedBots = [];
    let detectionIndex = 0;
    let isNavigating = false;

    /************************************
     * 3. PERSISTENT SETTINGS via browser.storage.local
     ************************************/
    function loadSettings(callback) {
        browser.storage.local.get({ ai_threshold: DEFAULT_AI_THRESHOLD, bot_threshold: DEFAULT_BOT_THRESHOLD })
            .then(result => {
                AI_THRESHOLD  = result.ai_threshold;
                BOT_THRESHOLD = result.bot_threshold;
                callback();
            })
            .catch(() => { callback(); });
    }

    function saveSettings(aiVal, botVal) {
        AI_THRESHOLD  = aiVal;
        BOT_THRESHOLD = botVal;
        browser.storage.local.set({ ai_threshold: aiVal, bot_threshold: botVal });
    }

    /************************************
     * 4. UTILITY FUNCTIONS
     ************************************/
    function countSyllables(word) {
        word = word.toLowerCase();
        if (word.length <= 3) return 1;
        word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
        word = word.replace(/^y/, '');
        const matches = word.match(/[aeiouy]{1,}/g);
        return matches ? matches.length : 1;
    }

    function computeReadabilityScore(text) {
        const sentenceMatches = text.match(/[^.!?]+[.!?]+/g);
        if (!sentenceMatches) return null;
        const words = text.split(/\s+/).filter(w => w.length > 0);
        if (words.length === 0 || sentenceMatches.length === 0) return null;
        const syllableCount = words.reduce((acc, word) => acc + countSyllables(word), 0);
        return 206.835 - 1.015 * (words.length / sentenceMatches.length) - 84.6 * (syllableCount / words.length);
    }

    function escapeHTML(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Extract text content from an element, traversing into shadow DOM if needed.
     */
    function getDeepTextContent(elem) {
        if (!elem) return '';
        let text = '';

        /* If the element has a shadow root, gather text from it */
        if (elem.shadowRoot) {
            text += getDeepTextContent(elem.shadowRoot);
        }

        for (const child of elem.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) {
                text += child.textContent;
            } else if (child.nodeType === Node.ELEMENT_NODE) {
                text += getDeepTextContent(child);
            }
        }
        return text;
    }

    /**
     * Extract username from a new Reddit element.
     * New Reddit uses shreddit-post[author] and shreddit-comment[author] attributes,
     * as well as various anchor patterns.
     */
    function extractUsername(elem) {
        /* Try the author attribute on shreddit elements first */
        const tag = elem.tagName ? elem.tagName.toLowerCase() : '';
        if ((tag === 'shreddit-post' || tag === 'shreddit-comment') && elem.hasAttribute('author')) {
            return elem.getAttribute('author');
        }

        /* Try standard selectors */
        const userElem = queryDeep(elem, USERNAME_SELECTORS);
        if (userElem) {
            const text = userElem.textContent.trim().replace(/^u\//, '');
            if (text) return text;
        }

        /* Try data-author attribute */
        if (elem.hasAttribute('data-author')) {
            return elem.getAttribute('data-author');
        }

        /* Fallback: check ancestor shreddit elements for author attribute */
        const shredditParent = elem.closest('shreddit-post[author], shreddit-comment[author]');
        if (shredditParent) {
            return shredditParent.getAttribute('author');
        }

        /* Fallback: check shadow DOM host for author attribute */
        const rootNode = elem.getRootNode();
        if (rootNode && rootNode.host) {
            const host = rootNode.host;
            const hostTag = host.tagName ? host.tagName.toLowerCase() : '';
            if ((hostTag === 'shreddit-post' || hostTag === 'shreddit-comment') && host.hasAttribute('author')) {
                return host.getAttribute('author');
            }
        }

        return '';
    }

    /**
     * querySelector that also searches inside shadow roots.
     */
    function queryDeep(root, selector) {
        let result = root.querySelector(selector);
        if (result) return result;

        if (root.shadowRoot) {
            result = root.shadowRoot.querySelector(selector);
            if (result) return result;
        }

        const children = root.querySelectorAll('*');
        for (const child of children) {
            if (child.shadowRoot) {
                result = child.shadowRoot.querySelector(selector);
                if (result) return result;
            }
        }
        return null;
    }

    /**
     * querySelectorAll that also searches inside shadow roots.
     */
    function queryDeepAll(root, selector) {
        const results = Array.from(root.querySelectorAll(selector));

        if (root.shadowRoot) {
            results.push(...root.shadowRoot.querySelectorAll(selector));
        }

        const children = root.querySelectorAll('*');
        for (const child of children) {
            if (child.shadowRoot) {
                results.push(...child.shadowRoot.querySelectorAll(selector));
            }
        }
        return results;
    }

    /************************************
     * 5. AI & BOT DETECTION ENGINES
     ************************************/
    function computeAIScore(text, paragraphCount) {
        paragraphCount = paragraphCount || 1;
        let score = 0;
        const reasons = [];
        const lowerText = text.toLowerCase();
        const words = lowerText.split(/\s+/).filter(w => w.length > 0);
        const wordCount = words.length;

        if (wordCount < MIN_WORD_COUNT_FOR_AI_DETECTION) return { score: 0, reasons: [] };

        // Immediate return: self-disclosed as AI
        if (/\bas an (ai|artificial intelligence)( language model)?\b/.test(lowerText)) {
            return { score: 10.0, reasons: ["Self-disclosed as an AI [+10.0]"] };
        }

        // CHECK 1: Formulaic / transitional AI phrases
        const aiFormulaicPhrases = [
            "in conclusion", "furthermore", "moreover", "on the other hand",
            "it is important to note", "ultimately", "in summary",
            "delve deeper into", "explore the nuances of",
            "it's worth noting", "it is worth noting",
            "it should be noted", "it's important to note",
            "that being said", "having said that", "with that said",
            "needless to say", "at the end of the day",
            "all in all", "to put it simply", "first and foremost",
            "last but not least", "to summarize", "in other words",
            "it goes without saying", "as previously mentioned",
            "in today's world", "in today's society",
            "at its core", "when all is said and done",
            "to a certain extent", "in light of", "with this in mind",
            "it's clear that", "it is clear that",
            "what's more", "to this end"
        ];
        let formulaicPhraseCount = 0;
        aiFormulaicPhrases.forEach(phrase => { if (lowerText.includes(phrase)) formulaicPhraseCount++; });
        if (formulaicPhraseCount > 0) {
            const points = Math.min(formulaicPhraseCount * 1.2, 6.0);
            score += points;
            reasons.push(`Formulaic Language [+${points.toFixed(1)}]`);
        }

        // CHECK 2: AI helper / closing phrases (very distinctive of AI)
        const aiHelperClosings = [
            "hope this helps", "hope that helps", "i'd be happy to",
            "feel free to ask", "let me know if you have",
            "please don't hesitate", "happy to help",
            "i hope this clarifies", "hope this clarifies",
            "feel free to reach out"
        ];
        if (aiHelperClosings.some(phrase => lowerText.includes(phrase))) {
            score += 2.0;
            reasons.push("AI Helper Closing [+2.0]");
        }

        // CHECK 3: AI enthusiasm / affirmation openers
        const trimmedLower = lowerText.trimStart();
        const aiEnthusiasmOpeners = [
            "absolutely!", "absolutely,", "absolutely. ",
            "certainly!", "certainly,", "certainly. ",
            "great question", "excellent question",
            "of course!", "of course,", "of course. ",
            "indeed!", "indeed,", "great point"
        ];
        if (aiEnthusiasmOpeners.some(opener => trimmedLower.startsWith(opener))) {
            score += 1.5;
            reasons.push("AI Enthusiasm Opener [+1.5]");
        }

        // CHECK 4: Lacks contractions (AI rarely uses them)
        const contractions = lowerText.match(/\b(i'm|you're|they're|we're|can't|won't|didn't|isn't|it's|i've|i'd|you'd|couldn't|shouldn't|wouldn't|haven't|hasn't)\b/g);
        if (wordCount > 80 && (!contractions || contractions.length < (wordCount / 80))) {
            score += 1.8;
            reasons.push("Lacks Contractions [+1.8]");
        }

        // CHECK 5: Unnatural / corporate synonym vocabulary
        const complexSynonymStems = [
            'utiliz', 'leverag', 'commenc', 'facilitat', 'elucid',
            'henceforth', 'nevertheless', 'demonstrat',
            'comprehens', 'multifacet', 'holistic', 'proactiv',
            'streamlin', 'synerg', 'robust', 'paradigm',
            'encompass', 'foster', 'catalyst', 'imperativ',
            'nuanc', 'priorit', 'cultivat'
        ];
        let complexWordCount = 0;
        words.forEach(word => { if (complexSynonymStems.some(stem => word.startsWith(stem))) complexWordCount++; });
        if (wordCount > 50 && complexWordCount > (wordCount / 75)) {
            const points = complexWordCount * 0.8;
            score += points;
            reasons.push(`Unnatural Synonyms [+${points.toFixed(1)}]`);
        }

        // CHECK 6: Lacks personal opinion markers (when text is also formal)
        const personalPhrases = ["i think", "i feel", "i believe", "in my opinion", "in my experience", "personally,", "i reckon", "i suspect"];
        if (wordCount > 60 && formulaicPhraseCount > 0 && !personalPhrases.some(p => lowerText.includes(p))) {
            score += 1.0;
            reasons.push("Lacks Personal Opinion [+1.0]");
        }

        // CHECK 7: Sentence length variance (AI writes with very uniform sentence lengths)
        const sentencesArr = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
        if (sentencesArr.length > 3) {
            const lengths = sentencesArr.map(s => s.split(/\s+/).length);
            const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
            const variance = lengths.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / lengths.length;
            if (wordCount > 50 && variance < 15) {
                score += 1.5;
                reasons.push("Low Sentence Variance [+1.5]");
            }
            if (variance > 40) {
                score -= 1.0;
                reasons.push("High Burstiness (Human-like) [-1.0]");
            }
        }

        // CHECK 8: Well-structured multi-paragraph response
        if (paragraphCount > 3 && wordCount > 80) {
            score += 0.5;
            reasons.push(`Well-structured (${paragraphCount} Paras) [+0.5]`);
        }

        // CHECK 9: Emoji presence (human indicator)
        if (/\p{Emoji_Presentation}/gu.test(text)) {
            score -= 1.0;
            reasons.push("Contains Emojis [-1.0]");
        }

        // CHECK 10: Flesch readability (AI tends to write clean, readable text)
        const readability = computeReadabilityScore(text);
        if (readability !== null && readability > 70) {
            score += 0.55;
            reasons.push("High Readability Score [+0.55]");
        }

        // CHECK 11: Importance / urgency framing (AI over-uses these constructs)
        const urgencyFrames = [
            "it's crucial to", "it is crucial to",
            "it's essential to", "it is essential to",
            "it's vital to", "it is vital to",
            "it's imperative to", "it is imperative to",
            "it's key to note", "it is key to note"
        ];
        const urgencyCount = urgencyFrames.filter(phrase => lowerText.includes(phrase)).length;
        if (urgencyCount > 0) {
            const points = urgencyCount * 0.9;
            score += points;
            reasons.push(`Importance Framing [+${points.toFixed(1)}]`);
        }

        // CHECK 12: Passive voice / impersonal hedging
        const passiveHedges = [
            "it can be said", "it has been shown", "it is widely",
            "it is generally", "it is commonly", "research suggests",
            "studies show", "studies suggest", "according to research",
            "it is well-known", "it has been established"
        ];
        const passiveCount = passiveHedges.filter(phrase => lowerText.includes(phrase)).length;
        if (passiveCount > 0) {
            const points = passiveCount * 0.8;
            score += points;
            reasons.push(`Impersonal Hedging [+${points.toFixed(1)}]`);
        }

        // CHECK 13: Structured list patterns (AI frequently uses numbered/bulleted lists)
        const numberedListMatches = text.match(/^\s*\d+[.)]\s+\S/mg);
        const bulletListMatches = text.match(/^\s*[-•*]\s+\S/mg);
        const listItemCount = (numberedListMatches ? numberedListMatches.length : 0) +
                              (bulletListMatches ? bulletListMatches.length : 0);
        if (listItemCount >= 3) {
            score += 1.5;
            reasons.push("Structured List Pattern [+1.5]");
        }

        // CHECK 14: Vocabulary diversity (Type-Token Ratio)
        if (wordCount >= 50) {
            const uniqueWords = new Set(words);
            const ttr = uniqueWords.size / wordCount;
            if (ttr < 0.4) {
                score += 1.2;
                reasons.push("Low Vocabulary Diversity [+1.2]");
            } else if (ttr > 0.75) {
                score -= 0.5;
                reasons.push("High Vocabulary Diversity (Human-like) [-0.5]");
            }
        }

        // CHECK 15: Repetitive sentence starters
        if (sentencesArr.length >= 4) {
            const starters = sentencesArr.map(s => {
                const firstWord = s.trim().split(/\s+/)[0];
                return firstWord ? firstWord.toLowerCase() : '';
            }).filter(w => w.length > 0);
            if (starters.length >= 3) {
                const starterCounts = {};
                starters.forEach(s => { starterCounts[s] = (starterCounts[s] || 0) + 1; });
                const maxRepeat = Math.max(...Object.values(starterCounts));
                const repeatRatio = maxRepeat / starters.length;
                if (repeatRatio >= 0.5 && maxRepeat >= 3) {
                    score += 1.5;
                    reasons.push("Repetitive Sentence Starters [+1.5]");
                }
            }
        }

        // CHECK 16: Hedging / qualifying language density
        const hedgingPhrases = [
            "it depends", "it varies", "to some extent", "in some cases",
            "it may", "it might", "it could", "it is possible",
            "there are many", "there are several", "there are various",
            "while it", "although it", "on one hand", "on the other",
            "depending on", "this may vary", "results may vary",
            "keep in mind", "bear in mind", "worth considering",
            "it is worth mentioning", "it should be mentioned"
        ];
        const hedgingCount = hedgingPhrases.filter(phrase => lowerText.includes(phrase)).length;
        if (hedgingCount >= 2) {
            const points = Math.min(hedgingCount * 0.7, 2.8);
            score += points;
            reasons.push(`Hedging Language Density [+${points.toFixed(1)}]`);
        }

        // CHECK 17: Word-level entropy analysis
        if (wordCount >= 40) {
            const wordFreq = {};
            words.forEach(w => { wordFreq[w] = (wordFreq[w] || 0) + 1; });
            let entropy = 0;
            const total = words.length;
            Object.values(wordFreq).forEach(count => {
                const p = count / total;
                if (p > 0) entropy -= p * Math.log2(p);
            });
            const maxEntropy = Math.log2(total);
            const normalizedEntropy = maxEntropy > 0 ? entropy / maxEntropy : 1;
            if (normalizedEntropy < 0.75) {
                score += 1.0;
                reasons.push("Low Word Entropy [+1.0]");
            }
        }

        // CHECK 18: Discourse connective overuse
        const discourseConnectives = [
            "however", "therefore", "thus", "hence", "consequently",
            "additionally", "similarly", "specifically", "notably",
            "accordingly", "meanwhile", "nonetheless", "conversely",
            "subsequently", "alternatively", "likewise"
        ];
        let connectiveCount = 0;
        discourseConnectives.forEach(conn => {
            const regex = new RegExp('\\b' + conn + '\\b', 'gi');
            const matches = lowerText.match(regex);
            if (matches) connectiveCount += matches.length;
        });
        if (wordCount >= 40 && connectiveCount / wordCount > 0.02) {
            const points = Math.min(connectiveCount * 0.5, 2.0);
            score += points;
            reasons.push(`Discourse Connective Overuse [+${points.toFixed(1)}]`);
        }

        // CHECK 19: Predictable paragraph structure (intro → body → conclusion)
        if (paragraphCount >= 3 && wordCount >= 60) {
            const hasIntroPattern = /^(in this|this (post|article|comment|response)|let me|i'?d like to|here('?s| is)|allow me)/i.test(text.trim());
            const hasConclusionPattern = /(in conclusion|to summarize|overall|in summary|to sum up|all in all|in the end)\s/i.test(lowerText);
            if (hasIntroPattern && hasConclusionPattern) {
                score += 1.5;
                reasons.push("Predictable Structure (Intro/Conclusion) [+1.5]");
            }
        }

        return { score: Math.max(0, score), reasons };
    }

    function computeUsernameBotScore(username) {
        let score = 0;
        suspiciousUserPatterns.forEach(pattern => { if (pattern.test(username)) score += 1.5; });
        const digits = username.match(/\d/g);
        if (digits && (digits.length / username.length) > 0.4) score += 0.8;
        return score;
    }

    function computeBotScore(elem) {
        let score = 0;
        const username = extractUsername(elem);
        if (username) {
            score += computeUsernameBotScore(username);
        }
        const textContent = getDeepTextContent(elem).toLowerCase().replace(/\s+/g, ' ').trim();
        if (genericResponses.includes(textContent) && textContent.length < 30) score += 1.5;
        const links = queryDeepAll(elem, 'a');
        links.forEach(link => {
            if (scamLinkRegex.test(link.href)) score += 3.0;
        });
        return score;
    }

    /************************************
     * 6. UI MANAGEMENT & POPUP
     ************************************/
    function createPopupAndTooltip() {
        const popup = document.createElement("div");
        popup.id = "botCounterPopup";
        popup.innerHTML = `
            <div id="botPopupHeader">
                <span>🔍 Detected bot/AI: 0</span>
                <span id="settingsIcon" title="Settings">⚙️</span>
            </div>
            <div id="settingsPanel">
                <label>AI Threshold: <input type="number" id="aiThresholdInput" step="0.1" min="0.1"></label>
                <label>Bot Threshold: <input type="number" id="botThresholdInput" step="0.1" min="0.1"></label>
                <button id="saveSettingsBtn">Save</button>
            </div>
            <div id="botDropdown"></div>`;
        document.body.appendChild(popup);
        document.getElementById("aiThresholdInput").value  = AI_THRESHOLD;
        document.getElementById("botThresholdInput").value = BOT_THRESHOLD;

        const tooltip = document.createElement("div");
        tooltip.id = "aiScoreTooltip";
        document.body.appendChild(tooltip);

        document.getElementById("botPopupHeader").addEventListener("click", e => {
            if (e.target.id === "settingsIcon") {
                e.stopPropagation();
                const panel = document.getElementById("settingsPanel");
                panel.style.display = panel.style.display === "block" ? "none" : "block";
            } else {
                const dropdown = document.getElementById("botDropdown");
                dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
                if (dropdown.style.display === 'none') {
                    document.getElementById('settingsPanel').style.display = 'none';
                }
            }
        });

        document.getElementById("saveSettingsBtn").addEventListener("click", e => {
            e.stopPropagation();
            const aiVal  = Math.max(0.1, parseFloat(document.getElementById("aiThresholdInput").value) || DEFAULT_AI_THRESHOLD);
            const botVal = Math.max(0.1, parseFloat(document.getElementById("botThresholdInput").value) || DEFAULT_BOT_THRESHOLD);
            saveSettings(aiVal, botVal);
            e.target.innerText = "Saved!";
            setTimeout(() => { e.target.innerText = "Save"; }, 1500);
        });

        document.body.addEventListener('mouseover', e => {
            const flaggedElem = e.target.closest('[data-bot-detected="true"]');
            if (flaggedElem) {
                let aiReasons = [];
                try { aiReasons = JSON.parse(flaggedElem.dataset.aiReasons || '[]'); } catch (_) { /* ignore corrupt data */ }
                const reasonsHTML = aiReasons.map(r => `<li>${escapeHTML(String(r))}</li>`).join('');
                const botScore = parseFloat(flaggedElem.dataset.botScore).toFixed(1);
                const aiScore  = parseFloat(flaggedElem.dataset.aiScore).toFixed(1);
                tooltip.innerHTML = `<strong>Bot Score:</strong> ${escapeHTML(botScore)} / ${escapeHTML(String(BOT_THRESHOLD))}<br><strong>AI Score:</strong> ${escapeHTML(aiScore)} / ${escapeHTML(String(AI_THRESHOLD))}<ul>${reasonsHTML}</ul>`;
                tooltip.style.display = 'block';
            }
        });
        document.body.addEventListener('mouseout',  () => { tooltip.style.display = 'none'; });
        document.body.addEventListener('mousemove', e => {
            if (tooltip.style.display === 'block') {
                tooltip.style.left = `${e.pageX + 15}px`;
                tooltip.style.top  = `${e.pageY + 15}px`;
            }
        });
    }

    function updatePopup() {
        const headerSpan = document.querySelector("#botPopupHeader > span:first-child");
        if (headerSpan) {
            headerSpan.textContent = `🔍 Detected bot/AI: ${botCount}`;
        }
        const dropdown = document.getElementById("botDropdown");
        if (!dropdown) return;
        dropdown.innerHTML = "";
        if (detectedBots.length === 0) {
            dropdown.innerHTML = `<span style="padding:6px 14px;color:#777;font-style:italic;display:block;">No bots/AI detected yet.</span>`;
        } else {
            detectedBots
                .slice()
                .sort((a, b) => b.aiScore - a.aiScore || b.botScore - a.botScore)
                .forEach(item => {
                    const link = document.createElement("a");
                    link.href = "#" + item.elemID;
                    link.textContent = `${item.username} (${item.reason})`;
                    link.title = `Bot Score: ${item.botScore.toFixed(1)}, AI Score: ${item.aiScore.toFixed(1)}`;
                    link.addEventListener('click', e => {
                        e.preventDefault();
                        const targetElem = document.getElementById(item.elemID);
                        if (targetElem) {
                            /* Expand any collapsed parent comment threads */
                            let parent = targetElem.parentElement;
                            while (parent) {
                                if (parent.tagName && parent.tagName.toLowerCase() === 'details' && !parent.open) {
                                    parent.open = true;
                                }
                                const moreBtn = parent.querySelector('[id*="morechildren"], button[data-testid="comment-more-children"]');
                                if (moreBtn) { try { moreBtn.click(); } catch (_) { /* ignore click errors */ } }
                                parent = parent.parentElement;
                            }
                            targetElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            /* Flash highlight to draw attention */
                            targetElem.style.transition = 'box-shadow 0.3s ease-in-out';
                            targetElem.style.boxShadow = '0 0 0 4px rgba(255, 69, 0, 0.7), 0 0 20px rgba(255, 69, 0, 0.4)';
                            setTimeout(() => {
                                targetElem.style.boxShadow = '';
                                setTimeout(() => { targetElem.style.transition = ''; }, 300);
                            }, 2000);
                        }
                    });
                    dropdown.appendChild(link);
                });
        }
    }

    /************************************
     * 7. CORE DETECTION LOGIC
     ************************************/
    function getTextToAnalyze(elem) {
        const tag = elem.tagName ? elem.tagName.toLowerCase() : '';
        let textToAnalyze = '';
        let paragraphCount = 0;

        /*
         * New Reddit structures:
         * - shreddit-comment: may have shadow DOM with comment body inside
         * - shreddit-post: has post body text, sometimes in shadow root
         * - Standard div containers with .md or .usertext-body
         */
        if (tag === 'shreddit-comment' || tag === 'shreddit-post') {
            /* Try shadow root first */
            if (elem.shadowRoot) {
                const paras = elem.shadowRoot.querySelectorAll('p');
                if (paras.length > 0) {
                    textToAnalyze = Array.from(paras).map(p => p.textContent).join('\n\n');
                    paragraphCount = paras.length;
                } else {
                    textToAnalyze = getDeepTextContent(elem.shadowRoot);
                    paragraphCount = textToAnalyze.split(/\n\s*\n/).filter(l => l.trim().length > 10).length;
                }
            }
            /* Also try slotted content / light DOM */
            if (!textToAnalyze.trim()) {
                const slotContent = elem.querySelector('[slot="comment"], [slot="text-body"], .md, .RichTextJSON-root');
                if (slotContent) {
                    const paras = slotContent.querySelectorAll('p');
                    if (paras.length > 0) {
                        textToAnalyze = Array.from(paras).map(p => p.textContent).join('\n\n');
                        paragraphCount = paras.length;
                    } else {
                        textToAnalyze = slotContent.innerText || slotContent.textContent || '';
                        paragraphCount = textToAnalyze.split(/\n\s*\n/).filter(l => l.trim().length > 10).length;
                    }
                }
            }
            /* Fallback to deep text */
            if (!textToAnalyze.trim()) {
                textToAnalyze = getDeepTextContent(elem);
                paragraphCount = textToAnalyze.split(/\n\s*\n/).filter(l => l.trim().length > 10).length;
            }
        } else {
            /* Standard old Reddit-style containers */
            const commentBody = elem.querySelector('div[data-testid="comment"] > div:nth-child(2) > div');
            if (commentBody && commentBody.querySelectorAll('p').length > 0) {
                const paragraphs = Array.from(commentBody.querySelectorAll('p'));
                textToAnalyze = paragraphs.map(p => p.innerText).join('\n\n');
                paragraphCount = paragraphs.length;
            } else {
                const contentDiv = elem.querySelector('.md, .usertext-body, .RichTextJSON-root');
                textToAnalyze = contentDiv ? contentDiv.innerText : (elem.innerText || '');
                paragraphCount = textToAnalyze.split(/\n\s*\n/).filter(line => line.trim().length > 10).length;
            }
        }

        return { textToAnalyze, paragraphCount };
    }

    function highlightIfSuspected(elem) {
        if (isNavigating) return;
        if (elem.getAttribute("data-bot-detected")) return;

        /* Skip elements that are inside a shreddit-post or shreddit-comment to
           avoid duplicate detections – the parent shreddit element will be
           scanned separately and carries the author attribute. */
        const tag = elem.tagName ? elem.tagName.toLowerCase() : '';
        if (tag !== 'shreddit-post' && tag !== 'shreddit-comment') {
            if (elem.closest('shreddit-post, shreddit-comment')) {
                return;
            }
            /* Also skip if we are inside a shadow root hosted by a shreddit element */
            const rootNode = elem.getRootNode();
            if (rootNode && rootNode.host) {
                const hostTag = rootNode.host.tagName ? rootNode.host.tagName.toLowerCase() : '';
                if (hostTag === 'shreddit-post' || hostTag === 'shreddit-comment') {
                    return;
                }
            }
        }

        const { textToAnalyze, paragraphCount } = getTextToAnalyze(elem);
        if (!textToAnalyze.trim()) return;

        const aiResult = computeAIScore(textToAnalyze, paragraphCount);
        const aiScore  = aiResult.score;
        const botScore = computeBotScore(elem);

        const botFlag = botScore >= BOT_THRESHOLD;
        const aiFlag  = aiScore  >= AI_THRESHOLD;

        if (botFlag || aiFlag) {
            elem.setAttribute("data-bot-detected", "true");
            let reason = "";

            if (botFlag && aiFlag) {
                elem.classList.add("botAndAiContentDetected");
                reason = "Bot & AI";
            } else if (aiFlag) {
                if (aiScore >= AI_THRESHOLD + CONFIDENCE_HIGH_TIER) {
                    elem.classList.add("aiContentHigh");
                    reason = "AI (High Conf)";
                } else if (aiScore >= AI_THRESHOLD + CONFIDENCE_MID_TIER) {
                    elem.classList.add("aiContentMid");
                    reason = "AI (Mid Conf)";
                } else {
                    elem.classList.add("aiContentLow");
                    reason = "AI (Low Conf)";
                }
            } else {
                reason = "Bot";
            }

            if (botFlag) {
                /* For shreddit elements, try to style the username within the element */
                const usernameElem = queryDeep(elem, USERNAME_SELECTORS);
                if (usernameElem) {
                    usernameElem.classList.add("botUsername");
                }
            }

            elem.dataset.aiScore   = aiScore.toFixed(2);
            elem.dataset.botScore  = botScore.toFixed(2);
            elem.dataset.aiReasons = JSON.stringify(aiResult.reasons);

            botCount++;
            detectionIndex++;
            const generatedID = "reddeye-detected-" + detectionIndex;
            if (!elem.id) elem.setAttribute("id", generatedID);
            const elemID   = elem.id;
            const username = extractUsername(elem) || "Unknown";

            detectedBots.push({ username, elemID, reason, botScore, aiScore });
            updatePopup();
        }
    }

    /************************************
     * 8. SCANNING FUNCTIONS (New Reddit)
     ************************************/
    function debounce(fn, delay) {
        let timer;
        return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
    }

    function scanForBots(root) {
        root = root || document;
        const query = CONTENT_SELECTORS.map(s => `${s}:not([data-bot-detected])`).join(', ');
        const candidates = root.querySelectorAll(query);
        candidates.forEach(highlightIfSuspected);

        /* Also look for shreddit elements with author attributes */
        const shredditPosts = root.querySelectorAll('shreddit-post[author]:not([data-bot-detected])');
        shredditPosts.forEach(highlightIfSuspected);
        const shredditComments = root.querySelectorAll('shreddit-comment[author]:not([data-bot-detected])');
        shredditComments.forEach(highlightIfSuspected);

        /* Traverse shadow roots for nested content */
        const allElements = root.querySelectorAll('*');
        for (const el of allElements) {
            if (el.shadowRoot && !el.getAttribute('data-reddeye-shadow-scanned')) {
                el.setAttribute('data-reddeye-shadow-scanned', 'true');
                scanForBots(el.shadowRoot);

                /* Observe mutations within shadow roots */
                const shadowObserver = new MutationObserver(mutations => {
                    for (const mutation of mutations) {
                        for (const node of mutation.addedNodes) {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                scheduleScan();
                                return;
                            }
                        }
                    }
                });
                shadowObserver.observe(el.shadowRoot, { childList: true, subtree: true });
            }
        }
    }

    /**
     * Performs a full-thread deep scan.
     * Looks for "load more comments" / "continue thread" buttons
     * and scans all currently loaded content across the page.
     */
    function fullThreadScan() {
        /* Scan the full document body – not just visible viewport */
        scanForBots(document.body);

        /* Detect and scan inside iframes that Reddit may use for embedded content */
        const iframes = document.querySelectorAll('iframe[src*="reddit.com"]');
        iframes.forEach(iframe => {
            try {
                if (iframe.contentDocument && iframe.contentDocument.body) {
                    scanForBots(iframe.contentDocument.body);
                }
            } catch (_) { /* cross-origin – ignore */ }
        });
    }

    /************************************
     * 9. INITIALIZATION & OBSERVATION
     ************************************/
    let scheduleScan;
    let navigationTimer = null;

    /** Reset detection state and widget when Reddit SPA-navigates to a new page. */
    function resetDetectionState() {
        isNavigating = true;
        botCount = 0;
        detectedBots = [];
        detectionIndex = 0;
        document.querySelectorAll('[data-bot-detected]').forEach(el => {
            el.removeAttribute('data-bot-detected');
            el.classList.remove('botAndAiContentDetected', 'aiContentLow', 'aiContentMid', 'aiContentHigh');
            delete el.dataset.aiScore;
            delete el.dataset.botScore;
            delete el.dataset.aiReasons;
        });
        document.querySelectorAll('.botUsername').forEach(el => el.classList.remove('botUsername'));
        /* Also clear shadow-scanned markers so shadow roots are re-scanned */
        document.querySelectorAll('[data-reddeye-shadow-scanned]').forEach(el => {
            el.removeAttribute('data-reddeye-shadow-scanned');
        });
        updatePopup();
    }

    /**
     * Monitor SPA navigation.  Reddit uses History API pushState/replaceState
     * to navigate without full page reloads.
     *
     * Content scripts run in a separate JavaScript context from the page, so
     * overriding history.pushState / replaceState here does NOT intercept
     * calls made by Reddit's own code.  Instead we poll location.href on a
     * short interval to reliably detect every SPA navigation.  The popstate
     * listener provides immediate detection for Back / Forward actions.
     */
    function monitorNavigation(onNavigate) {
        let lastURL = location.href;
        const handleURLChange = () => {
            if (location.href !== lastURL) {
                lastURL = location.href;
                onNavigate();
            }
        };

        /* popstate fires on Back / Forward navigation */
        window.addEventListener('popstate', handleURLChange);

        /* Poll for URL changes caused by pushState / replaceState */
        setInterval(handleURLChange, 200);
    }

    loadSettings(() => {
        createPopupAndTooltip();

        /* Initial full-thread scan after page settles */
        setTimeout(() => fullThreadScan(), 1500);

        scheduleScan = debounce(() => fullThreadScan(), 150);

        /* Observe the entire document for new content (lazy-loaded comments, "load more", etc.) */
        const observer = new MutationObserver(mutations => {
            if (mutations.some(m => Array.from(m.addedNodes).some(n => n.nodeType === Node.ELEMENT_NODE))) {
                scheduleScan();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        /* Periodic re-scan to catch dynamically rendered content (e.g., virtual scrolling) */
        const unscannedSelector = CONTENT_SELECTORS.map(s => `${s}:not([data-bot-detected])`).join(', ');
        setInterval(() => {
            if (document.querySelectorAll(unscannedSelector).length > 0) {
                fullThreadScan();
            }
        }, 5000);

        monitorNavigation(() => {
            resetDetectionState();
            clearTimeout(navigationTimer);
            navigationTimer = setTimeout(() => {
                isNavigating = false;
                fullThreadScan();
            }, 1500);
        });
    });
})();
