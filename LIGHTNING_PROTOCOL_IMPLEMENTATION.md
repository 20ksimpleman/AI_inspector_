# ⚡ Lightning Protocol: Two-Phase Implementation Plan
## Local-First PII Detection with Smart Server Fallback

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER INPUT                                   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 1: LOCAL DETECTION (Browser Extension)                      │
│  ─────────────────────────────────────────────                      │
│  • Deterministic regex rules                                        │
│  • Zero latency, zero network                                       │
│  • Handles 90% of cases                                             │
└─────────────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
            ▼                 ▼                 ▼
       [BLOCK]           [UNCERTAIN]        [ALLOW]
    100% Certain PII    Needs Analysis    No PII Found
         │                    │                 │
         │                    ▼                 │
         │    ┌───────────────────────────┐    │
         │    │  PHASE 2: SERVER CHECK    │    │
         │    │  ─────────────────────    │    │
         │    │  • Tokenize & compress    │    │
         │    │  • Encrypt & send         │    │
         │    │  • ML classification      │    │
         │    │  • Response in <20ms      │    │
         │    └───────────────────────────┘    │
         │                    │                 │
         ▼                    ▼                 ▼
    ⛔ BLOCKED           BLOCK/ALLOW         ✅ PASSED
```

---

# Phase 1: Local-Only Detection

## Goal
Block **100% certain** PII disclosures instantly in the browser with **zero network calls**.

---

## Detection Rules (Deterministic)

### Rule 1: Email Disclosure (BLOCK locally)
```javascript
// Pattern: Possessive pronoun + email address (not example domain)
const EMAIL_DISCLOSURE = {
    pattern: /\b(my|our|personal)\s+email\s+(is|:)?\s*[\w.+-]+@(?!example\.|test\.|dummy\.)\w+\.\w+/i,
    block: true,
    reason: "Personal email disclosure"
};
```

### Rule 2: Phone Disclosure (BLOCK locally)
```javascript
// Pattern: Contact verb + 10-digit number (not obviously fake)
const PHONE_DISCLOSURE = {
    pattern: /\b(call|reach|contact|text)\s+me\s+(at|on)\s*\+?\d{10,12}\b/i,
    exclude: /1234567890|9999999999|0000000000/,
    block: true,
    reason: "Phone number disclosure"
};
```

### Rule 3: Indian PII (BLOCK locally)
```javascript
// PAN with possessive context
const PAN_DISCLOSURE = {
    pattern: /\b(my|our)\s+(pan|PAN)\s+(number|no\.?|is)?\s*:?\s*[A-Z]{5}\d{4}[A-Z]\b/i,
    block: true,
    reason: "PAN number disclosure"
};

// Aadhaar with possessive context  
const AADHAAR_DISCLOSURE = {
    pattern: /\b(my|our)\s+(aadhaar|aadhar)\s+(number|no\.?|is)?\s*:?\s*\d{4}\s?\d{4}\s?\d{4}\b/i,
    block: true,
    reason: "Aadhaar number disclosure"
};
```

### Rule 4: Direct Contact Sharing (BLOCK locally)
```javascript
// Explicit contact sharing intent
const CONTACT_SHARE = {
    pattern: /\b(here'?s?|this is)\s+(my|our)\s+(contact|number|email|phone)/i,
    followedBy: /[\w.+-]+@[\w.-]+\.\w+|\d{10}/,  // Must have actual PII after
    block: true,
    reason: "Direct contact sharing"
};
```

---

## Phase 1 File Structure

```
textCapture_logic/
├── core/
│   ├── rules.js           # [NEW] Deterministic blocking rules
│   ├── detector.js        # [NEW] Local PII detector engine
│   └── blocker.js         # [MODIFY] Enhanced blocking logic
├── utils/
│   ├── patterns.js        # [MODIFY] Expanded regex patterns
│   └── normalizer.js      # [NEW] Text normalization (unicode, leetspeak)
├── userscript.user.js     # [MODIFY] Main entry point
└── manifest.json          # [NEW] If converting to Chrome extension
```

---

## Phase 1 Implementation

### [NEW] `core/rules.js`
```javascript
// Deterministic rules for 100% certain PII
export const BLOCK_RULES = [
    {
        id: 'email_disclosure',
        name: 'Email Disclosure',
        detect: (text) => {
            const hasIntent = /\b(my|our|personal)\s+(email|mail)\s+(is|address|:)/i.test(text);
            const hasEmail = /[\w.+-]+@(?!example\.|test\.|dummy\.)[\w.-]+\.\w+/i.test(text);
            const isExample = /(example|test|dummy|sample|fake)/i.test(text);
            return hasIntent && hasEmail && !isExample;
        },
        severity: 'CRITICAL'
    },
    {
        id: 'phone_disclosure', 
        name: 'Phone Disclosure',
        detect: (text) => {
            const hasIntent = /\b(call|reach|contact|text|phone)\s+me\s+(at|on)/i.test(text);
            const hasPhone = /\b\d{10}\b/.test(text);
            const isFake = /1234567890|9999999999|0000000000/.test(text);
            return hasIntent && hasPhone && !isFake;
        },
        severity: 'CRITICAL'
    },
    {
        id: 'pan_disclosure',
        name: 'PAN Disclosure', 
        detect: (text) => {
            const hasIntent = /\b(my|our)\s+(pan)/i.test(text);
            const hasPAN = /\b[A-Z]{5}\d{4}[A-Z]\b/i.test(text);
            const isExample = /(example|sample|format|dummy)/i.test(text);
            return hasIntent && hasPAN && !isExample;
        },
        severity: 'CRITICAL'
    },
    {
        id: 'aadhaar_disclosure',
        name: 'Aadhaar Disclosure',
        detect: (text) => {
            const hasIntent = /\b(my|our)\s+(aadhaar|aadhar)/i.test(text);
            const hasAadhaar = /\b\d{4}\s?\d{4}\s?\d{4}\b/.test(text);
            return hasIntent && hasAadhaar;
        },
        severity: 'CRITICAL'
    }
];

// Patterns that indicate UNCERTAIN (send to server)
export const UNCERTAIN_PATTERNS = [
    /[\w.+-]+@[\w.-]+\.\w+/i,  // Email without clear intent
    /\b\d{10}\b/,              // Phone without clear intent
    /\b[A-Z]{5}\d{4}[A-Z]\b/i, // PAN without clear intent
];
```

---

### [NEW] `core/detector.js`
```javascript
import { BLOCK_RULES, UNCERTAIN_PATTERNS } from './rules.js';

export class LocalDetector {
    /**
     * Analyze text and return decision
     * @returns {Object} { decision: 'BLOCK'|'UNCERTAIN'|'ALLOW', rule?: string, reason?: string }
     */
    analyze(text) {
        // Normalize text (handle unicode tricks, leetspeak)
        const normalized = this.normalize(text);
        
        // Check BLOCK rules first (100% certain)
        for (const rule of BLOCK_RULES) {
            if (rule.detect(normalized)) {
                return {
                    decision: 'BLOCK',
                    rule: rule.id,
                    reason: rule.name,
                    severity: rule.severity,
                    requiresServer: false
                };
            }
        }
        
        // Check if has PII patterns but uncertain intent
        const hasPIIPattern = UNCERTAIN_PATTERNS.some(p => p.test(normalized));
        if (hasPIIPattern) {
            return {
                decision: 'UNCERTAIN',
                requiresServer: true,
                patterns: this.extractPatterns(normalized)
            };
        }
        
        // No PII detected
        return {
            decision: 'ALLOW',
            requiresServer: false
        };
    }
    
    normalize(text) {
        return text
            .normalize('NFKC')                    // Unicode normalization
            .replace(/[аеіоруАЕІОРУ]/g, match => // Cyrillic → Latin
                ({а:'a',е:'e',і:'i',о:'o',р:'p',у:'y',
                  А:'A',Е:'E',І:'I',О:'O',Р:'P',У:'Y'}[match] || match))
            .replace(/0/g, 'o').replace(/1/g, 'l') // Leetspeak basics
            .replace(/3/g, 'e').replace(/4/g, 'a');
    }
    
    extractPatterns(text) {
        const patterns = [];
        UNCERTAIN_PATTERNS.forEach((pattern, i) => {
            const match = text.match(pattern);
            if (match) patterns.push({ type: i, value: match[0] });
        });
        return patterns;
    }
}
```

---

### [MODIFY] `userscript.user.js`
```javascript
// ==UserScript==
// @name         AI Inspector - PII Shield
// @match        https://chat.openai.com/*
// @match        https://gemini.google.com/*
// @match        https://claude.ai/*
// @grant        none
// ==/UserScript==

import { LocalDetector } from './core/detector.js';
import { ServerClient } from './network/client.js';  // Phase 2

const detector = new LocalDetector();
let serverClient = null;  // Lazy init for Phase 2

document.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    
    const input = document.querySelector('textarea, [contenteditable="true"]');
    if (!input) return;
    
    const text = input.value || input.innerText;
    if (!text?.trim()) return;
    
    // PHASE 1: Local detection
    const result = detector.analyze(text);
    
    if (result.decision === 'BLOCK') {
        // 🛑 Immediate block - no server needed
        e.preventDefault();
        e.stopPropagation();
        showBlockAlert(result.reason);
        logEvent('BLOCK_LOCAL', result);
        return false;
    }
    
    if (result.decision === 'UNCERTAIN') {
        // ⏳ PHASE 2: Send to server for ML analysis
        e.preventDefault();
        e.stopPropagation();
        
        const serverDecision = await checkWithServer(text, result.patterns);
        if (serverDecision.decision === 'BLOCK') {
            showBlockAlert(serverDecision.reason);
            logEvent('BLOCK_SERVER', serverDecision);
            return false;
        }
        
        // Server says ALLOW - let it through
        submitMessage(input);
    }
    
    // ALLOW - do nothing, let submission proceed
}, true);
```

---

# Phase 2: Server Communication

## Goal
For **uncertain cases**, send tokenized + compressed + encrypted data to server for ML classification in **<20ms**.

---

## Phase 2 File Structure

```
textCapture_logic/
├── network/
│   ├── client.js          # [NEW] WebSocket client
│   ├── tokenizer.js       # [NEW] Text tokenization
│   ├── compressor.js      # [NEW] MessagePack + LZ4
│   └── crypto.js          # [NEW] AES-GCM encryption
├── config/
│   └── vocab.json         # [NEW] Shared vocabulary (synced)
└── ...

security_engine/
├── server/
│   ├── app.py             # [NEW] FastAPI WebSocket server
│   ├── protocol.py        # [NEW] Message protocol handler
│   └── classifier_api.py  # [NEW] ML classifier endpoint
└── ...
```

---

## Tokenization Protocol

### [NEW] `network/tokenizer.js`
```javascript
// Shared vocabulary - synchronized with server
const VOCAB = {
    // Intent words
    "my": 1, "our": 2, "personal": 3,
    "email": 10, "phone": 11, "number": 12, "pan": 13, "aadhaar": 14,
    "is": 20, "call": 21, "contact": 22, "reach": 23,
    "me": 30, "at": 31, "on": 32,
    // Special tokens
    "<EMAIL>": 100, "<PHONE>": 101, "<PAN>": 102, "<AADHAAR>": 103,
    "<UNK>": 0
};

export class Tokenizer {
    tokenize(text) {
        // Extract PII patterns and replace with special tokens
        let processed = text;
        const extracted = {};
        
        // Extract emails
        const emails = text.match(/[\w.+-]+@[\w.-]+\.\w+/gi) || [];
        emails.forEach((email, i) => {
            extracted[`email_${i}`] = email;
            processed = processed.replace(email, '<EMAIL>');
        });
        
        // Extract phones
        const phones = text.match(/\b\d{10}\b/g) || [];
        phones.forEach((phone, i) => {
            extracted[`phone_${i}`] = phone;
            processed = processed.replace(phone, '<PHONE>');
        });
        
        // Tokenize remaining text
        const words = processed.toLowerCase().split(/\s+/);
        const tokens = words.map(w => VOCAB[w] || VOCAB["<UNK>"]);
        
        return {
            tokens: tokens,           // [1, 10, 20, 100] - tiny!
            extracted: extracted,     // {"email_0": "john@gmail.com"}
            length: text.length
        };
    }
}
```

---

## Compression

### [NEW] `network/compressor.js`
```javascript
import msgpack from 'msgpack-lite';

export class Compressor {
    compress(data) {
        // MessagePack: JSON → Binary (50% smaller)
        const packed = msgpack.encode(data);
        
        // For very small payloads, skip LZ4 (overhead not worth it)
        if (packed.length < 50) {
            return { compressed: false, data: packed };
        }
        
        // LZ4 compression for larger payloads
        const compressed = this.lz4Compress(packed);
        return { compressed: true, data: compressed };
    }
    
    decompress(payload) {
        let data = payload.data;
        if (payload.compressed) {
            data = this.lz4Decompress(data);
        }
        return msgpack.decode(data);
    }
    
    // Simple LZ4-like compression (or use lz4js library)
    lz4Compress(data) { /* implementation */ }
    lz4Decompress(data) { /* implementation */ }
}
```

---

## Encryption

### [NEW] `network/crypto.js`
```javascript
export class CryptoHandler {
    constructor(serverPublicKey) {
        this.serverKey = serverPublicKey;
        this.sessionKey = null;
    }
    
    async initSession() {
        // Generate session key (done once per session)
        this.sessionKey = await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
        
        // Exchange session key with server (RSA encrypted)
        // ... key exchange protocol
    }
    
    async encrypt(data) {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            this.sessionKey,
            data
        );
        
        return {
            iv: Array.from(iv),
            ciphertext: Array.from(new Uint8Array(encrypted))
        };
    }
    
    async decrypt(payload) {
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: new Uint8Array(payload.iv) },
            this.sessionKey,
            new Uint8Array(payload.ciphertext)
        );
        return decrypted;
    }
}
```

---

## WebSocket Client

### [NEW] `network/client.js`
```javascript
import { Tokenizer } from './tokenizer.js';
import { Compressor } from './compressor.js';
import { CryptoHandler } from './crypto.js';

export class ServerClient {
    constructor(serverUrl) {
        this.serverUrl = serverUrl;
        this.ws = null;
        this.tokenizer = new Tokenizer();
        this.compressor = new Compressor();
        this.crypto = new CryptoHandler();
        this.pendingRequests = new Map();
    }
    
    async connect() {
        this.ws = new WebSocket(this.serverUrl);
        await this.crypto.initSession();
        
        this.ws.onmessage = (event) => this.handleResponse(event);
    }
    
    async classify(text, patterns) {
        const requestId = this.generateId();
        
        // Step 1: Tokenize
        const tokenized = this.tokenizer.tokenize(text);
        
        // Step 2: Compress
        const compressed = this.compressor.compress(tokenized);
        
        // Step 3: Encrypt
        const encrypted = await this.crypto.encrypt(compressed.data);
        
        // Step 4: Send
        const packet = {
            id: requestId,
            v: 1,  // protocol version
            c: compressed.compressed ? 1 : 0,
            payload: encrypted
        };
        
        this.ws.send(msgpack.encode(packet));
        
        // Step 5: Wait for response (with timeout)
        return this.waitForResponse(requestId, 50);  // 50ms timeout
    }
    
    waitForResponse(requestId, timeoutMs) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                resolve({ decision: 'ALLOW', reason: 'timeout' });  // Fail open
            }, timeoutMs);
            
            this.pendingRequests.set(requestId, { resolve, timeout });
        });
    }
    
    async handleResponse(event) {
        const packet = msgpack.decode(event.data);
        const decrypted = await this.crypto.decrypt(packet.payload);
        const response = this.compressor.decompress(decrypted);
        
        const pending = this.pendingRequests.get(packet.id);
        if (pending) {
            clearTimeout(pending.timeout);
            pending.resolve(response);
            this.pendingRequests.delete(packet.id);
        }
    }
}
```

---

## Server Implementation

### [NEW] `security_engine/server/app.py`
```python
from fastapi import FastAPI, WebSocket
import msgpack
import asyncio
from .protocol import ProtocolHandler
from .classifier_api import PIIClassifierAPI

app = FastAPI()
classifier = PIIClassifierAPI()
protocol = ProtocolHandler()

@app.websocket("/ws/classify")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    try:
        while True:
            # Receive binary message
            data = await websocket.receive_bytes()
            
            # Decode packet
            packet = msgpack.unpackb(data)
            request_id = packet['id']
            
            # Decrypt and decompress
            payload = await protocol.decrypt_and_decompress(packet)
            
            # Classify using ML model
            result = classifier.classify(
                tokens=payload['tokens'],
                extracted=payload['extracted']
            )
            
            # Encrypt and compress response
            response = await protocol.encrypt_and_compress({
                'id': request_id,
                'decision': result['decision'],
                'confidence': result['confidence'],
                'reason': result.get('reason', '')
            })
            
            await websocket.send_bytes(response)
            
    except Exception as e:
        await websocket.close()
```

---

## Performance Summary

| Stage | Time | Data Size |
|-------|------|-----------|
| Local detection | 1ms | - |
| Tokenization | 0.5ms | 500B → 50B |
| Compression | 0.3ms | 50B → 30B |
| Encryption | 0.2ms | +28B overhead |
| Network (WebSocket) | 10-15ms | 60B |
| Server ML | 5ms | - |
| **Total (server path)** | **~20ms** | **~60 bytes** |

---

## Verification Plan

### Phase 1 Tests
```javascript
// Test cases for local blocking
const tests = [
    { input: "my email is john@gmail.com", expected: "BLOCK" },
    { input: "call me at 9876543210", expected: "BLOCK" },
    { input: "my PAN is ABCDE1234F", expected: "BLOCK" },
    { input: "use test@example.com", expected: "ALLOW" },
    { input: "john@gmail.com", expected: "UNCERTAIN" },  // No intent
];
```

### Phase 2 Tests
```javascript
// Test server response time
const results = await Promise.all(
    uncertainCases.map(c => measureLatency(() => client.classify(c)))
);
assert(results.every(r => r.latency < 50));  // All under 50ms
```

---

*Document Created: 2026-02-04*
*Last Updated: 2026-02-04*
