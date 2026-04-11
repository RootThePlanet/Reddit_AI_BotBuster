/**
 * detection-logic.js
 *
 * Pure-function extraction of the Redd-Eye detection engine.
 * These functions are identical to the logic in firefox-extension/content.js
 * and are exported here solely so they can be unit-tested without a browser
 * environment.
 *
 * Nothing in this file touches the DOM, browser.storage, or MutationObserver.
 */

'use strict';

// ---------------------------------------------------------------------------
// Constants (mirrors firefox-extension/content.js §2)
// ---------------------------------------------------------------------------
const DEFAULT_AI_THRESHOLD  = 2.5;
const DEFAULT_BOT_THRESHOLD = 2.9;
const CONFIDENCE_MID_TIER   = 2.5;
const CONFIDENCE_HIGH_TIER  = 5.0;
const MIN_WORD_COUNT_FOR_AI_DETECTION = 25;

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

// ---------------------------------------------------------------------------
// Utility functions (mirrors firefox-extension/content.js §4)
// ---------------------------------------------------------------------------

/**
 * Estimates the syllable count for a single word.
 * @param {string} word
 * @returns {number}
 */
function countSyllables(word) {
    word = word.toLowerCase();
    if (word.length <= 3) return 1;
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
    word = word.replace(/^y/, '');
    const matches = word.match(/[aeiouy]{1,}/g);
    return matches ? matches.length : 1;
}

/**
 * Computes the Flesch Reading Ease score for a block of text.
 * Returns null if the text does not contain at least one sentence.
 * @param {string} text
 * @returns {number|null}
 */
function computeReadabilityScore(text) {
    const sentenceMatches = text.match(/[^.!?]+[.!?]+/g);
    if (!sentenceMatches) return null;
    const words = text.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0 || sentenceMatches.length === 0) return null;
    const syllableCount = words.reduce((acc, word) => acc + countSyllables(word), 0);
    return 206.835 - 1.015 * (words.length / sentenceMatches.length) - 84.6 * (syllableCount / words.length);
}

/**
 * Escapes special HTML characters to prevent injection.
 * @param {string} str
 * @returns {string}
 */
function escapeHTML(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// AI detection engine (mirrors firefox-extension/content.js §5)
// ---------------------------------------------------------------------------

/**
 * Scores a block of text for AI-generated characteristics.
 * Returns an object with `score` (number >= 0) and `reasons` (string[]).
 *
 * @param {string} text - The text to analyse.
 * @param {number} [paragraphCount=1] - Number of paragraphs in the source.
 * @returns {{ score: number, reasons: string[] }}
 */
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

    // CHECK 2: AI helper / closing phrases
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

    // CHECK 4: Lacks contractions
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

    // CHECK 6: Lacks personal opinion markers
    const personalPhrases = ["i think", "i feel", "i believe", "in my opinion", "in my experience", "personally,", "i reckon", "i suspect"];
    if (wordCount > 60 && formulaicPhraseCount > 0 && !personalPhrases.some(p => lowerText.includes(p))) {
        score += 1.0;
        reasons.push("Lacks Personal Opinion [+1.0]");
    }

    // CHECK 7: Sentence length variance
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

    // CHECK 10: Flesch readability
    const readability = computeReadabilityScore(text);
    if (readability !== null && readability > 70) {
        score += 0.55;
        reasons.push("High Readability Score [+0.55]");
    }

    // CHECK 11: Importance / urgency framing
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

    // CHECK 13: Structured list patterns
    const numberedListMatches = text.match(/^\s*\d+[.)]\s+\S/mg);
    const bulletListMatches   = text.match(/^\s*[-•*]\s+\S/mg);
    const listItemCount = (numberedListMatches ? numberedListMatches.length : 0) +
                          (bulletListMatches   ? bulletListMatches.length   : 0);
    if (listItemCount >= 3) {
        score += 1.5;
        reasons.push("Structured List Pattern [+1.5]");
    }

    // CHECK 14: Vocabulary diversity (Type-Token Ratio)
    // AI text tends to have lower lexical diversity — it reuses words more often
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
    // AI often starts consecutive sentences the same way ("The", "It", "This")
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
    // AI overuses softening phrases to sound balanced
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
    // AI text has more predictable word distributions; low entropy = more AI-like
    if (wordCount >= 40) {
        const wordFreq = {};
        words.forEach(w => { wordFreq[w] = (wordFreq[w] || 0) + 1; });
        let entropy = 0;
        const total = words.length;
        Object.values(wordFreq).forEach(count => {
            const p = count / total;
            if (p > 0) entropy -= p * Math.log2(p);
        });
        // Normalize by max possible entropy for this word count
        const maxEntropy = Math.log2(total);
        const normalizedEntropy = maxEntropy > 0 ? entropy / maxEntropy : 1;
        if (normalizedEntropy < 0.75) {
            score += 1.0;
            reasons.push("Low Word Entropy [+1.0]");
        }
    }

    // CHECK 18: Discourse connective overuse
    // AI text chains excessive connective phrases to appear logical and well-organized
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
    // AI commonly follows a rigid template
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

// ---------------------------------------------------------------------------
// Bot / username detection engine (mirrors firefox-extension/content.js §5)
// ---------------------------------------------------------------------------

/**
 * Scores a Reddit username for bot-like characteristics.
 * @param {string} username
 * @returns {number}
 */
function computeUsernameBotScore(username) {
    let score = 0;
    suspiciousUserPatterns.forEach(pattern => { if (pattern.test(username)) score += 1.5; });
    const digits = username.match(/\d/g);
    if (digits && (digits.length / username.length) > 0.4) score += 0.8;
    return score;
}

/**
 * Returns the confidence tier label for an AI score relative to the threshold.
 * @param {number} aiScore
 * @param {number} [threshold=DEFAULT_AI_THRESHOLD]
 * @returns {'none'|'low'|'mid'|'high'}
 */
function getAIConfidenceTier(aiScore, threshold) {
    threshold = threshold !== undefined ? threshold : DEFAULT_AI_THRESHOLD;
    if (aiScore < threshold)                           return 'none';
    if (aiScore >= threshold + CONFIDENCE_HIGH_TIER)   return 'high';
    if (aiScore >= threshold + CONFIDENCE_MID_TIER)    return 'mid';
    return 'low';
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = {
    DEFAULT_AI_THRESHOLD,
    DEFAULT_BOT_THRESHOLD,
    CONFIDENCE_MID_TIER,
    CONFIDENCE_HIGH_TIER,
    MIN_WORD_COUNT_FOR_AI_DETECTION,
    suspiciousUserPatterns,
    genericResponses,
    scamLinkRegex,
    countSyllables,
    computeReadabilityScore,
    escapeHTML,
    computeAIScore,
    computeUsernameBotScore,
    getAIConfidenceTier,
};
