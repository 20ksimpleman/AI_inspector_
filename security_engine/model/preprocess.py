import re

EXAMPLE_WORDS = {
    "example", "sample", "dummy", "test", "placeholder", "documentation",
    "demo", "mock", "fake", "tutorial", "template", "illustration"
}

DISCLOSURE_WORDS = {
    "my", "mine", "me", "i am", "i'm"
}

CONTACT_VERBS = {
    "contact", "call", "reach", "email", "text", "phone"
}

CODE_MARKERS = {
    "const", "let", "var", "def", "class", "function", "import",
    "regex", "pattern", "format", "validate", "return"
}


def preprocess_for_ml(text: str) -> str:
    """
    Enhanced preprocessing with context flags.
    
    Flags:
    - CTX_EXAMPLE: Contains example/dummy markers
    - CTX_DISCLOSURE: Contains first-person + PII reference
    - CTX_CONTACT: Contains contact request verbs
    - CTX_CODE: Contains code/technical markers
    - CTX_QUESTION: Is asking a question
    """
    text_lower = text.lower()
    flags = []
    
    # Check for example/dummy context
    if any(w in text_lower for w in EXAMPLE_WORDS):
        flags.append("CTX_EXAMPLE")
    
    # Check for first-person disclosure
    # More sophisticated: look for "my [pii_type]" patterns
    has_first_person = any(w in text_lower for w in DISCLOSURE_WORDS)
    has_pii_reference = bool(re.search(
        r'\b(?:email|phone|pan|aadhaar|passport|license|number|address|contact|name)\b',
        text_lower
    ))
    
    if has_first_person and has_pii_reference:
        flags.append("CTX_DISCLOSURE")
    
    # Check for contact request
    if any(verb in text_lower for verb in CONTACT_VERBS):
        # But distinguish "call me at X" from "call me maybe"
        if re.search(r'\b(?:call|contact|reach|email|text)\s+me\s+(?:at|on)\b', text_lower):
            flags.append("CTX_CONTACT")
    
    if any(marker in text_lower for marker in CODE_MARKERS):
        flags.append("CTX_CODE")
    
    if '?' in text or any(text_lower.startswith(q) for q in ['what', 'how', 'why', 'when', 'where', 'who', 'explain', 'tell', 'describe']):
        flags.append("CTX_QUESTION")
    
    return " ".join(flags + [text])


def extract_features_dict(text: str) -> dict:
    text_lower = text.lower()
    features = {
        'has_example_marker': any(w in text_lower for w in EXAMPLE_WORDS),
        'has_disclosure_pattern': bool(re.search(r'\bmy\s+(?:email|phone|pan|number)', text_lower)),
        'has_contact_request': bool(re.search(r'\b(?:call|contact|reach)\s+me\s+(?:at|on)', text_lower)),
        'has_code_marker': any(m in text_lower for m in CODE_MARKERS),
        'is_question': '?' in text or text_lower.startswith(('what', 'how', 'why', 'explain')),
        'has_email_pattern': bool(re.search(r'\b[\w.+-]+@[\w.-]+\.\w+\b', text)),
        'has_phone_pattern': bool(re.search(r'\b\d{10}\b', text)),
        'has_pan_pattern': bool(re.search(r'\b[A-Z]{5}\d{4}[A-Z]\b', text)),
        'text_length': len(text),
        'word_count': len(text.split()),
    }
    
    return features