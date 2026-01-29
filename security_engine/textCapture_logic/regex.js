const piiPatterns = [
    { name: "Email", regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i },
    { name: "Phone Number", regex: /\b(\+?\d{1,3}[\s-]?)?\d{10}\b/ },
    { name: "Credit Card", regex: /\b(?:\d[ -]*?){13,16}\b/ },
    { name: "IP Address", regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/ },
    { name: "Aadhaar", regex: /\b\d{4}\s\d{4}\s\d{4}\b/ },
    { name: "SSN", regex: /\b\d{3}-\d{2}-\d{4}\b/ }
];
