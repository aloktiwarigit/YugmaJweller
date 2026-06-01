// semgrep: goldsmith.no-try-on-direct-network should flag all occurrences below

// BAD: raw fetch inside a try-on component
// ruleid: goldsmith.no-try-on-direct-network
fetch('/api/v1/some-endpoint');

// BAD: XMLHttpRequest inside a try-on component
// ruleid: goldsmith.no-try-on-direct-network
new XMLHttpRequest();

// BAD: WebSocket inside a try-on component
// ruleid: goldsmith.no-try-on-direct-network
new WebSocket('wss://example.com');
