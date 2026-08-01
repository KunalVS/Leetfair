/**
 * Code similarity via the **winnowing** fingerprinting algorithm
 * (Schleimer, Wilkerson, Aiken — "Winnowing: Local Algorithms for Document
 * Fingerprinting", SIGMOD 2003).
 *
 * Why winnowing instead of a naive "copy-paste equals" check?
 *  - It is resilient to whitespace/case re-formatting and to comments.
 *  - It guarantees that any sufficiently long identical substring is
 *    detected, even when a cheater renames variables or re-indents.
 *  - Fingerprints are small, so pairwise comparison is cheap.
 *
 * Pipeline:
 *   1. normalize   -> strip whitespace/punctuation/case from the code
 *   2. k-grams     -> every substring of length k of the normalized text
 *   3. hash        -> stable integer hash per k-gram
 *   4. winnow      -> in each sliding window of w hashes keep only the
 *                     minimum; nearby matches collapse to the same fingerprint
 *   5. compare     -> overlap coefficient of two fingerprint sets
 */
/** Normalize code: lowercase alphanumerics only. Keeps token content intact. */
export function normalizeCode(code) {
    return code
        .replace(/[^a-zA-Z0-9]+/g, '')
        .toLowerCase();
}
/** Stable 32-bit hash (FNV-1a). Deterministic across restarts and languages. */
export function hash32(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}
/** All k-grams of the normalized text as hashes. */
export function kgramHashes(text, k = 6) {
    const hashes = [];
    for (let i = 0; i + k <= text.length; i++) {
        hashes.push(hash32(text.slice(i, i + k)));
    }
    return hashes;
}
/**
 * Winnowing: slide a window of `w` hashes across the k-gram list and keep the
 * leftmost minimum in each window. Returns a de-duplicated set of fingerprints.
 */
export function winnow(hashes, w = 4) {
    const fingerprints = new Set();
    if (hashes.length === 0)
        return fingerprints;
    for (let i = 0; i + w <= hashes.length; i++) {
        let minIdx = i;
        for (let j = i; j < i + w; j++) {
            if (hashes[j] < hashes[minIdx])
                minIdx = j;
        }
        fingerprints.add(hashes[minIdx]);
    }
    // Tail windows (< w) still contribute their minimum.
    if (hashes.length < w)
        fingerprints.add(Math.min(...hashes));
    return fingerprints;
}
/** Produce the full fingerprint set for a piece of code. */
export function fingerprint(code, k = 6, w = 4) {
    return winnow(kgramHashes(normalizeCode(code), k), w);
}
/**
 * Minimum fingerprint count before similarity is meaningful. Very short code
 * fragments yield few fingerprints, so a single coincidental k-gram can
 * inflate the overlap coefficient to ~0.2+ for unrelated snippets. Below this
 * threshold there simply isn't enough signal to compare — return 0.
 */
export const MIN_FINGERPRINTS = 8;
/**
 * Overlap coefficient between two fingerprint sets in [0, 1]:
 *   |A ∩ B| / min(|A|, |B|)
 * This measures *containment* — one codebase copied inside another — rather
 * than symmetric Jaccard similarity, which better matches the cheat scenario
 * (a full solution pasted as part of a larger file).
 */
export function overlapCoefficient(a, b) {
    if (a.size === 0 || b.size === 0)
        return 0;
    if (Math.min(a.size, b.size) < MIN_FINGERPRINTS)
        return 0; // too little signal
    let shared = 0;
    const [small, large] = a.size <= b.size ? [a, b] : [b, a];
    for (const h of small) {
        if (large.has(h))
            shared++;
    }
    return shared / small.size;
}
/** Convenience: full fingerprint -> compare -> score in one call. */
export function similarityBetween(codeA, codeB) {
    return overlapCoefficient(fingerprint(codeA), fingerprint(codeB));
}
//# sourceMappingURL=similarity.js.map