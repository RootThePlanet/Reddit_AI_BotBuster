/*
 Redd-Eye – Firefox WebExtension content script.
 Version 4.2.0
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

        #botCounterPopup { position: fixed; top: 40px; right: 10px; width: 280px; z-index: 9999; background-color: rgba(248,248,248,0.9); backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.25); font-family: 'Verdana', sans-serif; font-size: 12px; border: 1px solid #ccc; user-select: none; }
        #botPopupHeader { display: flex; justify-content: space-between; align-items: center; font-weight: bold; padding: 10px; border-bottom: 1px solid #eee; cursor: pointer; }
        #settingsIcon { cursor: pointer; font-size: 16px; margin-left: 10px; }
        #settingsPanel { display: none; padding: 10px; border-top: 1px solid #eee; }
        #settingsPanel label { display: block; margin: 5px 0; }
        #settingsPanel input { width: 50px; margin-left: 10px; }
        #saveSettingsBtn { background-color: #007bff; color: white; border: none; border-radius: 4px; padding: 5px 10px; cursor: pointer; margin-top: 10px; }
        #saveSettingsBtn:hover { background-color: #0056b3; }
        #botDropdown { display: none; max-height: 300px; overflow-y: auto; padding: 5px 0; }
        #botDropdown a { display: block; padding: 3px 10px; text-decoration: none; color: #333; }
        #botDropdown a:hover { background-color: rgba(0,0,0,0.08); }
        #aiScoreTooltip { position: fixed; display: none; background: #222; color: #fff; border-radius: 5px; padding: 8px; font-size: 12px; z-index: 10000; max-width: 300px; pointer-events: none; }
        #aiScoreTooltip ul { margin: 0; padding: 0 0 0 15px; }
        #aiScoreTooltip li { margin-bottom: 3px; }
    `;
    document.head.appendChild(style);

    /************************************
     * 2. CONFIGURATION & STATE
     ************************************/
    const DEFAULT_AI_THRESHOLD  = 3.5;
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
    const CONTENT_SELECTORS = [
        'div[data-testid="post-container"]',
        'div[data-testid="comment"]',
        'div.comment',
        'div.link'
    ];
    const USERNAME_SELECTORS = 'a[href*="/user/"], a[href*="/u/"], a.author, a[data-click-id="user"]';

    let botCount = 0;
    let detectedBots = [];
    let detectionIndex = 0;

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
        let userElem = elem.querySelector(USERNAME_SELECTORS);
        if (userElem) {
            score += computeUsernameBotScore(userElem.textContent.trim());
        } else {
            /* Fallback: check shreddit parent author or data-author attribute */
            let username = '';
            if (elem.closest) {
                const shredditParent = elem.closest('shreddit-post[author], shreddit-comment[author]');
                if (shredditParent) username = shredditParent.getAttribute('author');
            }
            if (!username && elem.hasAttribute && elem.hasAttribute('data-author')) {
                username = elem.getAttribute('data-author');
            }
            if (username) score += computeUsernameBotScore(username);
        }
        const textContent = elem.innerText.toLowerCase().replace(/\s+/g, ' ').trim();
        if (genericResponses.includes(textContent) && textContent.length < 30) score += 1.5;
        elem.querySelectorAll('a').forEach(link => {
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
                <span>Detected bot/AI: 0</span>
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
                try { aiReasons = JSON.parse(flaggedElem.dataset.aiReasons || '[]'); } catch (e) { /* ignore corrupt data */ }
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
        document.querySelector("#botPopupHeader > span").textContent = `Detected bot/AI: ${botCount}`;
        const dropdown = document.getElementById("botDropdown");
        dropdown.innerHTML = "";
        if (detectedBots.length === 0) {
            dropdown.innerHTML = `<span style="padding:3px 10px;color:#777;font-style:italic;">No bots/AI detected yet.</span>`;
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
                        document.getElementById(item.elemID)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    });
                    dropdown.appendChild(link);
                });
        }
    }

    /************************************
     * 7. CORE DETECTION LOGIC
     ************************************/
    function highlightIfSuspected(elem) {
        if (elem.getAttribute("data-bot-detected")) return;

        const commentBody = elem.querySelector('div[data-testid="comment"] > div:nth-child(2) > div');
        let textToAnalyze = '', paragraphCount = 0;

        if (commentBody && commentBody.querySelectorAll('p').length > 0) {
            const paragraphs = Array.from(commentBody.querySelectorAll('p'));
            textToAnalyze = paragraphs.map(p => p.innerText).join('\n\n');
            paragraphCount = paragraphs.length;
        } else {
            const contentDiv = elem.querySelector('.md, .usertext-body');
            textToAnalyze = contentDiv ? contentDiv.innerText : (elem.innerText || '');
            paragraphCount = textToAnalyze.split(/\n\s*\n/).filter(line => line.trim().length > 10).length;
        }

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
                const usernameElem = elem.querySelector(USERNAME_SELECTORS);
                if (usernameElem) usernameElem.classList.add("botUsername");
            }

            elem.dataset.aiScore   = aiScore.toFixed(2);
            elem.dataset.botScore  = botScore.toFixed(2);
            elem.dataset.aiReasons = JSON.stringify(aiResult.reasons);

            botCount++;
            detectionIndex++;
            const generatedID = "reddeye-detected-" + detectionIndex;
            if (!elem.id) elem.setAttribute("id", generatedID);
            const elemID   = elem.id;
            let username = elem.querySelector(USERNAME_SELECTORS)?.textContent.trim() || '';
            if (!username && elem.closest) {
                const shredditParent = elem.closest('shreddit-post[author], shreddit-comment[author]');
                if (shredditParent) username = shredditParent.getAttribute('author');
            }
            if (!username && elem.hasAttribute && elem.hasAttribute('data-author')) {
                username = elem.getAttribute('data-author');
            }
            if (!username) username = "Unknown";

            detectedBots.push({ username, elemID, reason, botScore, aiScore });
            updatePopup();
        }
    }

    /************************************
     * 8. INITIALIZATION & OBSERVATION
     ************************************/
    function debounce(fn, delay) {
        let timer;
        return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
    }

    function scanForBots(root) {
        root = root || document;
        const query = CONTENT_SELECTORS.map(s => `${s}:not([data-bot-detected])`).join(', ');
        root.querySelectorAll(query).forEach(highlightIfSuspected);
    }

    /** Reset detection state and widget when Reddit SPA-navigates to a new page. */
    function resetDetectionState() {
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
        setTimeout(() => scanForBots(document.body), 1500);

        const scheduleScan = debounce(() => scanForBots(document.body), 100);
        const observer = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Trigger one debounced full-page scan rather than per-node scans.
                        // The debounce ensures all nodes added in rapid succession are
                        // covered by the single scanForBots(document.body) call.
                        scheduleScan();
                        break;
                    }
                }
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        monitorNavigation(() => {
            resetDetectionState();
            setTimeout(() => scanForBots(document.body), 1500);
        });
    });
})();
