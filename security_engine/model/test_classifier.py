from classifier import PIIClassifier

def run_tests():
    classifier = PIIClassifier()
    test_categories = {
        "Real Disclosures (Should BLOCK)": [
            "my email is john.doe@gmail.com",
            "call me at 9876543210",
            "you can reach me on my phone number 6528854427",
            "my PAN number is VYYUY5561L",
            "contact me at user@realdomain.com",
            "reach me at rahul@company.com",
            "text me at 7777777777",
            "my passport is W6371987",
        ],
        
        "Example/Dummy Data (Should ALLOW)": [
            "use example@email.com in the documentation",
            "dummy phone number 1234567890",
            "sample PAN is ABCDE1234F for testing",
            "test with fake@example.org",
            "const email = 'test@example.com';",
            "let phone = '1234567890';",
            "EMAIL_REGEX = r'[A-Z0-9._%+-]+@[A-Z0-9.-]+'",
            "the user's email is user@example.com",
        ],
        
        "Educational Queries (Should ALLOW)": [
            "explain what a PAN number is",
            "what does an aadhaar number look like",
            "how do I format phone numbers",
            "what is an email address",
            "tell me about passport numbers",
            "describe PII",
        ],
        
        "False Positives (Should ALLOW)": [
            "my phone is not working",
            "my phone battery is dead",
            "call me maybe",
            "call me by my name",
            "email format validation",
            "phone number format",
            "contact page on website",
        ],
        
        "Non-PII Content (Should ALLOW)": [
            "I love Jaipur, it is very pretty",
            "write an essay about privacy",
            "I am learning numbers and I read 2345 in it",
            "order id is 9876543210",
            "what is machine learning",
            "hello how are you",
        ],
        
        "Edge Cases (May WARN)": [
            "my name is John Smith",
            "I am Rahul from Delhi",
            "my username is john123",
            "contact me through the website",
            "email me for more info",
        ],
    }
    
    total = 0
    passed = 0
    
    for category, test_cases in test_categories.items():
        print(f"\n{'='*80}")
        print(f"{category}")
        print(f"{'='*80}\n")
        
        for prompt in test_cases:
            decision, confidence, details = classifier.classify_prompt(prompt)
            total += 1
            
            # Determine expected result
            if "Should BLOCK" in category:
                expected = "BLOCK"
                correct = (decision == "BLOCK")
            elif "Should ALLOW" in category:
                expected = "ALLOW"
                correct = (decision == "ALLOW")
            else:
                expected = "WARN/ALLOW"
                correct = (decision in ["WARN", "ALLOW"])
            
            if correct:
                passed += 1
            
            # Print result
            status = "✓" if correct else "✗"
            print(f"[{decision:5}] {confidence:.3f} | {prompt[:60]:<60} {status}")
            
            # Show additional details for interesting cases
            if details['has_example_marker'] or not correct:
                if details['has_example_marker']:
                    print(f"         └─ Example marker detected")
                if details['has_pii_pattern'] and decision == "ALLOW":
                    print(f"         └─ PII pattern found but classified as safe")
    
    # Summary
    print(f"\n{'='*80}")
    print("TEST SUMMARY")
    print(f"{'='*80}")
    print(f"\nTotal tests: {total}")
    print(f"Passed: {passed} ({passed/total*100:.1f}%)")
    print(f"Failed: {total-passed} ({(total-passed)/total*100:.1f}%)")
    
    # Detailed explanation of a few cases
    print(f"\n{'='*80}")
    print("DETAILED EXPLANATIONS (Sample Cases)")
    print(f"{'='*80}\n")
    
    sample_cases = [
        "my email is john@gmail.com",
        "use example@email.com in docs",
        "my phone is broken",
    ]
    
    for prompt in sample_cases:
        print(f"\nPrompt: {prompt}")
        print("-" * 80)
        print(classifier.explain_decision(prompt))


def interactive_test():
    """Interactive testing mode"""
    
    print("\n" + "="*80)
    print("INTERACTIVE TESTING MODE")
    print("="*80)
    print("\nEnter text to classify, or 'quit' to exit\n")
    
    try:
        classifier = PIIClassifier()
    except FileNotFoundError as e:
        print(f"Error: {e}")
        return
    
    while True:
        try:
            prompt = input("\nYour text: ").strip()
            
            if prompt.lower() in ['quit', 'exit', 'q']:
                break
            
            if not prompt:
                continue
            
            print("\n" + classifier.explain_decision(prompt))
            
        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"Error: {e}")
    
    print("\nGoodbye!")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "interactive":
        interactive_test()
    else:
        run_tests()
        
        print("\n" + "="*80)
        print("\nTo test interactively, run:")
        print("  python test_classifier.py interactive")