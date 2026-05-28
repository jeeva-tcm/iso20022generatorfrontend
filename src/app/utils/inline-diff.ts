/**
 * Minimal line-level LCS diff — no dependencies.
 * Returns an array of DiffLine objects for rendering added/removed/unchanged lines.
 */

export type DiffLineType = 'unchanged' | 'added' | 'removed';

export interface DiffLine {
  type: DiffLineType;
  text: string;
}

/** Compute longest common subsequence lengths table. */
function lcsTable(a: string[], b: string[]): number[][] {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp;
}

/** Walk LCS table back to produce diff lines. */
function walkLcs(dp: number[][], a: string[], b: string[], i: number, j: number, out: DiffLine[]) {
  if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
    walkLcs(dp, a, b, i - 1, j - 1, out);
    out.push({ type: 'unchanged', text: a[i - 1] });
  } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
    walkLcs(dp, a, b, i, j - 1, out);
    out.push({ type: 'added', text: b[j - 1] });
  } else if (i > 0) {
    walkLcs(dp, a, b, i - 1, j, out);
    out.push({ type: 'removed', text: a[i - 1] });
  }
}

/**
 * Diff two XML strings line by line.
 * @param original  The original XML fragment.
 * @param modified  The proposed fixed XML fragment.
 * @returns Array of DiffLine — render removed as red, added as green, unchanged as normal.
 */
export function diffLines(original: string, modified: string): DiffLine[] {
  const a = original.split('\n');
  const b = modified.split('\n');

  // Guard: if fragments are huge, cap to avoid O(n²) freeze
  if (a.length > 200 || b.length > 200) {
    // Just show full remove + full add
    return [
      ...a.map(text => ({ type: 'removed' as DiffLineType, text })),
      ...b.map(text => ({ type: 'added' as DiffLineType, text })),
    ];
  }

  const dp = lcsTable(a, b);
  const out: DiffLine[] = [];
  walkLcs(dp, a, b, a.length, b.length, out);
  return out;
}

/** Returns true if there are any actual changes (not just all unchanged). */
export function hasChanges(diff: DiffLine[]): boolean {
  return diff.some(l => l.type !== 'unchanged');
}
