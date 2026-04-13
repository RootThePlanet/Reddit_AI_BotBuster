/*
 Redd-Eye – Firefox WebExtension content script.
 Version 5.1.0 – Supports both www.reddit.com and old.reddit.com.
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
            right: 16px;
            width: 280px;
            z-index: 99999;
            background: rgba(18, 18, 22, 0.85);
            backdrop-filter: blur(16px) saturate(1.4);
            -webkit-backdrop-filter: blur(16px) saturate(1.4);
            border-radius: 14px;
            box-shadow: 0 4px 24px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.06);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            font-size: 13px;
            color: #e0e0e0;
            border: none;
            user-select: none;
            transition: opacity 0.25s ease, transform 0.25s ease;
            opacity: 0.75;
        }
        #botCounterPopup:hover { opacity: 1 !important; transform: translateY(-2px); }

        #botPopupHeader {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-weight: 600;
            padding: 10px 14px;
            cursor: pointer;
            border-bottom: 1px solid rgba(255,255,255,0.06);
            letter-spacing: 0.2px;
            font-size: 12px;
        }
        #botPopupHeader span:first-child {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        #botPopupHeader .reddeye-logo {
            width: 16px;
            height: 16px;
            border-radius: 3px;
        }
        #settingsIcon {
            cursor: pointer;
            font-size: 14px;
            opacity: 0.5;
            transition: opacity 0.2s ease;
        }
        #settingsIcon:hover { opacity: 1; }
        #settingsPanel {
            display: none;
            padding: 10px 14px;
            border-top: 1px solid rgba(255,255,255,0.06);
            background: rgba(0,0,0,0.15);
        }
        #settingsPanel label {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 5px 0;
            font-size: 11px;
            color: #999;
        }
        #settingsPanel input {
            width: 55px;
            margin-left: 8px;
            padding: 3px 6px;
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 5px;
            background: rgba(255,255,255,0.06);
            color: #e0e0e0;
            font-size: 11px;
        }
        #saveSettingsBtn {
            background: linear-gradient(135deg, #ff4500, #ff6a33);
            color: white;
            border: none;
            border-radius: 6px;
            padding: 5px 12px;
            cursor: pointer;
            margin-top: 6px;
            font-size: 11px;
            font-weight: 600;
            width: 100%;
            transition: filter 0.15s;
        }
        #saveSettingsBtn:hover { filter: brightness(1.1); }

        #botDropdown {
            display: none;
            max-height: 220px;
            overflow-y: auto;
            padding: 2px 0;
            scrollbar-width: thin;
            scrollbar-color: rgba(255,255,255,0.12) transparent;
        }
        #botDropdown a {
            display: block;
            padding: 5px 14px;
            text-decoration: none;
            color: #b0b0b0;
            font-size: 11px;
            transition: background-color 0.15s ease, color 0.15s ease;
        }
        #botDropdown a:hover { background-color: rgba(255,255,255,0.05); color: #fff; }

        #aiScoreTooltip {
            position: fixed;
            display: none;
            background: rgba(12, 12, 16, 0.95);
            color: #e8e8e8;
            border-radius: 10px;
            padding: 10px 12px;
            font-size: 11px;
            z-index: 100000;
            max-width: 300px;
            pointer-events: none;
            box-shadow: 0 4px 20px rgba(0,0,0,0.4);
            border: 1px solid rgba(255,255,255,0.08);
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

    /* Detect which Reddit variant we are running on */
    const isOldReddit = location.hostname === 'old.reddit.com';

    /* DOM selectors covering both new Reddit (www) and old Reddit (old) */
    const CONTENT_SELECTORS = isOldReddit
        ? [
            'div.comment',
            'div.link'
          ]
        : [
            'shreddit-post',
            'shreddit-comment',
            'article[data-testid]',
            '[data-testid="post-container"]',
            '[data-testid="comment"]'
          ];
    const USERNAME_SELECTORS = [
        'a.author',
        'a[href*="/user/"]',
        'a[href*="/u/"]',
        /* New Reddit uses <span slot="authorName"> inside shreddit-comment shadow DOM */
        'span[slot="authorName"]'
    ].join(', ');

    let botCount = 0;
    let detectedBots = [];
    let detectionIndex = 0;
    let isNavigating = false;
    const flaggedElements = new WeakSet();
    let ui = null;

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

    function renderPopupCount(headerSpan, count) {
        const strong = document.createElement('strong');
        strong.textContent = String(count);
        headerSpan.replaceChildren(
            document.createTextNode('🛡️ Redd-Eye: '),
            strong,
            document.createTextNode(' detected')
        );
    }

    function renderEmptyDropdown(dropdown) {
        const emptyState = document.createElement('span');
        emptyState.style.padding = '6px 14px';
        emptyState.style.color = '#777';
        emptyState.style.fontStyle = 'italic';
        emptyState.style.display = 'block';
        emptyState.textContent = 'No bots/AI detected yet.';
        dropdown.replaceChildren(emptyState);
    }

    function renderTooltipContent(tooltip, botScore, aiScore, aiReasons) {
        const botLabel = document.createElement('strong');
        botLabel.textContent = 'Bot Score:';
        const aiLabel = document.createElement('strong');
        aiLabel.textContent = 'AI Score:';
        const reasonList = document.createElement('ul');

        tooltip.replaceChildren(
            botLabel,
            document.createTextNode(` ${botScore} / ${String(BOT_THRESHOLD)}`),
            document.createElement('br'),
            aiLabel,
            document.createTextNode(` ${aiScore} / ${String(AI_THRESHOLD)}`),
            reasonList
        );

        aiReasons.forEach(reason => {
            const item = document.createElement('li');
            item.textContent = String(reason);
            reasonList.appendChild(item);
        });
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
                /* Skip non-content elements – style/script text would pollute
                   AI scoring (e.g. CSS injected by Dark Reader into shadow roots) */
                const tag = child.tagName.toLowerCase();
                if (tag === 'style' || tag === 'script' || tag === 'noscript') continue;
                text += getDeepTextContent(child);
            }
        }
        return text;
    }

    /**
     * Extract text from the LIGHT DOM only (no shadow DOM traversal).
     * This avoids pulling in UI chrome (buttons, vote counts, etc.)
     * from shadow roots of shreddit web components.
     */
    function getLightDOMTextContent(elem) {
        if (!elem) return '';
        let text = '';
        for (const child of elem.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) {
                text += child.textContent;
            } else if (child.nodeType === Node.ELEMENT_NODE) {
                const tag = child.tagName.toLowerCase();
                if (tag === 'style' || tag === 'script' || tag === 'noscript') continue;
                /* Don't descend into other shreddit components (nested comments) */
                if (tag === 'shreddit-comment' || tag === 'shreddit-comment-tree') continue;
                text += getLightDOMTextContent(child);
            }
        }
        return text;
    }

    /**
     * Extract username from a Reddit comment or post element.
     * Handles both old Reddit (data-author attribute, a.author links) and
     * new Reddit (shreddit-post[author], shreddit-comment[author], shadow DOM).
     */
    function extractUsername(elem) {
        /* On old Reddit, the data-author attribute on div.comment / div.link
           is the most reliable source and should be checked first. */
        if (elem.hasAttribute('data-author')) {
            return elem.getAttribute('data-author');
        }

        /* Try the author attribute on shreddit elements (new Reddit) */
        const tag = elem.tagName ? elem.tagName.toLowerCase() : '';
        if ((tag === 'shreddit-post' || tag === 'shreddit-comment') && elem.hasAttribute('author')) {
            return elem.getAttribute('author');
        }

        /* Try standard selectors (a.author for old Reddit, various for new Reddit) */
        const userElem = queryDeep(elem, USERNAME_SELECTORS);
        if (userElem) {
            const text = userElem.textContent.trim().replace(/^u\//, '');
            if (text) return text;
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

        // CHECK 20: Sentence Complexity Coefficient of Variation
        // Modern LLMs exhibit "Perplexity Inversion": uniformly low complexity per
        // sentence while simulating burstiness via varied sentence lengths. A low
        // coefficient of variation in syllables-per-word across sentences signals
        // machine-generated text.
        if (sentencesArr.length >= 4) {
            const sentenceComplexities = sentencesArr.map(s => {
                const sWords = s.split(/\s+/).filter(w => w.length > 0);
                if (sWords.length === 0) return 0;
                const totalSyllables = sWords.reduce((acc, w) => acc + countSyllables(w), 0);
                return totalSyllables / sWords.length;
            }).filter(c => c > 0);
            if (sentenceComplexities.length >= 4) {
                const avgComplexity = sentenceComplexities.reduce((a, b) => a + b, 0) / sentenceComplexities.length;
                if (avgComplexity > 0) {
                    const complexityVariance = sentenceComplexities.reduce((a, b) => a + Math.pow(b - avgComplexity, 2), 0) / sentenceComplexities.length;
                    const complexityStdDev = Math.sqrt(complexityVariance);
                    const complexityCoV = complexityStdDev / avgComplexity;
                    if (complexityCoV < 0.10) {
                        score += 1.3;
                        reasons.push("Low Complexity CoV (Perplexity Inversion) [+1.3]");
                    }
                }
            }
        }

        // CHECK 21: AI Phrase Density
        // Rather than only counting raw formulaic phrases, normalise against text
        // length.  A high density of AI-characteristic phrases per 100 words is a
        // stronger signal than raw count alone.
        if (wordCount >= 40) {
            const densityPhrases = [
                "in conclusion", "furthermore", "moreover", "on the other hand",
                "it is important to note", "ultimately", "in summary",
                "it should be noted", "that being said", "needless to say",
                "at the end of the day", "first and foremost", "last but not least",
                "to summarize", "it goes without saying", "in today's world",
                "hope this helps", "feel free to ask", "happy to help",
                "it is crucial to", "it is essential to", "it is vital to",
                "research suggests", "studies show", "it is well-known"
            ];
            let densityHits = 0;
            densityPhrases.forEach(phrase => { if (lowerText.includes(phrase)) densityHits++; });
            const phraseDensity = (densityHits / wordCount) * 100;
            if (phraseDensity > 3.0) {
                const points = Math.min(phraseDensity * 0.4, 2.5);
                score += points;
                reasons.push(`High AI Phrase Density [+${points.toFixed(1)}]`);
            }
        }

        // CHECK 22: Hapax Legomena Ratio
        // The ratio of words that appear exactly once (hapax legomena) to total
        // unique words.  Human writing produces more unique, one-off word choices;
        // AI tends to reuse vocabulary more systematically.
        if (wordCount >= 50) {
            const hapaxFreq = {};
            words.forEach(w => { hapaxFreq[w] = (hapaxFreq[w] || 0) + 1; });
            const uniqueWordCount = Object.keys(hapaxFreq).length;
            const hapaxCount = Object.values(hapaxFreq).filter(c => c === 1).length;
            if (uniqueWordCount > 0) {
                const hapaxRatio = hapaxCount / uniqueWordCount;
                if (hapaxRatio < 0.4) {
                    score += 1.0;
                    reasons.push("Low Hapax Legomena Ratio [+1.0]");
                }
            }
        }

        // CHECK 23: Function Word Distribution
        // AI text exhibits unnaturally uniform distribution of common function
        // words (articles, prepositions, auxiliaries).  We measure the standard
        // deviation of their frequencies — very low deviation suggests generation.
        if (wordCount >= 60) {
            const functionWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'to', 'of', 'in', 'for', 'and', 'that', 'this', 'with', 'on', 'it', 'be', 'as', 'by'];
            const fwCounts = functionWords.map(fw => {
                let count = 0;
                words.forEach(w => { if (w === fw) count++; });
                return count;
            });
            const presentFW = fwCounts.filter(c => c > 0);
            if (presentFW.length >= 5) {
                const fwAvg = presentFW.reduce((a, b) => a + b, 0) / presentFW.length;
                if (fwAvg > 0) {
                    const fwVariance = presentFW.reduce((a, b) => a + Math.pow(b - fwAvg, 2), 0) / presentFW.length;
                    const fwStdDev = Math.sqrt(fwVariance);
                    const fwCoV = fwStdDev / fwAvg;
                    if (fwCoV < 0.35) {
                        score += 1.0;
                        reasons.push("Uniform Function Word Distribution [+1.0]");
                    }
                }
            }
        }

        // CHECK 24: Punctuation Pattern Regularity
        // AI tends to use very regular punctuation — e.g. commas and periods at
        // consistent rates across sentences.  We check the coefficient of
        // variation of per-sentence punctuation counts.
        if (sentencesArr.length >= 4) {
            const punctPerSentence = sentencesArr.map(s => {
                const punctMatches = s.match(/[,;:—\-()]/g);
                return punctMatches ? punctMatches.length : 0;
            });
            const punctAvg = punctPerSentence.reduce((a, b) => a + b, 0) / punctPerSentence.length;
            if (punctAvg > 0.5) {
                const punctVariance = punctPerSentence.reduce((a, b) => a + Math.pow(b - punctAvg, 2), 0) / punctPerSentence.length;
                const punctStdDev = Math.sqrt(punctVariance);
                const punctCoV = punctStdDev / punctAvg;
                if (punctCoV < 0.3) {
                    score += 1.0;
                    reasons.push("Regular Punctuation Patterns [+1.0]");
                }
            }
        }

        // CHECK 25: Average Word Length Consistency
        // AI-generated text produces sentences with very consistent average word
        // lengths.  Human text naturally varies more in word-length distribution
        // across sentences.
        if (sentencesArr.length >= 4) {
            const sentenceAvgWordLengths = sentencesArr.map(s => {
                const sWords = s.split(/\s+/).filter(w => w.length > 0);
                if (sWords.length === 0) return 0;
                return sWords.reduce((acc, w) => acc + w.length, 0) / sWords.length;
            }).filter(l => l > 0);
            if (sentenceAvgWordLengths.length >= 4) {
                const avgWL = sentenceAvgWordLengths.reduce((a, b) => a + b, 0) / sentenceAvgWordLengths.length;
                if (avgWL > 0) {
                    const wlVariance = sentenceAvgWordLengths.reduce((a, b) => a + Math.pow(b - avgWL, 2), 0) / sentenceAvgWordLengths.length;
                    const wlStdDev = Math.sqrt(wlVariance);
                    const wlCoV = wlStdDev / avgWL;
                    if (wlCoV < 0.08) {
                        score += 1.2;
                        reasons.push("Uniform Word Length Distribution [+1.2]");
                    }
                }
            }
        }

        // CHECK 26: Semantic Coherence via Lexical Overlap
        // AI-generated text maintains unnaturally consistent topic vocabulary
        // across sentence pairs.  We measure average Jaccard similarity of
        // content-word sets between consecutive sentences.
        if (sentencesArr.length >= 4) {
            const stopWords = new Set(['the','a','an','is','are','was','were','to','of','in','for','and','that','this','with','on','it','be','as','by','or','but','not','at','from','has','have','had','will','would','can','could','do','does','did','i','you','he','she','we','they','my','your','his','her','its','our','their','me','him','us','them','so','if','no','up','out','just','then','than','now','also','very','much','more','most','all','any','each','some','into','over','such','only','own','about','been','other','which','when','what','how','who','may','should','shall','must']);
            const sentenceContentWords = sentencesArr.map(s => {
                const sWords = s.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w.replace(/[^a-z]/g, '')));
                return new Set(sWords.map(w => w.replace(/[^a-z]/g, '')).filter(w => w.length > 0));
            }).filter(s => s.size > 0);
            if (sentenceContentWords.length >= 3) {
                let totalJaccard = 0;
                let pairCount = 0;
                for (let i = 0; i < sentenceContentWords.length - 1; i++) {
                    const setA = sentenceContentWords[i];
                    const setB = sentenceContentWords[i + 1];
                    let intersection = 0;
                    setA.forEach(w => { if (setB.has(w)) intersection++; });
                    const union = setA.size + setB.size - intersection;
                    if (union > 0) {
                        totalJaccard += intersection / union;
                        pairCount++;
                    }
                }
                if (pairCount > 0) {
                    const avgJaccard = totalJaccard / pairCount;
                    if (avgJaccard > 0.35) {
                        const points = Math.min((avgJaccard - 0.35) * 5, 2.0);
                        score += points;
                        reasons.push(`High Lexical Cohesion [+${points.toFixed(1)}]`);
                    }
                }
            }
        }

        return { score: Math.max(0, score), reasons };
    }

    const AI_IMAGE_TOOL_SCORE = 1.8;
    const AI_IMAGE_TOOL_SCORE_CAP = 4.5;
    /*
     * Keep image-only scoring on the same 0-10 scale used for strong text
     * signals (e.g. self-disclosure returns 10), then combine with text score.
     */
    const MAX_IMAGE_AI_SCORE = 10;
    const AI_IMAGE_HOST_HINTS = [
        'midjourney', 'openart', 'lexica', 'civitai', 'playgroundai',
        'mage.space', 'leonardo.ai', 'stability.ai', 'dreamstudio'
    ];

    function getCandidateContentImages(elem) {
        const images = isOldReddit
            ? Array.from(elem.querySelectorAll('img'))
            : queryDeepAll(elem, 'img');

        return images.filter(img => {
            const src = img.currentSrc || img.src || '';
            if (!src || src.startsWith('data:')) return false;

            const alt = (img.alt || '').toLowerCase();
            const title = (img.title || '').toLowerCase();
            const combined = `${alt} ${title}`;
            if (/(avatar|profile|community icon|emoji|award icon|icon)/.test(combined)) return false;

            const width = img.naturalWidth || img.width || 0;
            const height = img.naturalHeight || img.height || 0;
            if (width > 0 && height > 0 && (width < 120 || height < 120)) return false;

            return true;
        });
    }

    function computeAIImageScore(elem, fallbackText) {
        const reasons = [];
        const images = getCandidateContentImages(elem);
        if (images.length === 0) return { score: 0, reasons };

        const signalParts = [];
        if (fallbackText && fallbackText.trim()) signalParts.push(fallbackText);
        images.forEach(img => {
            signalParts.push(img.alt || '', img.title || '', img.currentSrc || img.src || '');
            const figure = img.closest('figure');
            if (figure) signalParts.push(figure.textContent || '');
        });

        const lowerSignals = signalParts.join(' ').toLowerCase();
        if (!lowerSignals.trim()) return { score: 0, reasons };

        let score = 0;

        if (/\b(ai[-\s]?generated|generated (with|by) ai|made (with|by) ai|synthetic image|text[-\s]?to[-\s]?image)\b/.test(lowerSignals)) {
            score += 7.0;
            reasons.push('Image marked as AI-generated [+7.0]');
        }

        const toolMatches = lowerSignals.match(/\b(midjourney|dall[\s-]?e(?:[\s-]?[23])?|stable diffusion|sdxl|flux|comfyui|automatic1111|invokeai|playground ai|leonardo ai|adobe firefly|imagen|chatgpt image)\b/g) || [];
        const uniqueTools = new Set(toolMatches.map(t => t.replace(/[\s-]+/g, '').trim()));
        if (uniqueTools.size > 0) {
            const points = Math.min(uniqueTools.size * AI_IMAGE_TOOL_SCORE, AI_IMAGE_TOOL_SCORE_CAP);
            score += points;
            reasons.push(`AI image tool markers [+${points.toFixed(1)}]`);
        }

        const hasAIImageHost = images.some(img => {
            const src = (img.currentSrc || img.src || '').toLowerCase();
            return AI_IMAGE_HOST_HINTS.some(hostHint => src.includes(hostHint));
        });
        if (hasAIImageHost) {
            score += 1.8;
            reasons.push('AI-image hosting URL pattern [+1.8]');
        }

        const hasGenerationParams = images.some(img => {
            const src = (img.currentSrc || img.src || '').toLowerCase();
            return /(prompt=|seed=|cfg(?:_scale)?=|steps=|sampler=|negative_prompt=)/.test(src);
        });
        if (hasGenerationParams) {
            score += 1.5;
            reasons.push('Image generation parameter pattern [+1.5]');
        }

        return { score: Math.max(0, Math.min(score, MAX_IMAGE_AI_SCORE)), reasons };
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
        /*
         * For old Reddit, scope text extraction to the direct .entry to avoid
         * pulling in nested child-comment text.  On new Reddit, use light-DOM
         * text to avoid shadow-DOM UI noise (vote counts, buttons, etc.).
         */
        let textContent;
        if (isOldReddit) {
            const entry = elem.querySelector(':scope > .entry');
            textContent = (entry || elem).textContent.toLowerCase().replace(/\s+/g, ' ').trim();
        } else {
            /* Try slot-based content first for clean text */
            let slotContent = null;
            for (const sel of NEW_REDDIT_CONTENT_SLOTS) {
                slotContent = elem.querySelector(sel);
                if (slotContent && slotContent.textContent.trim()) break;
                slotContent = null;
            }
            if (slotContent) {
                textContent = slotContent.textContent.toLowerCase().replace(/\s+/g, ' ').trim();
            } else {
                /* Use light DOM text to avoid shadow DOM UI noise */
                textContent = getLightDOMTextContent(elem).toLowerCase().replace(/\s+/g, ' ').trim();
                /* If light DOM is empty, try innerText as fallback */
                if (!textContent) {
                    textContent = (elem.innerText || '').toLowerCase().replace(/\s+/g, ' ').trim();
                }
            }
        }
        if (genericResponses.includes(textContent) && textContent.length < 30) score += 1.5;
        const links = isOldReddit
            ? Array.from(elem.querySelectorAll('a'))
            : queryDeepAll(elem, 'a');
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
        const header = document.createElement('div');
        header.id = 'botPopupHeader';
        const headerSpan = document.createElement('span');
        renderPopupCount(headerSpan, 0);
        const settingsIcon = document.createElement('span');
        settingsIcon.id = 'settingsIcon';
        settingsIcon.title = 'Settings';
        settingsIcon.textContent = '⚙';
        header.append(headerSpan, settingsIcon);

        const settingsPanel = document.createElement('div');
        settingsPanel.id = 'settingsPanel';

        const aiLabel = document.createElement('label');
        aiLabel.append(document.createTextNode('AI Threshold '));
        const aiThresholdInput = document.createElement('input');
        aiThresholdInput.type = 'number';
        aiThresholdInput.id = 'aiThresholdInput';
        aiThresholdInput.step = '0.1';
        aiThresholdInput.min = '0.1';
        aiLabel.appendChild(aiThresholdInput);

        const botLabel = document.createElement('label');
        botLabel.append(document.createTextNode('Bot Threshold '));
        const botThresholdInput = document.createElement('input');
        botThresholdInput.type = 'number';
        botThresholdInput.id = 'botThresholdInput';
        botThresholdInput.step = '0.1';
        botThresholdInput.min = '0.1';
        botLabel.appendChild(botThresholdInput);

        const saveSettingsBtn = document.createElement('button');
        saveSettingsBtn.id = 'saveSettingsBtn';
        saveSettingsBtn.textContent = 'Save';
        settingsPanel.append(aiLabel, botLabel, saveSettingsBtn);

        const dropdown = document.createElement('div');
        dropdown.id = 'botDropdown';
        popup.append(header, settingsPanel, dropdown);
        document.body.appendChild(popup);
        aiThresholdInput.value = AI_THRESHOLD;
        botThresholdInput.value = BOT_THRESHOLD;

        const tooltip = document.createElement("div");
        tooltip.id = "aiScoreTooltip";
        document.body.appendChild(tooltip);

        ui = {
            header,
            headerSpan,
            settingsIcon,
            settingsPanel,
            aiThresholdInput,
            botThresholdInput,
            saveSettingsBtn,
            dropdown,
            tooltip
        };

        header.addEventListener("click", e => {
            if (e.target === settingsIcon) {
                e.stopPropagation();
                settingsPanel.style.display = settingsPanel.style.display === "block" ? "none" : "block";
            } else {
                dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
                if (dropdown.style.display === 'none') {
                    settingsPanel.style.display = 'none';
                }
            }
        });

        saveSettingsBtn.addEventListener("click", e => {
            e.stopPropagation();
            const aiVal  = Math.max(0.1, parseFloat(aiThresholdInput.value) || DEFAULT_AI_THRESHOLD);
            const botVal = Math.max(0.1, parseFloat(botThresholdInput.value) || DEFAULT_BOT_THRESHOLD);
            saveSettings(aiVal, botVal);
            saveSettingsBtn.innerText = "Saved!";
            setTimeout(() => { saveSettingsBtn.innerText = "Save"; }, 1500);
        });

        document.body.addEventListener('mouseover', e => {
            const flaggedElem = e.target instanceof Element
                ? e.target.closest('[data-bot-detected="true"]')
                : null;
            if (!flaggedElem || !flaggedElements.has(flaggedElem)) return;

            let aiReasons = [];
            try {
                const parsedReasons = JSON.parse(flaggedElem.dataset.aiReasons || '[]');
                aiReasons = Array.isArray(parsedReasons) ? parsedReasons : [];
            } catch (_) { /* ignore corrupt data */ }

            const rawBotScore = parseFloat(flaggedElem.dataset.botScore);
            const rawAiScore = parseFloat(flaggedElem.dataset.aiScore);
            const botScore = Number.isFinite(rawBotScore) ? rawBotScore.toFixed(1) : 'N/A';
            const aiScore  = Number.isFinite(rawAiScore) ? rawAiScore.toFixed(1) : 'N/A';

            renderTooltipContent(tooltip, botScore, aiScore, aiReasons);
            tooltip.style.display = 'block';
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
        if (!ui) return;

        renderPopupCount(ui.headerSpan, botCount);
        const dropdown = ui.dropdown;
        dropdown.replaceChildren();
        if (detectedBots.length === 0) {
            renderEmptyDropdown(dropdown);
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
    /**
     * Helper: extract paragraphs or raw text from a content container.
     */
    function extractFromContainer(container) {
        const paras = container.querySelectorAll('p');
        if (paras.length > 0) {
            return {
                text: Array.from(paras).map(p => p.textContent).join('\n\n'),
                paragraphCount: paras.length
            };
        }
        const raw = container.innerText || container.textContent || '';
        return {
            text: raw,
            paragraphCount: raw.split(/\n\s*\n/).filter(l => l.trim().length > 10).length
        };
    }

    /**
     * New-Reddit slot-based content selectors, ordered by specificity.
     * These target the slotted light-DOM content of shreddit web components.
     */
    const NEW_REDDIT_CONTENT_SLOTS = [
        'div[slot="comment"]',
        '[slot="comment"]',
        'div[slot="text-body"]',
        '[slot="text-body"]',
        'div[slot="post-body"]',
        '[slot="post-body"]',
        '.md',
        '.RichTextJSON-root',
        '[data-click-id="text"]'
    ];

    function getTextToAnalyze(elem) {
        const tag = elem.tagName ? elem.tagName.toLowerCase() : '';
        let textToAnalyze = '';
        let paragraphCount = 0;

        if (tag === 'shreddit-comment' || tag === 'shreddit-post') {
            /*
             * New Reddit structures (shreddit web components):
             * Comment text lives in light DOM: <div slot="comment"><div><p>...</p></div></div>
             * Post body lives in light DOM: <div slot="text-body"><div><p>...</p></div></div>
             *
             * Always check light DOM (slotted content) FIRST.
             * Shadow DOM often contains only UI chrome (buttons, icons, etc.)
             * whose text would pollute the analysis.
             */

            /* Strategy 1: Find slotted content containers in light DOM */
            for (const sel of NEW_REDDIT_CONTENT_SLOTS) {
                const slotContent = elem.querySelector(sel);
                if (slotContent) {
                    const result = extractFromContainer(slotContent);
                    if (result.text.trim()) {
                        textToAnalyze = result.text;
                        paragraphCount = result.paragraphCount;
                        break;
                    }
                }
            }

            /* Strategy 2: Use light-DOM-only text (avoids shadow DOM noise) */
            if (!textToAnalyze.trim()) {
                const lightText = getLightDOMTextContent(elem);
                if (lightText.trim()) {
                    textToAnalyze = lightText;
                    paragraphCount = lightText.split(/\n\s*\n/).filter(l => l.trim().length > 10).length;
                }
            }

            /* Strategy 3: Try innerText which respects rendering (new Reddit) */
            if (!textToAnalyze.trim()) {
                /* innerText is rendering-aware and often cleaner than textContent */
                const innerText = elem.innerText || '';
                if (innerText.trim()) {
                    textToAnalyze = innerText;
                    paragraphCount = innerText.split(/\n\s*\n/).filter(l => l.trim().length > 10).length;
                }
            }

            /* Strategy 4: Shadow root content-area paragraphs (filtered) */
            if (!textToAnalyze.trim() && elem.shadowRoot) {
                /* Look for content containers inside the shadow root,
                   avoiding UI chrome like action bars and vote buttons */
                const shadowContent = elem.shadowRoot.querySelector(
                    '[id*="comment"], [id*="content"], [id*="body"], [class*="content"], [class*="body"], .md'
                );
                if (shadowContent) {
                    const result = extractFromContainer(shadowContent);
                    if (result.text.trim()) {
                        textToAnalyze = result.text;
                        paragraphCount = result.paragraphCount;
                    }
                }
                /* Fallback: paragraphs in shadow root */
                if (!textToAnalyze.trim()) {
                    const paras = elem.shadowRoot.querySelectorAll('p');
                    if (paras.length > 0) {
                        textToAnalyze = Array.from(paras).map(p => p.textContent).join('\n\n');
                        paragraphCount = paras.length;
                    }
                }
            }

            /* Strategy 5 (last resort): deep text extraction across both trees */
            if (!textToAnalyze.trim()) {
                textToAnalyze = getDeepTextContent(elem);
                paragraphCount = textToAnalyze.split(/\n\s*\n/).filter(l => l.trim().length > 10).length;
            }
        } else if (isOldReddit) {
            /*
             * Old Reddit structures:
             * - div.comment: has .entry > form.usertext > .usertext-body > .md
             * - div.link: has .entry > .usertext-body > .md (for self posts)
             * Use > .entry to scope to the direct comment entry and avoid
             * picking up text from nested child comments.
             */
            const entry = elem.querySelector(':scope > .entry');
            if (entry) {
                const contentDiv = entry.querySelector('.md, .usertext-body');
                if (contentDiv) {
                    const paras = contentDiv.querySelectorAll('p');
                    if (paras.length > 0) {
                        textToAnalyze = Array.from(paras).map(p => p.textContent).join('\n\n');
                        paragraphCount = paras.length;
                    } else {
                        textToAnalyze = contentDiv.textContent || '';
                        paragraphCount = textToAnalyze.split(/\n\s*\n/).filter(line => line.trim().length > 10).length;
                    }
                }
            }
            /* Fallback if entry structure not found */
            if (!textToAnalyze.trim()) {
                const contentDiv = elem.querySelector('.md, .usertext-body');
                textToAnalyze = contentDiv ? contentDiv.textContent : (elem.textContent || '');
                paragraphCount = textToAnalyze.split(/\n\s*\n/).filter(line => line.trim().length > 10).length;
            }
        } else if (!isOldReddit) {
            /* www.reddit.com non-shreddit containers (fallback for other element types) */
            /* Try slot-based selectors first */
            for (const sel of NEW_REDDIT_CONTENT_SLOTS) {
                const contentDiv = elem.querySelector(sel);
                if (contentDiv) {
                    const result = extractFromContainer(contentDiv);
                    if (result.text.trim()) {
                        textToAnalyze = result.text;
                        paragraphCount = result.paragraphCount;
                        break;
                    }
                }
            }
            if (!textToAnalyze.trim()) {
                textToAnalyze = elem.innerText || elem.textContent || '';
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
        const trimmedText = textToAnalyze.trim();

        const aiResult = trimmedText
            ? computeAIScore(textToAnalyze, paragraphCount)
            : { score: 0, reasons: [] };
        const imageAiResult = computeAIImageScore(elem, textToAnalyze);
        const aiScore  = aiResult.score + imageAiResult.score;
        const botScore = computeBotScore(elem);
        const aiReasons = [...aiResult.reasons, ...imageAiResult.reasons];

        if (!trimmedText && aiScore <= 0) return;

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
                /* Style the username link within the flagged element */
                const usernameElem = isOldReddit
                    ? elem.querySelector(USERNAME_SELECTORS)
                    : queryDeep(elem, USERNAME_SELECTORS);
                if (usernameElem) {
                    usernameElem.classList.add("botUsername");
                }
            }

            elem.dataset.aiScore   = aiScore.toFixed(2);
            elem.dataset.botScore  = botScore.toFixed(2);
            elem.dataset.aiReasons = JSON.stringify(aiReasons);
            flaggedElements.add(elem);

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
     * 8. SCANNING FUNCTIONS
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

        if (!isOldReddit) {
            /* Also look for shreddit elements with author attributes (new Reddit) */
            const shredditPosts = root.querySelectorAll('shreddit-post[author]:not([data-bot-detected])');
            shredditPosts.forEach(highlightIfSuspected);
            const shredditComments = root.querySelectorAll('shreddit-comment[author]:not([data-bot-detected])');
            shredditComments.forEach(highlightIfSuspected);

            /* Scan inside shreddit-comment-tree containers, which wrap comment lists */
            const commentTrees = root.querySelectorAll('shreddit-comment-tree');
            commentTrees.forEach(tree => {
                const treeComments = tree.querySelectorAll('shreddit-comment:not([data-bot-detected])');
                treeComments.forEach(highlightIfSuspected);
            });

            /*
             * Fallback: find user-profile links and walk UP to the nearest
             * post/comment container.  This catches content even if Reddit
             * changes element names in future redesigns.
             */
            const userLinks = root.querySelectorAll('a[href*="/user/"]:not([data-reddeye-link-scanned])');
            userLinks.forEach(link => {
                link.setAttribute('data-reddeye-link-scanned', 'true');
                const container = link.closest(
                    'shreddit-post, shreddit-comment, article, ' +
                    '[data-post-id], [data-comment-id], ' +
                    '[data-testid="post-container"], [data-testid="comment"], ' +
                    'div.comment, div.link'
                );
                if (container && !container.getAttribute('data-bot-detected')) {
                    highlightIfSuspected(container);
                }
            });

            /* Traverse shadow roots for nested content (new Reddit only) */
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
            flaggedElements.delete(el);
        });
        document.querySelectorAll('.botUsername').forEach(el => el.classList.remove('botUsername'));
        /* Clear shadow-scanned and link-scanned markers so content is re-scanned (new Reddit only) */
        if (!isOldReddit) {
            document.querySelectorAll('[data-reddeye-shadow-scanned]').forEach(el => {
                el.removeAttribute('data-reddeye-shadow-scanned');
            });
            document.querySelectorAll('[data-reddeye-link-scanned]').forEach(el => {
                el.removeAttribute('data-reddeye-link-scanned');
            });
        }
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

        /* Initial full-thread scan after page settles.
         * Run an early scan at 500ms (catches pre-rendered content)
         * and a follow-up at 2000ms (catches lazy-loaded/hydrated content). */
        setTimeout(() => fullThreadScan(), 500);
        setTimeout(() => fullThreadScan(), 2000);

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
            /* Also check for any shreddit elements that haven't been scanned */
            const hasUnscanned = document.querySelectorAll(unscannedSelector).length > 0;
            const hasShredditUnscanned = !isOldReddit && (
                document.querySelectorAll('shreddit-comment:not([data-bot-detected])').length > 0 ||
                document.querySelectorAll('shreddit-post:not([data-bot-detected])').length > 0
            );
            if (hasUnscanned || hasShredditUnscanned) {
                fullThreadScan();
            }
        }, 3000);

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
