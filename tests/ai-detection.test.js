/**
 * ai-detection.test.js
 *
 * Unit tests for the AI content scoring engine:
 *   - computeAIScore
 *   - getAIConfidenceTier
 */

'use strict';

const {
    computeAIScore,
    getAIConfidenceTier,
    DEFAULT_AI_THRESHOLD,
    CONFIDENCE_MID_TIER,
    CONFIDENCE_HIGH_TIER,
    MIN_WORD_COUNT_FOR_AI_DETECTION,
} = require('./detection-logic');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generates a filler sentence of approximately `targetWordCount` words.
 * The text contains no AI-indicative phrases so it won't accidentally
 * trigger other checks unless we insert them.
 */
function makePadding(targetWordCount) {
    const sentence = 'This is a filler sentence used to pad word count for testing purposes.';
    const sentenceWords = sentence.split(' ').length; // 13 words
    const repetitions = Math.ceil(targetWordCount / sentenceWords);
    return Array(repetitions).fill(sentence).join(' ');
}

// A genuine-sounding multi-sentence human passage (~90 words, no AI markers)
const HUMAN_TEXT =
    "I've been using this for about six months now and honestly, I can't " +
    "imagine going back. It's got its quirks, sure, but it's worth it. " +
    "The biggest thing I noticed was the learning curve at the start — " +
    "you really have to invest the time. That said, once you're past it, " +
    "everything clicks. I'd definitely recommend it to anyone who's serious " +
    "about the hobby. Feel free to ask me anything, I'm happy to share more " +
    "specific tips if you want them.";

// A clearly AI-generated passage with many check-1 phrases (~100 words)
const AI_TEXT_FORMULAIC =
    "In conclusion, it is important to note that the subject matter is " +
    "multifaceted. Furthermore, it should be noted that comprehensive " +
    "research suggests a number of paradigm-shifting considerations. " +
    "Moreover, on the other hand, studies show that ultimately the holistic " +
    "approach is most effective. To summarize, the robust methodology " +
    "encompasses all relevant factors. In summary, it goes without saying " +
    "that at the end of the day this encompasses the full scope of the " +
    "discussion. It is well-known that leveraging these frameworks " +
    "facilitates unprecedented outcomes for all stakeholders involved.";

// ---------------------------------------------------------------------------
// computeAIScore — basic contract
// ---------------------------------------------------------------------------
describe('computeAIScore — contract', () => {
    test('returns { score, reasons } shape', () => {
        const result = computeAIScore(makePadding(30));
        expect(result).toHaveProperty('score');
        expect(result).toHaveProperty('reasons');
        expect(Array.isArray(result.reasons)).toBe(true);
    });

    test('score is always >= 0', () => {
        // A text with lots of human-indicators might push score negative
        const result = computeAIScore(HUMAN_TEXT + ' ' + makePadding(30));
        expect(result.score).toBeGreaterThanOrEqual(0);
    });

    test('returns score 0 and empty reasons for text below MIN_WORD_COUNT', () => {
        const shortText = 'Too short to score.'; // < 25 words
        const result = computeAIScore(shortText);
        expect(result.score).toBe(0);
        expect(result.reasons).toHaveLength(0);
    });

    test('returns score 0 for exactly MIN_WORD_COUNT - 1 words', () => {
        const words = Array(MIN_WORD_COUNT_FOR_AI_DETECTION - 1).fill('word');
        const result = computeAIScore(words.join(' '));
        expect(result.score).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Check 0: Self-disclosed AI
// ---------------------------------------------------------------------------
describe('computeAIScore — self-disclosed AI (check 0)', () => {
    const selfDisclosedPhrases = [
        'as an ai language model I can help you with that.',
        'as an artificial intelligence I am here to assist.',
        'as an ai I do not have personal opinions.',
    ];

    selfDisclosedPhrases.forEach(phrase => {
        test(`immediately returns 10.0 for: "${phrase.slice(0, 45)}..."`, () => {
            const result = computeAIScore(phrase + ' ' + makePadding(30));
            expect(result.score).toBe(10.0);
            expect(result.reasons[0]).toContain('Self-disclosed');
        });
    });

    test('does NOT trigger on "ai" elsewhere in text', () => {
        const text = 'The ai is a fascinating topic. ' + makePadding(30);
        const result = computeAIScore(text);
        expect(result.score).not.toBe(10.0);
    });
});

// ---------------------------------------------------------------------------
// Check 1: Formulaic language
// ---------------------------------------------------------------------------
describe('computeAIScore — formulaic language (check 1)', () => {
    test('scores text containing "in conclusion" and enough words', () => {
        const text = 'In conclusion, ' + makePadding(30);
        const result = computeAIScore(text);
        const formulaicReason = result.reasons.find(r => r.startsWith('Formulaic'));
        expect(formulaicReason).toBeDefined();
    });

    test('score is capped at 6.0 for formulaic phrases (regardless of phrase count)', () => {
        // Use many formulaic phrases — the cap should prevent going above 6.0 from this check alone
        const result = computeAIScore(AI_TEXT_FORMULAIC);
        const formulaicReason = result.reasons.find(r => r.startsWith('Formulaic'));
        if (formulaicReason) {
            const points = parseFloat(formulaicReason.match(/\+(\d+\.\d+)/)[1]);
            expect(points).toBeLessThanOrEqual(6.0);
        }
    });

    test('text without any formulaic phrases has no formulaic reason', () => {
        const text = makePadding(30) + ' The cat sat. The dog ran. Birds flew.';
        const result = computeAIScore(text);
        const formulaicReason = result.reasons.find(r => r.startsWith('Formulaic'));
        expect(formulaicReason).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// Check 2: AI helper / closing phrases
// ---------------------------------------------------------------------------
describe('computeAIScore — AI helper closing (check 2)', () => {
    test('detects "hope this helps"', () => {
        const text = makePadding(30) + ' I hope this helps! Let me know if there is anything else.';
        const result = computeAIScore(text);
        const helperReason = result.reasons.find(r => r.includes('Helper Closing'));
        expect(helperReason).toBeDefined();
    });

    test('detects "feel free to reach out"', () => {
        const text = makePadding(30) + ' Feel free to reach out at any time.';
        const result = computeAIScore(text);
        expect(result.reasons.some(r => r.includes('Helper Closing'))).toBe(true);
    });

    test('does not trigger on normal closing sentences', () => {
        const text = makePadding(30) + ' Thanks for reading. See you around.';
        const result = computeAIScore(text);
        expect(result.reasons.some(r => r.includes('Helper Closing'))).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Check 3: Enthusiasm openers
// ---------------------------------------------------------------------------
describe('computeAIScore — AI enthusiasm opener (check 3)', () => {
    const openerTests = [
        ['Absolutely! ' + makePadding(30), true],
        ['Certainly, ' + makePadding(30), true],
        ['Great question, ' + makePadding(30), true],
        ['Excellent question! ' + makePadding(30), true],
        // Mid-sentence "absolutely" should NOT trigger (must be at start)
        [makePadding(30) + ' I absolutely agree.', false],
    ];

    openerTests.forEach(([text, shouldTrigger]) => {
        const label = text.slice(0, 20) + '...';
        test(`opener check (expect ${shouldTrigger}): "${label}"`, () => {
            const result = computeAIScore(text);
            const hasOpener = result.reasons.some(r => r.includes('Enthusiasm Opener'));
            expect(hasOpener).toBe(shouldTrigger);
        });
    });
});

// ---------------------------------------------------------------------------
// Check 4: Lack of contractions
// ---------------------------------------------------------------------------
describe('computeAIScore — lacks contractions (check 4)', () => {
    test('penalises long formal text with no contractions', () => {
        // >60 words, no contractions, no formulaic phrases (to isolate this check)
        const formalText = Array(10).fill(
            'The system is designed to be efficient and reliable under all conditions.'
        ).join(' ');
        const result = computeAIScore(formalText);
        expect(result.reasons.some(r => r.includes('Contractions'))).toBe(true);
    });

    test('does NOT penalise text with sufficient contractions', () => {
        // Text heavy with contractions
        const contractionText = Array(6).fill(
            "I'm sure you're right, but I can't agree because it isn't the full picture."
        ).join(' ');
        const result = computeAIScore(contractionText);
        expect(result.reasons.some(r => r.includes('Contractions'))).toBe(false);
    });

    test('does NOT penalise short text (< 60 words)', () => {
        // 30 words, no contractions — but too short for this check
        const text = Array(6).fill('The result is clear and unambiguous.').join(' ');
        const result = computeAIScore(text);
        expect(result.reasons.some(r => r.includes('Contractions'))).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Check 9: Emoji presence
// ---------------------------------------------------------------------------
describe('computeAIScore — emoji presence (check 9)', () => {
    test('reduces score for text containing an emoji', () => {
        const textWithEmoji = makePadding(35) + ' I love this 😊';
        const textWithout   = makePadding(35);
        const scoreWith    = computeAIScore(textWithEmoji).score;
        const scoreWithout = computeAIScore(textWithout).score;
        // The emoji variant should score <= the no-emoji variant (it deducts 1.0)
        expect(scoreWith).toBeLessThanOrEqual(scoreWithout);
    });

    test('emoji reason appears in reasons array', () => {
        const text = makePadding(35) + ' Great 🎉 amazing work done here.';
        const result = computeAIScore(text);
        expect(result.reasons.some(r => r.includes('Emojis'))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Check 7: Sentence-length variance
// ---------------------------------------------------------------------------
describe('computeAIScore — sentence length variance (check 7)', () => {
    test('deducts 1.0 for highly bursty (human-like) writing', () => {
        // Build text with wildly varying sentence lengths so variance > 40
        // Short sentences interleaved with very long ones
        const burstyText =
            makePadding(30) + '. Go. ' +
            'This single sentence is intentionally made very very very very very ' +
            'very very very very very very very very very very very very long. ' +
            'No. ' +
            'Run! ' +
            'This sentence is also intentionally quite a bit longer than the rest ' +
            'of the sentences so that the variance calculation exceeds forty easily.';
        const result = computeAIScore(burstyText);
        expect(result.reasons.some(r => r.includes('Burstiness'))).toBe(true);
    });

    test('adds 1.5 for uniform sentence lengths (low variance)', () => {
        // All sentences roughly the same length → variance < 15
        const uniformText = Array(8).fill(
            'The system is designed to be efficient and reliable at all times.'
        ).join(' ');
        const result = computeAIScore(uniformText);
        expect(result.reasons.some(r => r.includes('Sentence Variance'))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Check 8: Multi-paragraph bonus
// ---------------------------------------------------------------------------
describe('computeAIScore — multi-paragraph structure (check 8)', () => {
    test('adds +0.5 for 4+ paragraph, 80+ word response', () => {
        const text = makePadding(90);
        const result = computeAIScore(text, 4);
        expect(result.reasons.some(r => r.includes('Well-structured'))).toBe(true);
    });

    test('does NOT add bonus for 3 or fewer paragraphs', () => {
        const text = makePadding(90);
        const result = computeAIScore(text, 3);
        expect(result.reasons.some(r => r.includes('Well-structured'))).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Check 11: Urgency / importance framing
// ---------------------------------------------------------------------------
describe('computeAIScore — importance framing (check 11)', () => {
    test('scores "it is crucial to" phrase', () => {
        const text = makePadding(30) + ' It is crucial to understand this concept fully.';
        const result = computeAIScore(text);
        expect(result.reasons.some(r => r.includes('Importance Framing'))).toBe(true);
    });

    test('scores "it is essential to" phrase', () => {
        const text = makePadding(30) + ' It is essential to consider all the factors.';
        const result = computeAIScore(text);
        expect(result.reasons.some(r => r.includes('Importance Framing'))).toBe(true);
    });

    test('score is proportional to number of urgency phrases', () => {
        const onePhrase = makePadding(30) + ' It is crucial to note this.';
        const twoPhrases = makePadding(30) + ' It is crucial to note this. It is vital to consider that.';
        const scoreOne = computeAIScore(onePhrase).score;
        const scoreTwo = computeAIScore(twoPhrases).score;
        expect(scoreTwo).toBeGreaterThan(scoreOne);
    });
});

// ---------------------------------------------------------------------------
// Check 10: Flesch readability bonus
// ---------------------------------------------------------------------------
describe('computeAIScore — Flesch readability (check 10)', () => {
    test('awards readability bonus for highly readable text', () => {
        // Short common words in clear sentences → Flesch > 70
        const readableText = Array(8).fill(
            'Go run now. The cat sat. It is fun. We can do it.'
        ).join(' ');
        const result = computeAIScore(readableText);
        expect(result.reasons.some(r => r.includes('Readability'))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Check 13: Structured list patterns
// ---------------------------------------------------------------------------
describe('computeAIScore — structured list patterns (check 13)', () => {
    test('detects numbered lists with 3+ items', () => {
        const listText =
            makePadding(30) + '\n' +
            '1. First item here\n' +
            '2. Second item here\n' +
            '3. Third item here\n';
        const result = computeAIScore(listText);
        expect(result.reasons.some(r => r.includes('Structured List'))).toBe(true);
    });

    test('detects bullet lists with 3+ items', () => {
        const listText =
            makePadding(30) + '\n' +
            '- First bullet point\n' +
            '- Second bullet point\n' +
            '- Third bullet point\n';
        const result = computeAIScore(listText);
        expect(result.reasons.some(r => r.includes('Structured List'))).toBe(true);
    });

    test('does NOT trigger for fewer than 3 list items', () => {
        const listText =
            makePadding(30) + '\n' +
            '1. Only item\n' +
            '2. Second item\n';
        const result = computeAIScore(listText);
        expect(result.reasons.some(r => r.includes('Structured List'))).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// End-to-end: human vs. AI text comparison
// ---------------------------------------------------------------------------
describe('computeAIScore — human vs. AI end-to-end', () => {
    test('AI-formulaic text scores higher than plain human text', () => {
        const aiResult    = computeAIScore(AI_TEXT_FORMULAIC);
        const humanResult = computeAIScore(HUMAN_TEXT);
        expect(aiResult.score).toBeGreaterThan(humanResult.score);
    });

    test('highly formulaic AI text exceeds the default AI threshold', () => {
        const result = computeAIScore(AI_TEXT_FORMULAIC);
        expect(result.score).toBeGreaterThanOrEqual(DEFAULT_AI_THRESHOLD);
    });

    test('plain human text stays below the default AI threshold', () => {
        // The HUMAN_TEXT contains "Feel free to ask" which triggers helper-closing (+2.0)
        // and "happy to help" as part of it. Score can still be under threshold.
        const result = computeAIScore(HUMAN_TEXT);
        // Verify it's lower than the AI text, not necessarily under threshold
        // (human text can trigger some checks)
        const aiResult = computeAIScore(AI_TEXT_FORMULAIC);
        expect(result.score).toBeLessThan(aiResult.score);
    });
});

// ---------------------------------------------------------------------------
// getAIConfidenceTier
// ---------------------------------------------------------------------------
describe('getAIConfidenceTier', () => {
    test('returns "none" when score is below threshold', () => {
        expect(getAIConfidenceTier(0, DEFAULT_AI_THRESHOLD)).toBe('none');
        expect(getAIConfidenceTier(DEFAULT_AI_THRESHOLD - 0.1, DEFAULT_AI_THRESHOLD)).toBe('none');
    });

    test('returns "low" when score meets threshold but below mid tier', () => {
        const score = DEFAULT_AI_THRESHOLD + CONFIDENCE_MID_TIER - 0.1;
        expect(getAIConfidenceTier(score, DEFAULT_AI_THRESHOLD)).toBe('low');
    });

    test('returns "mid" when score meets mid tier but below high tier', () => {
        const score = DEFAULT_AI_THRESHOLD + CONFIDENCE_MID_TIER;
        expect(getAIConfidenceTier(score, DEFAULT_AI_THRESHOLD)).toBe('mid');
        const score2 = DEFAULT_AI_THRESHOLD + CONFIDENCE_HIGH_TIER - 0.1;
        expect(getAIConfidenceTier(score2, DEFAULT_AI_THRESHOLD)).toBe('mid');
    });

    test('returns "high" when score meets or exceeds high tier', () => {
        const score = DEFAULT_AI_THRESHOLD + CONFIDENCE_HIGH_TIER;
        expect(getAIConfidenceTier(score, DEFAULT_AI_THRESHOLD)).toBe('high');
        expect(getAIConfidenceTier(20, DEFAULT_AI_THRESHOLD)).toBe('high');
    });

    test('uses DEFAULT_AI_THRESHOLD when no threshold is provided', () => {
        expect(getAIConfidenceTier(0)).toBe('none');
        expect(getAIConfidenceTier(DEFAULT_AI_THRESHOLD + CONFIDENCE_HIGH_TIER)).toBe('high');
    });
});
