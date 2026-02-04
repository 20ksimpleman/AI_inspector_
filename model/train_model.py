import joblib
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import classification_report, confusion_matrix, precision_recall_curve
from sklearn.pipeline import Pipeline, FeatureUnion
from sklearn.preprocessing import StandardScaler
import matplotlib.pyplot as plt


def load_data(filepath="train.txt"):
    """Load training data"""
    texts = []
    labels = []
    
    with open(filepath, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            
            # Skip empty or malformed lines
            if not line or " " not in line:
                continue
            
            label_part, text = line.split(" ", 1)
            label = 1 if label_part == "__label__DISCLOSURE" else 0
            
            texts.append(text)
            labels.append(label)
    
    return texts, labels


def build_pipeline():
    """
    Build improved feature extraction pipeline.
    
    Combines:
    1. Character n-grams (good for PII patterns like emails, phones)
    2. Word n-grams (good for semantic context)
    """
    
    features = FeatureUnion([
        ('char_tfidf', TfidfVectorizer(
            analyzer='char',
            ngram_range=(3, 5),
            min_df=2,
            max_features=5000,
            strip_accents='unicode'
        )),
        ('word_tfidf', TfidfVectorizer(
            analyzer='word',
            ngram_range=(1, 3),
            min_df=2,
            max_features=3000,
            strip_accents='unicode'
        ))
    ])
    
    pipeline = Pipeline([
        ('features', features),
        ('classifier', LogisticRegression(
            max_iter=1000,
            class_weight='balanced',
            C=1.0,
            random_state=42
        ))
    ])
    
    return pipeline


def evaluate_model(pipeline, X_test, y_test):
    """Comprehensive model evaluation"""
    
    print("\n" + "="*80)
    print("MODEL EVALUATION")
    print("="*80)
    
    # Predictions
    y_pred = pipeline.predict(X_test)
    y_proba = pipeline.predict_proba(X_test)[:, 1]
    
    # Classification report
    print("\nClassification Report:")
    print(classification_report(
        y_test, y_pred,
        target_names=['NON_DISCLOSURE', 'DISCLOSURE'],
        digits=3
    ))
    
    # Confusion matrix
    cm = confusion_matrix(y_test, y_pred)
    print("\nConfusion Matrix:")
    print(f"                    Predicted")
    print(f"                NON_DISC  DISCLOSURE")
    print(f"Actual NON_DISC    {cm[0,0]:6d}    {cm[0,1]:6d}")
    print(f"       DISCLOSURE  {cm[1,0]:6d}    {cm[1,1]:6d}")
    
    # Calculate metrics
    tn, fp, fn, tp = cm.ravel()
    
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0
    f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
    
    print(f"\nKey Metrics:")
    print(f"  Precision: {precision:.3f} (of predicted DISCLOSURE, how many are correct?)")
    print(f"  Recall:    {recall:.3f} (of actual DISCLOSURE, how many did we catch?)")
    print(f"  F1 Score:  {f1:.3f} (harmonic mean of precision and recall)")
    
    # False positive and false negative rates
    fpr = fp / (fp + tn) if (fp + tn) > 0 else 0
    fnr = fn / (fn + tp) if (fn + tp) > 0 else 0
    
    print(f"\nError Analysis:")
    print(f"  False Positive Rate: {fpr:.3f} (blocking safe content)")
    print(f"  False Negative Rate: {fnr:.3f} (missing real PII)")
    
    return y_proba


def analyze_threshold(y_test, y_proba):
    """
    Analyze different probability thresholds for decision making.
    Helps choose optimal BLOCK and WARN thresholds.
    """
    
    print("\n" + "="*80)
    print("THRESHOLD ANALYSIS")
    print("="*80)
    
    thresholds = [0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95]
    
    print(f"\n{'Threshold':<12} {'Precision':<12} {'Recall':<12} {'F1':<12} {'FP Rate':<12}")
    print("-" * 60)
    
    for threshold in thresholds:
        y_pred_thresh = (y_proba >= threshold).astype(int)
        cm = confusion_matrix(y_test, y_pred_thresh)
        
        tn, fp, fn, tp = cm.ravel()
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0
        f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
        fpr = fp / (fp + tn) if (fp + tn) > 0 else 0
        
        print(f"{threshold:<12.2f} {precision:<12.3f} {recall:<12.3f} {f1:<12.3f} {fpr:<12.3f}")
    
    print("\nRecommendations:")
    print("  - BLOCK threshold (0.85-0.90): High precision, catches most real disclosures")
    print("  - WARN threshold (0.50-0.70): Lower threshold for ambiguous cases")


def test_examples(pipeline):
    """Test model on example cases"""
    
    print("\n" + "="*80)
    print("TESTING ON EXAMPLE CASES")
    print("="*80)
    
    test_cases = [
        # Should BLOCK (DISCLOSURE)
        ("my email is john.doe@gmail.com", "BLOCK"),
        ("call me at 9876543210", "BLOCK"),
        ("you can reach me on my phone number 6528854427", "BLOCK"),
        ("my PAN number is VYYUY5561L", "BLOCK"),
        ("contact me at myemail@domain.com", "BLOCK"),
        
        # Should ALLOW (NON_DISCLOSURE)
        ("use example@email.com in the documentation", "ALLOW"),
        ("dummy phone number 1234567890", "ALLOW"),
        ("explain what a PAN number is", "ALLOW"),
        ("const email = 'test@example.com';", "ALLOW"),
        ("my phone is not working", "ALLOW"),
        ("call me maybe", "ALLOW"),
        ("I love Jaipur, it is very pretty", "ALLOW"),
        ("what does an aadhaar number look like", "ALLOW"),
        
        # Edge cases
        ("my name is John Smith", "MAYBE"),
        ("sample PAN is ABCDE1234F", "MAYBE"),
        ("the user's email is user@example.com", "MAYBE"),
    ]
    
    print(f"\n{'Decision':<8} {'Confidence':<12} {'Expected':<10} {'Text':<60}")
    print("-" * 100)
    
    correct = 0
    total = 0
    
    for text, expected in test_cases:
        from preprocess import preprocess_for_ml
        processed = preprocess_for_ml(text)
        proba = pipeline.predict_proba([processed])[0][1]
        
        # Decision logic (matching classifier.py)
        if proba >= 0.85:
            decision = "BLOCK"
        elif proba >= 0.50:
            decision = "WARN"
        else:
            decision = "ALLOW"
        
        # Check correctness
        if expected != "MAYBE":
            total += 1
            if decision == expected:
                correct += 1
        
        status = "✓" if (expected == "MAYBE" or decision == expected) else "✗"
        print(f"{decision:<8} {proba:<12.3f} {expected:<10} {text[:60]:<60} {status}")
    
    if total > 0:
        print(f"\nAccuracy on clear cases: {correct}/{total} = {correct/total*100:.1f}%")


def main():
    """Main training function"""
    
    print("="*80)
    print("PII DISCLOSURE DETECTOR - MODEL TRAINING")
    print("="*80)
    
    # Load data
    print("\n1. Loading data...")
    texts, labels = load_data("train.txt")
    
    print(f"   Loaded {len(texts)} samples")
    print(f"   DISCLOSURE: {sum(labels)} ({sum(labels)/len(labels)*100:.1f}%)")
    print(f"   NON_DISCLOSURE: {len(labels)-sum(labels)} ({(len(labels)-sum(labels))/len(labels)*100:.1f}%)")
    
    # Split data
    print("\n2. Splitting data...")
    X_train, X_test, y_train, y_test = train_test_split(
        texts, labels,
        test_size=0.2,
        random_state=42,
        stratify=labels
    )
    print(f"   Training: {len(X_train)} samples")
    print(f"   Testing: {len(X_test)} samples")
    
    # Build and train model
    print("\n3. Training model...")
    pipeline = build_pipeline()
    
    # Preprocess training data
    from preprocess import preprocess_for_ml
    X_train_processed = [preprocess_for_ml(x) for x in X_train]
    X_test_processed = [preprocess_for_ml(x) for x in X_test]
    
    pipeline.fit(X_train_processed, y_train)
    print("   ✓ Training complete")
    
    # Cross-validation
    print("\n4. Cross-validation...")
    cv_scores = cross_val_score(pipeline, X_train_processed, y_train, cv=5, scoring='f1')
    print(f"   CV F1 Scores: {cv_scores}")
    print(f"   Mean: {cv_scores.mean():.3f} (+/- {cv_scores.std() * 2:.3f})")
    
    # Evaluate
    print("\n5. Evaluating on test set...")
    y_proba = evaluate_model(pipeline, X_test_processed, y_test)
    
    # Threshold analysis
    analyze_threshold(y_test, y_proba)
    
    # Test examples
    test_examples(pipeline)
    
    # Save model
    print("\n6. Saving model...")
    # We need to save just the vectorizer and model components
    # since preprocessing is done separately
    joblib.dump(pipeline, "pii_intent_lr.joblib")
    print("   ✓ Model saved to pii_intent_lr.joblib")
    
    print("\n" + "="*80)
    print("TRAINING COMPLETE!")
    print("="*80)
    print("\nNext steps:")
    print("  1. Review the metrics above")
    print("  2. Adjust thresholds in classifier.py if needed")
    print("  3. Run test_classifier.py to test on examples")
    print("  4. Collect misclassified examples and add to training data")
    print("  5. Retrain periodically")


if __name__ == "__main__":
    main()