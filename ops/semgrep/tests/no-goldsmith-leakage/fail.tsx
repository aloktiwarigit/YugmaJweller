// semgrep: goldsmith.no-goldsmith-leakage should flag all occurrences below

// BAD: platform brand in JSX text
export function BadFooter() {
  return (
    <footer>
      <p>Goldsmith — आभूषण प्लेटफॉर्म</p>
    </footer>
  );
}

// BAD: platform brand in string literal
const brandName = 'Goldsmith';

// BAD: platform brand in template literal
const meta = `Powered by Goldsmith`;

// BAD: platform brand in object literal
const config = { poweredBy: 'Goldsmith' };
