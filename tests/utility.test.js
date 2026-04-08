/**
 * utility.test.js
 *
 * Unit tests for the pure utility functions:
 *   - countSyllables
 *   - computeReadabilityScore
 *   - escapeHTML
 */

'use strict';

const {
    countSyllables,
    computeReadabilityScore,
    escapeHTML,
} = require('./detection-logic');

// ---------------------------------------------------------------------------
// countSyllables
// ---------------------------------------------------------------------------
describe('countSyllables', () => {
    test('returns 1 for short words (≤ 3 chars)', () => {
        expect(countSyllables('a')).toBe(1);
        expect(countSyllables('be')).toBe(1);
        expect(countSyllables('cat')).toBe(1);
    });

    test('counts single-syllable common words correctly', () => {
        expect(countSyllables('the')).toBe(1);
        expect(countSyllables('run')).toBe(1);
    });

    test('counts two-syllable words correctly', () => {
        // "happy" → hap-py
        expect(countSyllables('happy')).toBe(2);
        // "table" → ta-ble
        expect(countSyllables('table')).toBe(2);
    });

    test('counts three-syllable words correctly', () => {
        // "beautiful" → beau-ti-ful
        expect(countSyllables('beautiful')).toBe(3);
        // "computer" → com-pu-ter
        expect(countSyllables('computer')).toBe(3);
    });

    test('handles words without vowels by returning 1', () => {
        expect(countSyllables('rhythms')).toBe(1);
    });

    test('strips silent trailing "e" before counting', () => {
        // "make" should be treated as "mak" → 1 syllable
        expect(countSyllables('make')).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// computeReadabilityScore
// ---------------------------------------------------------------------------
describe('computeReadabilityScore', () => {
    test('returns null for text with no sentences', () => {
        expect(computeReadabilityScore('hello world')).toBeNull();
        expect(computeReadabilityScore('')).toBeNull();
    });

    test('returns a finite number for well-formed text', () => {
        const text = 'The cat sat on the mat. It was a good day.';
        const score = computeReadabilityScore(text);
        expect(typeof score).toBe('number');
        expect(isFinite(score)).toBe(true);
    });

    test('simple short sentences score high (highly readable)', () => {
        // Very short, common words → high Flesch score
        const simpleText = 'Go now. Run fast. It is fun.';
        const score = computeReadabilityScore(simpleText);
        expect(score).toBeGreaterThan(70);
    });

    test('complex long sentences score lower', () => {
        const complexText =
            'The extraordinarily multifaceted implementation of sophisticated ' +
            'technological infrastructure demonstrates remarkable organisational ' +
            'capabilities. Furthermore, the comprehensive utilisation of ' +
            'multidisciplinary methodologies facilitates unprecedented paradigm shifts.';
        const score = computeReadabilityScore(complexText);
        // Should be lower than simple text
        expect(score).toBeLessThan(70);
    });
});

// ---------------------------------------------------------------------------
// escapeHTML
// ---------------------------------------------------------------------------
describe('escapeHTML', () => {
    test('escapes ampersand', () => {
        expect(escapeHTML('a & b')).toBe('a &amp; b');
    });

    test('escapes less-than', () => {
        expect(escapeHTML('<script>')).toBe('&lt;script&gt;');
    });

    test('escapes greater-than', () => {
        expect(escapeHTML('2 > 1')).toBe('2 &gt; 1');
    });

    test('escapes double quotes', () => {
        expect(escapeHTML('"hello"')).toBe('&quot;hello&quot;');
    });

    test('escapes single quotes', () => {
        expect(escapeHTML("it's")).toBe('it&#39;s');
    });

    test('handles XSS attempt', () => {
        const xss = '<img src=x onerror="alert(1)">';
        const escaped = escapeHTML(xss);
        expect(escaped).not.toContain('<');
        expect(escaped).not.toContain('>');
        expect(escaped).not.toContain('"');
        expect(escaped).toContain('&lt;');
        expect(escaped).toContain('&gt;');
        expect(escaped).toContain('&quot;');
    });

    test('coerces non-string values to string', () => {
        expect(escapeHTML(42)).toBe('42');
        expect(escapeHTML(null)).toBe('null');
    });

    test('leaves safe strings unchanged', () => {
        expect(escapeHTML('hello world')).toBe('hello world');
    });
});
