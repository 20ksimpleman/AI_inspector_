// Quick test for regex.js PII detection
eval(require('fs').readFileSync('regex.js', 'utf8'));

const d = new PIIDetector();

const tests = [
    // Should DETECT (previously failed)
    ["test@gmail.com", true, "Email (was wrongly excluded by /test@/i)"],
    ["john@gmail.com", true, "Email (real)"],
    ["SSN is 123-45-6789", true, "SSN"],
    ["card 4111111111111111", true, "Credit Card (test card BUT real format)"],
    ["192.168.1.1", true, "IP Address"],
    ["password: MySecret123", true, "Password disclosure"],

    // Should NOT detect (example data)
    ["test@example.com", false, "Example email (excluded)"],
    ["user@example.com", false, "Example email (excluded)"],

    // Should NOT detect (safe)
    ["hello world", false, "Safe text"],
    ["what is AI?", false, "Safe query"],
];

let passed = 0;
for (const [input, expectDetect, label] of tests) {
    const findings = d.detect(input);
    const detected = findings.length > 0;
    const ok = detected === expectDetect;
    passed += ok ? 1 : 0;
    const status = ok ? 'PASS' : 'FAIL';
    const found = findings.map(f => f.name).join(', ') || 'none';
    console.log(`[${status}] ${label}: "${input}" => ${found}`);
}
console.log(`\nResult: ${passed}/${tests.length} passed`);
