import json
import re
from datasets import load_dataset

DATASET_NAME = "Josephgflowers/PII-NER"
OUTPUT_FILE = "train.txt"


def has_pii(assistant_json: str) -> bool:
    try:
        data = json.loads(assistant_json)
        return any(isinstance(v, list) and len(v) > 0 for v in data.values())
    except:
        return False

def extract_pii_entities(assistant_json: str) -> dict:
    try:
        return json.loads(assistant_json)
    except:
        return {}


def is_example_context(text: str) -> bool:
    text_lower = text.lower()
    markers = [
        'example.org', 'example.com', 'test@', 'sample', 'dummy', 
        'documentation', 'tutorial', 'const ', 'let ', 'var ',
        'def ', 'function ', 'regex', 'format:'
    ]
    return any(marker in text_lower for marker in markers)


def has_disclosure_intent(text: str) -> bool:
    text_lower = text.lower()
    disclosure_patterns = [
        r'\bmy\s+(?:email|phone|pan|aadhaar|passport|license|number|address)\s+(?:is|:)',
        r'\bcall\s+me\s+(?:at|on)',
        r'\bcontact\s+me\s+(?:at|on|via)',
        r'\breach\s+me\s+(?:at|on|via)',
        r'\bemail\s+me\s+at',
        r'\btext\s+me\s+at',
    ]
    
    return any(re.search(pattern, text_lower) for pattern in disclosure_patterns)


def create_synthetic_disclosure(text: str, pii_data: dict) -> list:
    disclosures = []
    disclosure_patterns = [
        (r'my\s+email\s+is\s+[\w.+-]+@[\w.-]+\.\w+', 'email disclosure'),
        (r'my\s+phone\s+number\s+is\s+\d+', 'phone disclosure'),
        (r'call\s+me\s+at\s+\d+', 'call request'),
        (r'my\s+pan\s+number\s+\w+', 'pan disclosure'),
        (r'contact\s+me\s+at\s+[\w.+-]+@[\w.-]+\.\w+', 'contact request'),
    ]
    
    for pattern, label_type in disclosure_patterns:
        matches = re.finditer(pattern, text.lower())
        for match in matches:
            phrase = text[match.start():match.end()]
            disclosures.append((phrase, label_type))
    
    if pii_data.get('EMAIL'):
        for email in pii_data['EMAIL']:
            disclosures.append((f"my email is {email}", "synthetic"))
    
    if pii_data.get('PHONE_NUM'):
        for phone in pii_data['PHONE_NUM']:
            disclosures.append((f"call me at {phone}", "synthetic"))
            disclosures.append((f"you can reach me on {phone}", "synthetic"))
    
    if pii_data.get('PAN_NUMBER'):
        for pan in pii_data['PAN_NUMBER']:
            disclosures.append((f"my PAN number is {pan}", "synthetic"))
    
    return disclosures


def create_non_disclosure_examples(text: str, pii_data: dict) -> list:
    examples = []
    if pii_data.get('EMAIL'):
        for email in pii_data['EMAIL']:
            if 'example' in email.lower():
                examples.append(f"use {email} in the documentation")
                examples.append(f"test with {email}")
    
    if pii_data.get('PAN_NUMBER'):
        examples.append("explain what a PAN number is")
        examples.append("what is the format of a PAN number")
    
    if pii_data.get('PHONE_NUM'):
        examples.append("what does a phone number look like")
        examples.append("how to format phone numbers")
    
    if pii_data.get('EMAIL'):
        examples.append("what is an email address")
        examples.append("explain email format")
    
    return examples


def build_balanced_dataset():
    
    print("Loading dataset...")
    ds = load_dataset(DATASET_NAME)
    
    disclosure_examples = []
    non_disclosure_examples = []
    
    for idx, row in enumerate(ds["train"]):
        text = row["user"]
        assistant = row["assistant"]
        pii_data = extract_pii_entities(assistant)
        has_any_pii = has_pii(assistant)
        if not has_any_pii:
            non_disclosure_examples.append(text)
        
        elif is_example_context(text):
            non_disclosure_examples.append(text)
        
        else:
            if idx % 3 == 0:  
                non_disclosure_examples.append(text)
    
            disclosures = create_synthetic_disclosure(text, pii_data)
            for disclosure_text, _ in disclosures:
                disclosure_examples.append(disclosure_text)
            
            non_disc = create_non_disclosure_examples(text, pii_data)
            non_disclosure_examples.extend(non_disc)
    
    print(f"\nWriting dataset...")
    
    with open(OUTPUT_FILE, "w", encoding="utf-8") as fout:
        for text in disclosure_examples:
            fout.write(f"__label__DISCLOSURE {text}\n")
        
        for text in non_disclosure_examples:
            fout.write(f"__label__NON_DISCLOSURE {text}\n")
    
    print(f"\nDataset written to {OUTPUT_FILE}")
    print(f"Total examples: {len(disclosure_examples) + len(non_disclosure_examples)}")
    print(f"Balance: {len(disclosure_examples)/(len(disclosure_examples)+len(non_disclosure_examples))*100:.1f}% DISCLOSURE")


if __name__ == "__main__":
    build_balanced_dataset()