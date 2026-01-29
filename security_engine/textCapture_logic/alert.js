function blockSubmission(e, findings) {
    e.preventDefault();
    e.stopPropagation();

    alert(
        "⚠️ Data Loss Prevention Alert\n\n" +
        "The following sensitive data was detected:\n" +
        findings.join(", ") +
        "\n\nPlease remove PII before submitting."
    );

    return false;
}
