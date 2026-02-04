"""
Improved regex rules for PII pattern detection
"""

import re


# Strong PII patterns
STRONG_REGEX = {
    "EMAIL": re.compile(
        r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    ),
    "PHONE": re.compile(
        r'\b(?:\+?\d{1,3}[\s-]?)?\d{10}\b'
    ),
    "PAN": re.compile(
        r'\b[A-Z]{5}[0-9]{4}[A-Z]\b',
        re.IGNORECASE
    ),
    "AADHAAR": re.compile(
        r'\b\d{4}\s?\d{4}\s?\d{4}\b'
    ),
    "PASSPORT": re.compile(
        r'\b[A-Z]\d{7}\b',
        re.IGNORECASE
    ),
    "DRIVING_LICENSE": re.compile(
        r'\b[A-Z]{2}\d{13,14}\b',
        re.IGNORECASE
    ),
}


# Patterns that indicate example/dummy data
EXAMPLE_PATTERNS = [
    re.compile(r'example\.(?:com|org|net)', re.IGNORECASE),
    re.compile(r'test@', re.IGNORECASE),
    re.compile(r'dummy|sample|placeholder|fake', re.IGNORECASE),
    re.compile(r'1234567890'),  # Obviously fake phone
    re.compile(r'const\s+\w+\s*=', re.IGNORECASE),
    re.compile(r'let\s+\w+\s*=', re.IGNORECASE),
    re.compile(r'var\s+\w+\s*=', re.IGNORECASE),
]


def has_pii_pattern(text: str) -> bool:
    """
    Check if text contains any PII pattern.
    Returns True if PII-like pattern is found.
    """
    return any(pattern.search(text) for pattern in STRONG_REGEX.values())


def weak_regex_hit(text: str) -> bool:
    """
    Legacy function for backward compatibility.
    Same as has_pii_pattern.
    """
    return has_pii_pattern(text)


def has_example_marker(text: str) -> bool:
    """
    Check if text contains markers indicating it's example/dummy data.
    Returns True if example markers are found.
    """
    return any(pattern.search(text) for pattern in EXAMPLE_PATTERNS)


def get_pii_types(text: str) -> list:
    """
    Return list of PII types found in text.
    
    Returns:
        List of strings like ['EMAIL', 'PHONE']
    """
    found = []
    for pii_type, pattern in STRONG_REGEX.items():
        if pattern.search(text):
            found.append(pii_type)
    return found


def extract_pii_values(text: str) -> dict:
    """
    Extract actual PII values from text.
    
    Returns:
        Dict like {'EMAIL': ['user@domain.com'], 'PHONE': ['9876543210']}
    """
    results = {}
    for pii_type, pattern in STRONG_REGEX.items():
        matches = pattern.findall(text)
        if matches:
            results[pii_type] = matches
    return results


def is_real_pii(text: str) -> bool:
    """
    Determine if PII in text is likely real vs example/dummy.
    
    Returns:
        True if PII appears to be real (not example data)
    """
    # Has PII pattern
    if not has_pii_pattern(text):
        return False
    
    # But has example markers
    if has_example_marker(text):
        return False
    
    # Check for specific fake patterns
    text_lower = text.lower()
    
    # Common fake emails
    if re.search(r'test@|dummy@|sample@|fake@|example@', text_lower):
        return False
    
    # Obviously fake phone numbers
    if re.search(r'\b(?:1234567890|9999999999|0000000000)\b', text):
        return False
    
    # Otherwise, assume it's real
    return True


# For debugging/analysis
def analyze_text(text: str) -> dict:
    """
    Comprehensive analysis of text for PII.
    
    Returns detailed dict with all findings.
    """
    return {
        'has_pii': has_pii_pattern(text),
        'has_example_marker': has_example_marker(text),
        'is_real_pii': is_real_pii(text),
        'pii_types': get_pii_types(text),
        'pii_values': extract_pii_values(text),
    }


if __name__ == "__main__":
    # Test the regex patterns
    test_cases = [
        "my email is john@gmail.com",
        "use test@example.com for testing",
        "call me at 9876543210",
        "dummy phone 1234567890",
        "const email = 'user@example.org';",
        "my PAN is ABCDE1234F",
    ]
    
    print("Testing regex patterns:\n")
    for text in test_cases:
        analysis = analyze_text(text)
        print(f"Text: {text}")
        print(f"  Has PII: {analysis['has_pii']}")
        print(f"  Has Example: {analysis['has_example_marker']}")
        print(f"  Is Real: {analysis['is_real_pii']}")
        print(f"  Types: {analysis['pii_types']}")
        print()