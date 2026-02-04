"""
Improved PII disclosure classifier with smarter decision logic
"""

import joblib
from regex_rules import has_pii_pattern, has_example_marker, is_real_pii
from preprocess import preprocess_for_ml


class PIIClassifier:
    """
    Intelligent PII disclosure classifier.
    
    Combines:
    1. ML model (intent classification)
    2. Regex patterns (PII detection)
    3. Context analysis (example vs real)
    """
    
    def __init__(self, model_path="pii_intent_lr.joblib"):
        """Load the trained model"""
        try:
            self.pipeline = joblib.load(model_path)
        except FileNotFoundError:
            raise FileNotFoundError(
                f"Model not found at {model_path}. "
                "Please run train_model.py first to train the model."
            )
    
    def classify_prompt(
        self,
        prompt: str,
        block_threshold: float = 0.85,
        warn_threshold: float = 0.50,
        require_pii_pattern: bool = True
    ) -> tuple:
        """
        Classify a user prompt for PII disclosure.
        
        Args:
            prompt: User input text
            block_threshold: Probability threshold for BLOCK decision (default 0.85)
            warn_threshold: Probability threshold for WARN decision (default 0.50)
            require_pii_pattern: If True, only BLOCK if both ML model AND regex detect PII
        
        Returns:
            Tuple of (decision, confidence, details)
            - decision: "BLOCK", "WARN", or "ALLOW"
            - confidence: probability score from model (0-1)
            - details: dict with additional information
        """
        # Preprocess
        processed = preprocess_for_ml(prompt)
        
        # Get ML model prediction
        proba = self.pipeline.predict_proba([processed])[0][1]
        
        # Check for PII patterns
        has_pii = has_pii_pattern(prompt)
        has_example = has_example_marker(prompt)
        is_real = is_real_pii(prompt)
        
        # Decision logic
        decision = self._make_decision(
            proba, has_pii, has_example, is_real,
            block_threshold, warn_threshold, require_pii_pattern
        )
        
        # Prepare details
        details = {
            'ml_confidence': float(proba),
            'has_pii_pattern': has_pii,
            'has_example_marker': has_example,
            'is_likely_real_pii': is_real,
            'processed_text': processed[:100] + '...' if len(processed) > 100 else processed
        }
        
        return decision, proba, details
    
    def _make_decision(
        self, proba, has_pii, has_example, is_real,
        block_threshold, warn_threshold, require_pii_pattern
    ):
        """
        Make the final decision based on all signals.
        
        Logic:
        1. If has example markers → ALLOW (even if has PII)
        2. If has real PII AND high confidence → BLOCK
        3. If high confidence but no PII pattern → WARN
        4. If medium confidence → WARN
        5. Otherwise → ALLOW
        """
        
        # Rule 1: Example/dummy data should always be allowed
        if has_example:
            return "ALLOW"
        
        # Rule 2: Real PII with high confidence → BLOCK
        if require_pii_pattern:
            # Conservative: require both ML and regex to agree
            if has_pii and is_real and proba >= block_threshold:
                return "BLOCK"
        else:
            # Liberal: trust ML model alone
            if proba >= block_threshold:
                return "BLOCK"
        
        # Rule 3: High confidence but no PII pattern → WARN
        # (might be disclosure intent without actual PII value yet)
        if proba >= block_threshold and not has_pii:
            return "WARN"
        
        # Rule 4: Medium confidence → WARN
        if proba >= warn_threshold:
            return "WARN"
        
        # Rule 5: Low confidence → ALLOW
        return "ALLOW"
    
    def classify_batch(self, prompts: list, **kwargs) -> list:
        """Classify multiple prompts"""
        return [self.classify_prompt(p, **kwargs) for p in prompts]
    
    def explain_decision(self, prompt: str) -> str:
        """
        Get a human-readable explanation of the decision.
        """
        decision, confidence, details = self.classify_prompt(prompt)
        
        explanation = [
            f"Decision: {decision}",
            f"Confidence: {confidence:.3f}",
            f"",
            "Analysis:",
            f"  - Contains PII pattern: {details['has_pii_pattern']}",
            f"  - Has example marker: {details['has_example_marker']}",
            f"  - Likely real PII: {details['is_likely_real_pii']}",
            f"",
            "Reasoning:"
        ]
        
        if details['has_example_marker']:
            explanation.append("  → Example/dummy data detected → ALLOW")
        elif decision == "BLOCK":
            explanation.append("  → Real PII disclosure detected → BLOCK")
        elif decision == "WARN":
            if details['has_pii_pattern']:
                explanation.append("  → Ambiguous case with PII → WARN")
            else:
                explanation.append("  → Disclosure intent without PII → WARN")
        else:
            explanation.append("  → No PII disclosure detected → ALLOW")
        
        return "\n".join(explanation)


# Backward compatible functions
_classifier = None

def _get_classifier():
    """Lazy load classifier"""
    global _classifier
    if _classifier is None:
        _classifier = PIIClassifier()
    return _classifier


def classify_prompt(prompt: str) -> tuple:
    """
    Legacy function for backward compatibility.
    Returns (decision, confidence)
    """
    classifier = _get_classifier()
    decision, confidence, _ = classifier.classify_prompt(prompt)
    return decision, confidence


if __name__ == "__main__":
    # Test the classifier
    print("="*80)
    print("PII CLASSIFIER TEST")
    print("="*80)
    
    try:
        classifier = PIIClassifier()
        
        test_cases = [
            "my email is john.doe@gmail.com",
            "call me at 9876543210",
            "use example@email.com in the documentation",
            "dummy phone number 1234567890",
            "explain what a PAN number is",
            "my phone is not working",
            "const email = 'test@example.com';",
        ]
        
        print("\nTest Results:\n")
        for prompt in test_cases:
            decision, confidence, details = classifier.classify_prompt(prompt)
            print(f"[{decision:5}] {confidence:.3f} | {prompt}")
            if details['has_example_marker']:
                print(f"         └─ Has example marker")
        
        print("\n" + "="*80)
        print("\nFor detailed explanation, use:")
        print("  classifier.explain_decision(prompt)")
        
    except FileNotFoundError as e:
        print(f"\nError: {e}")
        print("\nPlease run: python train_model.py")