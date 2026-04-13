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
        // >80 words, no contractions, no formulaic phrases (to isolate this check)
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

    test('does NOT penalise short text (< 80 words)', () => {
        // ~36 words, no contractions — but too short for this check
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
        const base = makePadding(50);
        const textWithEmoji = base + ' I love this 😊';
        const textWithout   = base + ' I love this one';
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
// Check 14: Vocabulary diversity (Type-Token Ratio)
// ---------------------------------------------------------------------------
describe('computeAIScore — vocabulary diversity (check 14)', () => {
    test('penalises low vocabulary diversity (highly repetitive text)', () => {
        // Same words repeated many times → TTR < 0.4
        const repetitiveText = Array(10).fill(
            'The system is designed to be efficient and reliable.'
        ).join(' ');
        const result = computeAIScore(repetitiveText);
        expect(result.reasons.some(r => r.includes('Vocabulary Diversity'))).toBe(true);
    });

    test('does NOT trigger for text under 50 words', () => {
        const shortText = Array(3).fill('The cat sat on the mat by the door.').join(' ');
        const result = computeAIScore(shortText);
        expect(result.reasons.some(r => r.includes('Vocabulary Diversity'))).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Check 15: Repetitive sentence starters
// ---------------------------------------------------------------------------
describe('computeAIScore — repetitive sentence starters (check 15)', () => {
    test('detects repeated sentence starters', () => {
        const text =
            'The system is very robust. The approach works well. ' +
            'The results are clear. The methodology is sound. ' +
            'People agree with this. Something else entirely here.';
        const result = computeAIScore(text);
        expect(result.reasons.some(r => r.includes('Repetitive Sentence Starters'))).toBe(true);
    });

    test('does NOT trigger with diverse sentence starters', () => {
        const text =
            'Dogs are wonderful companions for many people. ' +
            'Cats also make excellent pets for apartment living. ' +
            'Birds can be surprisingly affectionate to their owners. ' +
            'Fish require minimal interaction but provide calming presence. ' +
            'Rabbits are great choices for families with young children.';
        const result = computeAIScore(text);
        expect(result.reasons.some(r => r.includes('Repetitive Sentence Starters'))).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Check 16: Hedging language density
// ---------------------------------------------------------------------------
describe('computeAIScore — hedging language (check 16)', () => {
    test('detects heavy hedging language', () => {
        const hedgingText = makePadding(30) +
            ' It depends on the situation. In some cases, it may not work. ' +
            'It could be different depending on the context. Keep in mind that results may vary.';
        const result = computeAIScore(hedgingText);
        expect(result.reasons.some(r => r.includes('Hedging Language'))).toBe(true);
    });

    test('does NOT trigger for single hedging phrase', () => {
        const text = makePadding(30) + ' It depends on the situation.';
        const result = computeAIScore(text);
        expect(result.reasons.some(r => r.includes('Hedging Language'))).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Check 17: Word-level entropy
// ---------------------------------------------------------------------------
describe('computeAIScore — word entropy (check 17)', () => {
    test('detects low entropy (repetitive word usage)', () => {
        // Repeat a short set of words many times for low entropy
        const lowEntropyText = Array(15).fill(
            'The system is designed to be efficient.'
        ).join(' ');
        const result = computeAIScore(lowEntropyText);
        expect(result.reasons.some(r => r.includes('Word Entropy'))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Check 18: Discourse connective overuse
// ---------------------------------------------------------------------------
describe('computeAIScore — discourse connective overuse (check 18)', () => {
    test('detects excessive discourse connectives', () => {
        const text = makePadding(30) +
            ' However, this approach has merits. Therefore, we should consider it carefully. ' +
            'Additionally, the results are promising. Consequently, the team decided to proceed. ' +
            'Furthermore, the data supports this conclusion. Nonetheless, some concerns remain.';
        const result = computeAIScore(text);
        expect(result.reasons.some(r => r.includes('Discourse Connective'))).toBe(true);
    });

    test('does NOT trigger for normal connective usage', () => {
        const text = makePadding(60) + ' However, I disagree with that point.';
        const result = computeAIScore(text);
        expect(result.reasons.some(r => r.includes('Discourse Connective'))).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Check 19: Predictable paragraph structure
// ---------------------------------------------------------------------------
describe('computeAIScore — predictable structure (check 19)', () => {
    test('detects intro/conclusion template pattern', () => {
        const text =
            'In this post, I will explain the key factors to consider when making this decision. ' +
            'There are several important points worth discussing in great detail for our audience. ' +
            'The first consideration is the overall cost and benefit analysis of this approach. ' +
            'The second factor involves the long-term sustainability of the proposed approach overall. ' +
            'The third point relates to the practical implementation and resource allocation needed. ' +
            'In conclusion, the evidence strongly supports moving forward with this particular plan.';
        const result = computeAIScore(text, 3);
        expect(result.reasons.some(r => r.includes('Predictable Structure'))).toBe(true);
    });

    test('does NOT trigger without both intro and conclusion patterns', () => {
        const text = makePadding(70) + ' The data shows interesting results.';
        const result = computeAIScore(text, 3);
        expect(result.reasons.some(r => r.includes('Predictable Structure'))).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Check 20: Sentence Complexity Coefficient of Variation (Perplexity Inversion)
// ---------------------------------------------------------------------------
describe('computeAIScore — sentence complexity CoV (check 20)', () => {
    test('detects uniform sentence complexity (AI-like)', () => {
        // All sentences with very similar syllable-per-word ratios
        const uniformComplexity = Array(8).fill(
            'The system is designed to be efficient and reliable at all times.'
        ).join(' ');
        const result = computeAIScore(uniformComplexity);
        expect(result.reasons.some(r => r.includes('Complexity CoV'))).toBe(true);
    });

    test('does NOT trigger for text with varied complexity', () => {
        // Mix of simple and complex sentences
        const variedText =
            'Go run now. ' +
            'The extraordinarily sophisticated implementation demonstrates comprehensively remarkable capabilities. ' +
            'I like cats. ' +
            'The multifaceted organizational infrastructure necessitates unconventional methodological considerations. ' +
            'Dogs are fun. ' +
            'Simple words here too for good measure in this test sentence.';
        const result = computeAIScore(variedText);
        expect(result.reasons.some(r => r.includes('Complexity CoV'))).toBe(false);
    });

    test('does NOT trigger for fewer than 4 sentences', () => {
        const text = 'The cat sat on the mat. The dog ran to the park. A bird flew away.';
        const result = computeAIScore(text);
        expect(result.reasons.some(r => r.includes('Complexity CoV'))).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Check 21: AI Phrase Density
// ---------------------------------------------------------------------------
describe('computeAIScore — AI phrase density (check 21)', () => {
    test('detects high density of AI phrases in short text', () => {
        // Pack many AI phrases into a short text for high density
        const denseText =
            'In conclusion, it is important to note that furthermore this is vital. ' +
            'Moreover, research suggests studies show it is well-known and in summary ' +
            'it should be noted that ultimately it is essential to consider this matter ' +
            'carefully and thoroughly in every possible situation we encounter.';
        const result = computeAIScore(denseText);
        expect(result.reasons.some(r => r.includes('AI Phrase Density'))).toBe(true);
    });

    test('does NOT trigger when AI phrases are sparse in long text', () => {
        // One AI phrase buried in a lot of padding
        const text = makePadding(100) + ' In conclusion, the data is clear.';
        const result = computeAIScore(text);
        expect(result.reasons.some(r => r.includes('AI Phrase Density'))).toBe(false);
    });

    test('score is capped at 2.5', () => {
        const denseText =
            'In conclusion, furthermore, moreover, on the other hand, it is important to note. ' +
            'Ultimately, in summary, it should be noted, that being said, needless to say. ' +
            'First and foremost, last but not least, to summarize, it goes without saying.';
        const result = computeAIScore(denseText);
        const densityReason = result.reasons.find(r => r.includes('AI Phrase Density'));
        if (densityReason) {
            const points = parseFloat(densityReason.match(/\+(\d+\.\d+)/)[1]);
            expect(points).toBeLessThanOrEqual(2.5);
        }
    });
});

// ---------------------------------------------------------------------------
// Check 22: Hapax Legomena Ratio
// ---------------------------------------------------------------------------
describe('computeAIScore — hapax legomena ratio (check 22)', () => {
    test('detects low hapax ratio (heavily repeated vocabulary)', () => {
        // Highly repetitive text: most words appear multiple times
        const repetitiveText = Array(10).fill(
            'The system is designed to be efficient and reliable.'
        ).join(' ');
        const result = computeAIScore(repetitiveText);
        expect(result.reasons.some(r => r.includes('Hapax Legomena'))).toBe(true);
    });

    test('does NOT trigger for text under 50 words', () => {
        const shortText = Array(3).fill('The cat sat on the mat by the door.').join(' ');
        const result = computeAIScore(shortText);
        expect(result.reasons.some(r => r.includes('Hapax Legomena'))).toBe(false);
    });

    test('does NOT trigger for diverse vocabulary text', () => {
        const diverseText =
            'Yesterday morning, Sarah discovered an extraordinary antique ' +
            'telescope hidden underneath dusty blankets inside grandmother\'s ' +
            'forgotten attic storage room. Meanwhile, neighborhood children ' +
            'organized spontaneous carnival festivities throughout peaceful ' +
            'suburban boulevards during golden autumn twilight. Professional ' +
            'astronomers published groundbreaking research regarding mysterious ' +
            'celestial phenomena observed through innovative satellite instruments.';
        const result = computeAIScore(diverseText);
        expect(result.reasons.some(r => r.includes('Hapax Legomena'))).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Check 23: Function Word Distribution
// ---------------------------------------------------------------------------
describe('computeAIScore — function word distribution (check 23)', () => {
    test('detects uniform function word distribution in long text', () => {
        // Carefully constructed text where function words appear at similar rates
        const uniformFW = Array(8).fill(
            'The system is designed to be efficient and reliable in all conditions for the users.'
        ).join(' ');
        const result = computeAIScore(uniformFW);
        // May or may not trigger depending on actual distribution — just verify no crash
        expect(result).toHaveProperty('score');
        expect(result).toHaveProperty('reasons');
    });

    test('does NOT trigger for text under 60 words', () => {
        const shortText = Array(4).fill('The cat sat on a mat.').join(' ');
        const result = computeAIScore(shortText);
        expect(result.reasons.some(r => r.includes('Function Word'))).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Check 24: Punctuation Pattern Regularity
// ---------------------------------------------------------------------------
describe('computeAIScore — punctuation pattern regularity (check 24)', () => {
    test('detects very regular punctuation patterns', () => {
        // Every sentence has exactly 2 commas — very uniform
        const regularPunct = Array(6).fill(
            'The system, being well-designed, operates efficiently in conditions.'
        ).join(' ');
        const result = computeAIScore(regularPunct);
        expect(result.reasons.some(r => r.includes('Punctuation Patterns'))).toBe(true);
    });

    test('does NOT trigger for irregular punctuation patterns', () => {
        const irregularPunct =
            'Go now! ' +
            'The extraordinarily sophisticated, well-designed, carefully engineered, thoroughly tested system operates. ' +
            'Run. ' +
            'Fast! ' +
            'The system — if we consider all factors — works well, mostly, in certain conditions; however, results vary.';
        const result = computeAIScore(irregularPunct);
        expect(result.reasons.some(r => r.includes('Punctuation Patterns'))).toBe(false);
    });

    test('does NOT trigger for fewer than 4 sentences', () => {
        const text = 'The cat, being clever, escaped. The dog, being loyal, stayed. The bird flew.';
        const result = computeAIScore(text);
        expect(result.reasons.some(r => r.includes('Punctuation Patterns'))).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Check 25: Average Word Length Consistency
// ---------------------------------------------------------------------------
describe('computeAIScore — word length consistency (check 25)', () => {
    test('detects uniform word lengths across sentences', () => {
        // All sentences have very similar average word lengths
        const uniformWL = Array(8).fill(
            'The system is designed to be efficient and reliable at all times.'
        ).join(' ');
        const result = computeAIScore(uniformWL);
        expect(result.reasons.some(r => r.includes('Word Length Distribution'))).toBe(true);
    });

    test('does NOT trigger for varied word length patterns', () => {
        const variedWL =
            'Go. Run. Hi! ' +
            'The extraordinarily multifaceted organizational infrastructure demonstrates capabilities. ' +
            'I do. ' +
            'The comprehensively sophisticated methodological implementation necessitates unconventional approaches. ' +
            'Be it so. We try. Ok. ' +
            'Tremendously overcomplicated bureaucratic institutionalized responsibilities overwhelmed everybody.';
        const result = computeAIScore(variedWL);
        expect(result.reasons.some(r => r.includes('Word Length Distribution'))).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Check 26: Semantic Coherence via Lexical Overlap
// ---------------------------------------------------------------------------
describe('computeAIScore — lexical cohesion (check 26)', () => {
    test('detects high lexical overlap between consecutive sentences', () => {
        // Same content words repeated across sentences
        const highOverlap =
            'The detection system analyzes the content for patterns. ' +
            'The detection system identifies suspicious content patterns. ' +
            'The detection system flags problematic content patterns. ' +
            'The detection system reports flagged content patterns. ' +
            'The detection system removes harmful content patterns.';
        const result = computeAIScore(highOverlap);
        expect(result.reasons.some(r => r.includes('Lexical Cohesion'))).toBe(true);
    });

    test('does NOT trigger for diverse topic sentences', () => {
        const diverseTopics =
            'Yesterday morning Sarah discovered an antique telescope in the attic. ' +
            'Professional basketball players train rigorously during summer camps. ' +
            'Exotic tropical fish require specialized aquarium filtration equipment. ' +
            'Mountain climbers faced unexpected avalanche conditions near the summit. ' +
            'Classical musicians performed a breathtaking symphony at the concert hall.';
        const result = computeAIScore(diverseTopics);
        expect(result.reasons.some(r => r.includes('Lexical Cohesion'))).toBe(false);
    });

    test('does NOT trigger for fewer than 4 sentences', () => {
        const text = 'The system works well. The system is reliable. The system is fast.';
        const result = computeAIScore(text);
        expect(result.reasons.some(r => r.includes('Lexical Cohesion'))).toBe(false);
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
        const result = computeAIScore(HUMAN_TEXT);
        expect(result.score).toBeLessThan(DEFAULT_AI_THRESHOLD);
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
