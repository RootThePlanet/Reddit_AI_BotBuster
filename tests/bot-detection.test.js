/**
 * bot-detection.test.js
 *
 * Unit tests for username-based bot scoring:
 *   - computeUsernameBotScore
 *   - suspiciousUserPatterns
 *   - scamLinkRegex
 */

'use strict';

const {
    computeUsernameBotScore,
    suspiciousUserPatterns,
    scamLinkRegex,
    DEFAULT_BOT_THRESHOLD,
} = require('./detection-logic');

// ---------------------------------------------------------------------------
// computeUsernameBotScore
// ---------------------------------------------------------------------------
describe('computeUsernameBotScore', () => {
    // ------ Clean / human-like usernames ------
    test('returns 0 for a normal human username with no suspicious traits', () => {
        expect(computeUsernameBotScore('JohnDoe')).toBe(0);
    });

    test('returns 0 for a short, vowel-rich username', () => {
        expect(computeUsernameBotScore('alice')).toBe(0);
    });

    // ------ Pattern-based triggers ------
    test('scores "bot" substring via /bot/i pattern', () => {
        // Matches pattern 0 (/bot/i) → +1.5
        expect(computeUsernameBotScore('CoolBot')).toBeGreaterThanOrEqual(1.5);
    });

    test('scores Word-Word1234 format via pattern 1', () => {
        // Matches /^[A-Za-z]+-[A-Za-z]+\d{4}$/  → +1.5
        const score = computeUsernameBotScore('Happy-Panda1234');
        expect(score).toBeGreaterThanOrEqual(1.5);
    });

    test('scores Word_Word12 format via pattern 2', () => {
        // Matches /^[A-Za-z]+[_-][A-Za-z]+\d{2,4}$/  → +1.5
        const score = computeUsernameBotScore('Fluffy_Cat99');
        expect(score).toBeGreaterThanOrEqual(1.5);
    });

    test('scores Username9999 format via pattern 3', () => {
        // Matches /^[A-Za-z]+\d{4,}$/  → +1.5
        const score = computeUsernameBotScore('Username1234');
        expect(score).toBeGreaterThanOrEqual(1.5);
    });

    test('scores user/redditor + 6 digits format via pattern 4', () => {
        // Matches /^(user|redditor)\d{6,}$/i  → +1.5
        const score = computeUsernameBotScore('user123456');
        expect(score).toBeGreaterThanOrEqual(1.5);
    });

    // ------ Digit-ratio trigger ------
    test('adds +0.8 for usernames where >40% chars are digits', () => {
        // "abc1234" → 4/7 digits ≈ 57% → +0.8  (plus pattern 3: +1.5)
        const score = computeUsernameBotScore('abc1234');
        // Should include both the pattern bonus and digit-ratio bonus
        expect(score).toBeGreaterThanOrEqual(1.5 + 0.8);
    });

    test('does NOT add digit-ratio bonus when <40% digits', () => {
        // "abc1" → 1/4 digits = 25% → no digit bonus, but no pattern match either
        const score = computeUsernameBotScore('abc1');
        // No pattern matches at all for "abc1"
        expect(score).toBe(0);
    });

    // ------ Ceiling: very suspicious name ------
    test('accumulates score for multiple matching patterns', () => {
        // "botuser123456" → pattern 0 (bot), pattern 4 (user+6digits)... let the
        // function accumulate all matching pattern scores
        const score = computeUsernameBotScore('botuser123456');
        expect(score).toBeGreaterThan(DEFAULT_BOT_THRESHOLD);
    });
});

// ---------------------------------------------------------------------------
// suspiciousUserPatterns
// ---------------------------------------------------------------------------
describe('suspiciousUserPatterns', () => {
    test('pattern 0 matches "bot" case-insensitively', () => {
        expect(suspiciousUserPatterns[0].test('AutoBot')).toBe(true);
        expect(suspiciousUserPatterns[0].test('human')).toBe(false);
    });

    test('pattern 1 matches Word-Word1234 exactly', () => {
        expect(suspiciousUserPatterns[1].test('Cool-User1234')).toBe(true);
        // Fewer than 4 trailing digits should not match
        expect(suspiciousUserPatterns[1].test('Cool-User12')).toBe(false);
    });

    test('pattern 2 matches Word_Word12 to Word_Word9999', () => {
        expect(suspiciousUserPatterns[2].test('Red_Fox42')).toBe(true);
        expect(suspiciousUserPatterns[2].test('Red-Fox42')).toBe(true);
        // 5 digits is too many for this pattern
        expect(suspiciousUserPatterns[2].test('Red_Fox12345')).toBe(false);
    });

    test('pattern 3 matches alpha prefix with 4+ digits', () => {
        expect(suspiciousUserPatterns[3].test('Alpha9999')).toBe(true);
        expect(suspiciousUserPatterns[3].test('Alpha123')).toBe(false); // only 3 digits
    });

    test('pattern 4 matches user/redditor + 6+ digits (case-insensitive)', () => {
        expect(suspiciousUserPatterns[4].test('user123456')).toBe(true);
        expect(suspiciousUserPatterns[4].test('Redditor654321')).toBe(true);
        expect(suspiciousUserPatterns[4].test('user12345')).toBe(false); // only 5 digits
    });
});

// ---------------------------------------------------------------------------
// scamLinkRegex
// ---------------------------------------------------------------------------
describe('scamLinkRegex', () => {
    const spamTLDs = [
        '.live', '.life', '.shop', '.xyz', '.buzz', '.top', '.click',
        '.fun', '.site', '.online', '.store', '.blog', '.app',
        '.digital', '.network', '.cloud'
    ];

    spamTLDs.forEach(tld => {
        test(`matches spam TLD: ${tld}`, () => {
            expect(scamLinkRegex.test(`https://example${tld}/page`)).toBe(true);
        });
    });

    test('does not match legitimate TLDs', () => {
        expect(scamLinkRegex.test('https://example.com')).toBe(false);
        expect(scamLinkRegex.test('https://example.org')).toBe(false);
        expect(scamLinkRegex.test('https://example.net')).toBe(false);
        expect(scamLinkRegex.test('https://example.io')).toBe(false);
        expect(scamLinkRegex.test('https://example.gov')).toBe(false);
    });

    test('is case-insensitive', () => {
        expect(scamLinkRegex.test('https://spam.XYZ/hello')).toBe(true);
        expect(scamLinkRegex.test('https://spam.LIVE/hello')).toBe(true);
    });
});
