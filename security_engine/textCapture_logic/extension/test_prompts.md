# AI Inspector — Test Prompts for PII Detection

Copy-paste these prompts into ChatGPT (or the test.html textarea) to verify the extension detects and redacts PII correctly — even in large, realistic paragraphs.

---

## 1. Email in a Debug Request (Single PII)

```
I'm getting a weird 500 error on our production server when the user john.smith@company.com tries to log in. The stack trace shows a NullPointerException in the AuthService.authenticate() method at line 247. I've checked the database and the user record exists. The password hash looks valid. Can you help me debug this? Here's the relevant code from our Spring Boot application.
```

**Expected:** Detects `john.smith@company.com` (Email). Rest of the text should remain after redaction.

---

## 2. Phone + Email in a Support Ticket (Multiple PII)

```
Hi, I need help setting up our customer notification system. The primary contact for the account is Sarah Johnson and she can be reached at sarah.j@enterprise.io or by phone at 9876543210. The secondary contact is the IT department. We want to configure automated email alerts whenever the system detects anomalies in the transaction pipeline. The alert should include timestamp, severity level, and a brief description of the anomaly. Can you provide a Python script that handles this?
```

**Expected:** Detects `sarah.j@enterprise.io` (Email) and `9876543210` (Phone).

---

## 3. Credit Card in an E-Commerce Query (Financial PII)

```
We're building a payment integration with Stripe and I want to test it in sandbox mode. For testing purposes, I've been using the card number 4111111111111111 with expiry 12/25 and CVV 123. The webhook endpoint is configured at /api/v1/payments/webhook and it's receiving events correctly. However, the charge.succeeded event sometimes arrives before the payment_intent.created event, which causes our order processing to fail. Here's the webhook handler code — can you spot the race condition?
```

**Expected:** Detects `4111111111111111` (Credit Card).

---

## 4. SSN in an HR Automation Request (Highly Sensitive)

```
I'm building an employee onboarding automation tool for our HR department. The system needs to collect and validate employee information including their Social Security Number. For example, a test employee might have SSN 234-56-7890 and we need to validate the format before storing it in our encrypted database. The validation regex I'm using is /^\d{3}-\d{2}-\d{4}$/ but I'm not sure if it covers all edge cases. Also, the system should generate Form W-4 automatically. Can you review my validation logic?
```

**Expected:** Detects `234-56-7890` (SSN).

---

## 5. API Key in a DevOps Request (Credential Leak)

```
I'm trying to deploy our Node.js application to AWS using the CLI. I've configured my credentials but the deployment keeps failing with an AccessDenied error. My AWS access key is AKIAXXXXXXXXXEXAMPLE and I've set the region to us-east-1. The IAM policy attached to this key should have full S3 and Lambda permissions. Here's my serverless.yml configuration file. The deployment works fine from my colleague's machine so I think it might be a policy issue. Can you help me troubleshoot the IAM permissions?
```

**Expected:** Detects `AKIAXXXXXXXXXEXAMPLE` (API Key / AWS Key).

---

## 6. Aadhaar + PAN in an Indian Tax Filing Query (India-Specific PII)

```
I'm developing a tax filing application for Indian users. The application needs to validate both Aadhaar and PAN numbers before submission to the Income Tax portal. For testing, I'm using Aadhaar number 2345 6789 0123 and PAN number ABCDE1234F. The application should also calculate tax liability based on the old vs new tax regime and generate Form 16 automatically. The GSTIN validation is already implemented. Can you help me write the validation functions for Aadhaar and PAN, and also implement the tax calculation logic for FY 2024-25?
```

**Expected:** Detects `2345 6789 0123` (Aadhaar) and `ABCDE1234F` (PAN).

---

## 7. IP Address in a Network Troubleshooting Request

```
Our Kubernetes cluster is experiencing intermittent connectivity issues. The master node at 192.168.1.105 can reach the worker nodes, but pod-to-pod communication across namespaces is failing. I've checked the Calico CNI logs and there are no obvious errors. The CoreDNS pods are running on nodes 10.0.0.42 and 10.0.0.43. The kube-proxy is running in iptables mode. I've attached the output of kubectl get pods -A and the Calico node status. The issue started after we upgraded from Kubernetes 1.28 to 1.29. Can you help diagnose the networking issue?
```

**Expected:** Detects `192.168.1.105`, `10.0.0.42`, `10.0.0.43` (IP Addresses).

---

## 8. Password in a Config File Help Request

```
I'm setting up a PostgreSQL connection pool in our Java application using HikariCP. Here's my application.properties file configuration. The database is hosted on AWS RDS and the connection string uses the master credentials. The username is db_admin and the password is SuperSecret#2024! for the production database. I'm getting connection timeout errors when the pool size exceeds 20 connections. The RDS instance is a db.r5.large with max_connections set to 150. Can you help me optimize the HikariCP configuration for better connection management?
```

**Expected:** Detects `password: SuperSecret#2024!` or `password is SuperSecret#2024!` (Password pattern).

---

## 9. Private Key in a TLS Setup Request

```
I'm trying to configure mutual TLS authentication for our microservices. I've generated the certificates using OpenSSL but the handshake keeps failing. Here's my server certificate and key. The certificate:

-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA0Z3VS5JJcds3xfn/ygWyF8PbnGy5AoV+A5pTn+VjVl2XmYo
foobarexample
-----END RSA PRIVATE KEY-----

The nginx configuration has ssl_verify_client set to on and ssl_client_certificate pointing to the CA bundle. Can you help me figure out why the mutual TLS handshake is failing?
```

**Expected:** Detects `-----BEGIN RSA PRIVATE KEY-----` (Private Key).

---

## 10. Multi-PII Stress Test (Everything Together)

```
Here's our complete system architecture document for the customer management platform. The lead developer is Rahul Verma (rahul.verma@techcorp.in, phone: 8765432109, PAN: BCDEG5678H). The production database server is at 172.16.0.50 with credentials admin/DbPass@2024. The Stripe integration uses API key sk_test_XXXXXXXXXXXXXXXXXXXXXXXXXXXX and test card 5500000000000004 for recurring billing. The employee records include SSN 345-67-8901 for US employees and Aadhaar 3456 7890 1234 for Indian employees. The SSL certificate private key is stored in /etc/ssl/private/server.key. All API endpoints require Bearer token authentication. The notification system sends alerts to ops-team@techcorp.in and the emergency contact is +91-9988776655.
```

**Expected:** Detects multiple PII types — Email, Phone, PAN, IP Address, Password, API Key, Credit Card, SSN, Aadhaar. This is the ultimate stress test.

---

## 11. Clean Prompt — No PII (False Positive Check)

```
Can you explain the difference between microservices and monolithic architecture? I'm specifically interested in the trade-offs around deployment complexity, data consistency, and team autonomy. Our team is considering migrating from a Django monolith to a FastAPI-based microservices architecture. We currently have about 50 API endpoints and 30 database tables. The application handles approximately 10,000 requests per minute during peak hours. We're using PostgreSQL as our primary database and Redis for caching. What would be a good migration strategy that minimizes downtime and risk?
```

**Expected:** No PII detected. No modal should appear.

---

## 12. Code Snippet with Example Data (False Positive Check)

```
Here's how to validate an email address in Python using regex. The function should handle edge cases like subdomains and plus addressing:

def validate_email(email):
    pattern = r'^[\w\.\+\-]+@[\w]+\.[\w\.]+$'
    test_emails = [
        "user@example.com",
        "test@test.com",
        "admin@localhost",
        "john.doe+tag@example.org"
    ]
    return bool(re.match(pattern, email))

Can you improve this regex to also validate international domain names and handle the maximum length constraint of 254 characters?
```

**Expected:** No PII detected — example.com, test.com, and localhost emails should be excluded as dummy/example data.

---

## How to Use

1. **On test.html**: Paste into the real-time detection textarea (Section 6)
2. **On ChatGPT**: Paste into the prompt box with the extension loaded
3. **Verify**: Modal should appear ~150ms after pasting with correct PII findings
4. **Redaction**: Click "Remove & Cancel" → only PII values should be stripped, rest of text stays
5. **Allow**: Click "Proceed Anyway" → text stays as-is, modal doesn't re-trigger
