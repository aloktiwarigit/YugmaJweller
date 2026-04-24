// Code 128 Set B encoder — pure JS, no native dependencies.
// Encodes ASCII 32–126. Returns alternating bar/space widths (first element is a bar).
// Each code symbol has 6 elements (3 bars + 3 spaces); stop pattern has 7 + terminator.

const PATTERNS: readonly number[][] = [
  [2,1,2,2,2,2],[2,2,2,1,2,2],[2,2,2,2,2,1],[1,2,1,2,2,3],[1,2,1,3,2,2], //  0- 4
  [1,3,1,2,2,2],[1,2,2,2,1,3],[1,2,2,3,1,2],[1,3,2,2,1,2],[2,2,1,2,1,3], //  5- 9
  [2,2,1,3,1,2],[2,3,1,2,1,2],[1,1,2,2,3,2],[1,2,2,1,3,2],[1,2,2,2,3,1], // 10-14
  [1,1,3,2,2,2],[1,2,3,1,2,2],[1,2,3,2,2,1],[2,2,3,2,1,1],[2,2,1,1,3,2], // 15-19
  [2,2,1,2,3,1],[2,1,3,2,1,2],[2,2,3,1,1,2],[3,1,2,1,3,1],[3,1,1,2,2,2], // 20-24
  [3,2,1,1,2,2],[3,2,1,2,2,1],[3,1,2,2,1,2],[3,2,2,1,1,2],[3,2,2,2,1,1], // 25-29
  [2,1,2,1,2,3],[2,1,2,3,2,1],[2,3,2,1,2,1],[1,1,1,3,2,3],[1,3,1,1,2,3], // 30-34
  [1,3,1,3,2,1],[1,1,2,3,1,3],[1,3,2,1,1,3],[1,3,2,3,1,1],[2,1,1,3,1,3], // 35-39
  [2,3,1,1,1,3],[2,3,1,3,1,1],[1,1,2,1,3,3],[1,1,2,3,3,1],[1,3,2,1,3,1], // 40-44
  [1,1,3,1,2,3],[1,1,3,3,2,1],[1,3,3,1,2,1],[3,1,3,1,2,1],[2,1,1,3,3,1], // 45-49
  [2,3,1,1,3,1],[2,1,3,1,1,3],[2,1,3,3,1,1],[2,1,3,1,3,1],[3,1,1,1,2,3], // 50-54
  [3,1,1,3,2,1],[3,3,1,1,2,1],[3,1,2,1,1,3],[3,1,2,3,1,1],[3,3,2,1,1,1], // 55-59
  [3,1,4,1,1,1],[2,2,1,4,1,1],[4,3,1,1,1,1],[1,1,1,2,2,4],[1,1,1,4,2,2], // 60-64
  [1,2,1,1,2,4],[1,2,1,4,2,1],[1,4,1,1,2,2],[1,4,1,2,2,1],[1,1,2,2,1,4], // 65-69
  [1,1,2,4,1,2],[1,2,2,1,1,4],[1,2,2,4,1,1],[1,4,2,1,1,2],[1,4,2,2,1,1], // 70-74
  [2,4,1,2,1,1],[2,2,1,1,1,4],[4,1,3,1,1,1],[2,4,1,1,1,2],[1,3,4,1,1,1], // 75-79
  [1,1,1,2,4,2],[1,2,1,1,4,2],[1,2,1,2,4,1],[1,1,4,2,1,2],[1,2,4,1,1,2], // 80-84
  [1,2,4,2,1,1],[4,1,1,2,1,2],[4,2,1,1,1,2],[4,2,1,2,1,1],[2,1,2,1,4,1], // 85-89
  [2,1,4,1,2,1],[4,1,2,1,1,2],[1,1,2,1,2,4],[4,1,2,2,1,1],[1,1,4,2,3,1], // 90-94
  [1,1,2,1,4,2],[1,4,1,2,1,2],[1,1,2,2,4,1],[2,2,4,1,1,1],[1,2,4,1,2,1], // 95-99
  [4,1,1,2,3,1],[4,1,1,3,2,1],[1,1,1,4,4,1],                               // 100-102
  [2,1,1,4,1,2], // 103 Start A
  [2,1,1,2,1,4], // 104 Start B
  [2,1,1,2,3,2], // 105 Start C
  [2,3,3,1,1,1], // 106 Stop (followed by 2-unit terminator bar)
];

const START_B = 104;
const STOP = 106;

export interface Code128Result {
  /** Alternating bar/space widths in module units. Element 0 is always a bar. */
  widths: number[];
  /** Total module width (excluding quiet zones). */
  totalModules: number;
}

export function encodeCode128B(text: string): Code128Result {
  const codeValues: number[] = [];

  for (let i = 0; i < text.length; i++) {
    const cp = text.charCodeAt(i);
    if (cp < 32 || cp > 126) {
      throw new Error(`Character '${text[i]}' (U+${cp.toString(16).padStart(4,'0')}) is not in Code 128 Set B`);
    }
    codeValues.push(cp - 32);
  }

  // Checksum: (startB + sum(value * (position+1))) % 103
  let checksum = START_B;
  for (let i = 0; i < codeValues.length; i++) {
    checksum += (codeValues[i] as number) * (i + 1);
  }
  checksum = checksum % 103;

  const widths: number[] = [];

  // Quiet zone: 10 modules (represented as leading space — callers may add it)
  // Start B
  for (const w of PATTERNS[START_B] as number[]) widths.push(w);
  // Data
  for (const v of codeValues) {
    for (const w of PATTERNS[v] as number[]) widths.push(w);
  }
  // Check symbol
  for (const w of PATTERNS[checksum] as number[]) widths.push(w);
  // Stop + 2-unit terminator bar
  for (const w of PATTERNS[STOP] as number[]) widths.push(w);
  widths.push(2); // terminator bar

  const totalModules = widths.reduce((a, b) => a + b, 0);
  return { widths, totalModules };
}
