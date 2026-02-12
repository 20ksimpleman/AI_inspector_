# PII Regex Expansion - Patterns Missing from Backend

> **Purpose**: This document catalogs PII patterns that should be added to `regex_rules.py` for comprehensive detection.

---

## 📊 Current Coverage Analysis

| PII Type | Backend (`regex_rules.py`) | Frontend (`regex.js`) | Status |
|----------|---------------------------|----------------------|--------|
| Email | ✅ | ✅ | Complete |
| Phone | ✅ | ✅ | Complete |
| PAN (India) | ✅ | ❌ | Backend only |
| Aadhaar | ✅ | ✅ | Complete |
| Passport | ✅ | ❌ | Backend only |
| Driving License | ✅ | ❌ | Backend only |
| Credit Card | ❌ | ✅ | **Needs backend** |
| IP Address | ❌ | ✅ | **Needs backend** |
| SSN (US) | ❌ | ✅ | **Needs backend** |

---

## 🔴 HIGH PRIORITY - Add to Backend Immediately

### 1. Credit Card Numbers
```python
"CREDIT_CARD": re.compile(
    r'\b(?:4[0-9]{12}(?:[0-9]{3})?|'           # Visa
    r'5[1-5][0-9]{14}|'                         # MasterCard
    r'3[47][0-9]{13}|'                          # American Express
    r'6(?:011|5[0-9]{2})[0-9]{12}|'            # Discover
    r'(?:2131|1800|35\d{3})\d{11})\b'          # JCB
)
```
**Test cases:**
- `4111111111111111` → Visa ✓
- `5500000000000004` → MasterCard ✓
- `378282246310005` → Amex ✓

---

### 2. Social Security Number (US)
```python
"SSN": re.compile(
    r'\b(?!000|666|9\d{2})\d{3}[-\s]?(?!00)\d{2}[-\s]?(?!0000)\d{4}\b'
)
```
**Test cases:**
- `123-45-6789` ✓
- `123 45 6789` ✓
- `123456789` ✓

---

### 3. IP Addresses
```python
"IP_ADDRESS": re.compile(
    r'\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}'
    r'(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b'
)
```
**Test cases:**
- `192.168.1.1` ✓
- `10.0.0.255` ✓
- `256.1.1.1` ✗ (invalid, correctly rejected)

---

### 4. IPv6 Addresses
```python
"IPV6_ADDRESS": re.compile(
    r'\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b|'
    r'\b(?:[0-9a-fA-F]{1,4}:){1,7}:\b|'
    r'\b(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}\b'
)
```

---

## 🟠 MEDIUM PRIORITY - Financial & Secrets

### 5. Bank Account Numbers (India - IFSC + Account)
```python
"IFSC_CODE": re.compile(
    r'\b[A-Z]{4}0[A-Z0-9]{6}\b'
)

"BANK_ACCOUNT_IN": re.compile(
    r'\b\d{9,18}\b'  # Indian bank accounts: 9-18 digits
)
```
**Test cases:**
- `SBIN0001234` → IFSC ✓
- `1234567890123` → Account ✓

---

### 6. IBAN (International Bank Account Number)
```python
"IBAN": re.compile(
    r'\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}(?:[A-Z0-9]?){0,16}\b'
)
```
**Test cases:**
- `DE89370400440532013000` → Germany ✓
- `GB82WEST12345698765432` → UK ✓

---

### 7. API Keys & Secrets
```python
"AWS_ACCESS_KEY": re.compile(
    r'\b(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b'
)

"AWS_SECRET_KEY": re.compile(
    r'\b[A-Za-z0-9/+=]{40}\b'
)

"GITHUB_TOKEN": re.compile(
    r'\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,255}\b'
)

"OPENAI_API_KEY": re.compile(
    r'\bsk-[A-Za-z0-9]{48}\b'
)

"STRIPE_KEY": re.compile(
    r'\b(?:sk|pk)_(?:test|live)_[A-Za-z0-9]{24,}\b'
)

"GENERIC_API_KEY": re.compile(
    r'\b(?:api[_-]?key|apikey|secret[_-]?key)\s*[:=]\s*["\']?[A-Za-z0-9_\-]{20,}["\']?\b',
    re.IGNORECASE
)
```

---

### 8. Private Keys & Certificates
```python
"PRIVATE_KEY": re.compile(
    r'-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----'
)

"CERTIFICATE": re.compile(
    r'-----BEGIN CERTIFICATE-----'
)
```

---

## 🟡 MEDIUM PRIORITY - Personal Identifiers

### 9. Date of Birth Patterns
```python
"DATE_OF_BIRTH": re.compile(
    r'\b(?:0[1-9]|[12][0-9]|3[01])[-/.](?:0[1-9]|1[0-2])[-/.](?:19|20)\d{2}\b|'  # DD-MM-YYYY
    r'\b(?:19|20)\d{2}[-/.](?:0[1-9]|1[0-2])[-/.](?:0[1-9]|[12][0-9]|3[01])\b'   # YYYY-MM-DD
)
```

---

### 10. GST Number (India)
```python
"GSTIN": re.compile(
    r'\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}\b'
)
```
**Test cases:**
- `22AAAAA0000A1Z5` ✓

---

### 11. Voter ID (India)
```python
"VOTER_ID_IN": re.compile(
    r'\b[A-Z]{3}\d{7}\b'
)
```

---

### 12. Vehicle Registration (India)
```python
"VEHICLE_REG_IN": re.compile(
    r'\b[A-Z]{2}[-\s]?\d{1,2}[-\s]?[A-Z]{1,3}[-\s]?\d{4}\b'
)
```
**Test cases:**
- `MH12AB1234` ✓
- `DL-01-CA-0001` ✓

---

## 🔵 GLOBAL IDENTIFIERS

### 13. National Insurance Number (UK)
```python
"NIN_UK": re.compile(
    r'\b[A-CEGHJ-PR-TW-Z]{2}\d{6}[A-D]\b',
    re.IGNORECASE
)
```

---

### 14. Social Insurance Number (Canada)
```python
"SIN_CA": re.compile(
    r'\b\d{3}[-\s]?\d{3}[-\s]?\d{3}\b'
)
```

---

### 15. Tax File Number (Australia)
```python
"TFN_AU": re.compile(
    r'\b\d{3}[-\s]?\d{3}[-\s]?\d{3}\b'
)
```

---

### 16. Medicare Number (Australia)
```python
"MEDICARE_AU": re.compile(
    r'\b\d{4}[-\s]?\d{5}[-\s]?\d{1}\b'
)
```

---

### 17. CPF (Brazil)
```python
"CPF_BR": re.compile(
    r'\b\d{3}\.?\d{3}\.?\d{3}[-.]?\d{2}\b'
)
```

---

## 🟣 CONTACT & LOCATION

### 18. MAC Address
```python
"MAC_ADDRESS": re.compile(
    r'\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b'
)
```

---

### 19. GPS Coordinates
```python
"GPS_COORDINATES": re.compile(
    r'\b[-+]?(?:[1-8]?\d(?:\.\d+)?|90(?:\.0+)?)\s*,\s*[-+]?(?:180(?:\.0+)?|(?:1[0-7]\d|\d{1,2})(?:\.\d+)?)\b'
)
```

---

### 20. Indian PIN Code
```python
"PIN_CODE_IN": re.compile(
    r'\b[1-9][0-9]{5}\b'
)
```

---

### 21. US ZIP Code
```python
"ZIP_CODE_US": re.compile(
    r'\b\d{5}(?:-\d{4})?\b'
)
```

---

### 22. UK Postcode
```python
"POSTCODE_UK": re.compile(
    r'\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b',
    re.IGNORECASE
)
```

---

## 🔒 AUTHENTICATION CREDENTIALS

### 23. Password Patterns (Disclosure Detection)
```python
"PASSWORD_DISCLOSURE": re.compile(
    r'\b(?:password|passwd|pwd)\s*[:=]\s*["\']?[^\s"\']{6,}["\']?\b',
    re.IGNORECASE
)
```

---

### 24. JWT Tokens
```python
"JWT_TOKEN": re.compile(
    r'\beyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\b'
)
```

---

### 25. Bearer Tokens
```python
"BEARER_TOKEN": re.compile(
    r'\b[Bb]earer\s+[A-Za-z0-9_\-\.]+\b'
)
```

---

## 📋 Copy-Paste Ready Code Block

Add this to `regex_rules.py`:

```python
# Extended PII patterns - HIGH PRIORITY
EXTENDED_REGEX = {
    "CREDIT_CARD": re.compile(
        r'\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b'
    ),
    "SSN": re.compile(
        r'\b(?!000|666|9\d{2})\d{3}[-\s]?(?!00)\d{2}[-\s]?(?!0000)\d{4}\b'
    ),
    "IP_ADDRESS": re.compile(
        r'\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b'
    ),
    "AWS_ACCESS_KEY": re.compile(
        r'\b(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b'
    ),
    "GITHUB_TOKEN": re.compile(
        r'\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,255}\b'
    ),
    "OPENAI_API_KEY": re.compile(
        r'\bsk-[A-Za-z0-9]{48}\b'
    ),
    "PRIVATE_KEY": re.compile(
        r'-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----'
    ),
    "JWT_TOKEN": re.compile(
        r'\beyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\b'
    ),
    "GSTIN": re.compile(
        r'\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}\b'
    ),
    "IFSC_CODE": re.compile(
        r'\b[A-Z]{4}0[A-Z0-9]{6}\b'
    ),
    "VEHICLE_REG_IN": re.compile(
        r'\b[A-Z]{2}[-\s]?\d{1,2}[-\s]?[A-Z]{1,3}[-\s]?\d{4}\b'
    ),
}

# Merge with existing STRONG_REGEX
STRONG_REGEX.update(EXTENDED_REGEX)
```

---

## 🚫 Example Markers to Add

```python
# Additional example/dummy patterns
ADDITIONAL_EXAMPLE_PATTERNS = [
    re.compile(r'xxxx', re.IGNORECASE),
    re.compile(r'\*{4,}'),                    # Masked: ****
    re.compile(r'demo|sandbox', re.IGNORECASE),
    re.compile(r'your[_-]?(?:api|key)', re.IGNORECASE),
    re.compile(r'<[A-Z_]+>'),                 # Placeholders: <API_KEY>
    re.compile(r'\$\{[^}]+\}'),               # Template vars: ${API_KEY}
    re.compile(r'process\.env\.[A-Z_]+'),     # Node.js env vars
]
```

---

## 📈 Implementation Priority

| Priority | Patterns | Estimated False Positive Rate |
|----------|----------|------------------------------|
| 🔴 P0 | Credit Card, SSN, API Keys, Private Keys | Very Low |
| 🟠 P1 | IBAN, GSTIN, JWT, Bearer Tokens | Low |
| 🟡 P2 | IP Address, MAC Address, GPS | Medium (needs context) |
| 🔵 P3 | Global IDs (NIN, SIN, TFN) | Low |
| ⚪ P4 | ZIP/PIN codes, DOB | High (needs context filtering) |

---

## 🧪 Test Suite Addition

Add to `test_classifier.py`:

```python
EXTENDED_TEST_CASES = [
    # Credit Cards
    ("my card is 4111111111111111", True, ["CREDIT_CARD"]),
    ("test card 4111-1111-1111-1111", True, ["CREDIT_CARD"]),
    
    # API Keys
    ("api_key = AKIAIOSFODNN7EXAMPLE", True, ["AWS_ACCESS_KEY"]),
    ("token: ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", True, ["GITHUB_TOKEN"]),
    ("use sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", True, ["OPENAI_API_KEY"]),
    
    # Should NOT match (examples)
    ("example card 4111111111111111 for testing", False, []),
    ("const API_KEY = process.env.API_KEY", False, []),
]
```
