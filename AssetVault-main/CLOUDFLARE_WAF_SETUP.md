# 🛡️ AEMS Cloudflare WAF (Web Application Firewall) Setup & Deployment Guide

This document provides step-by-step instructions to configure and activate **Cloudflare Enterprise/Free WAF** on top of the AEMS application.

---

## 🏗️ How AEMS Integrates with Cloudflare WAF

1. **Client IP Extraction:** Backend uses `CF-Connecting-IP` as the trusted client identifier.
2. **Ray ID Traceability:** Cloudflare Request Trace IDs (`CF-Ray`) are captured and attached to system audit headers.
3. **Threat Score Auto-Mitigation:** Backend drops any requests with Cloudflare Threat Score `cf-threat-score > 80`.
4. **Anycast DDoS Shield:** Absorbs multi-gigabit Layer 3, 4, and 7 volumetric attacks at the edge.

---

## 🚀 3-Step Cloudflare WAF Configuration

### Step 1: Add Domain to Cloudflare & Enable Proxy (Orange Cloud)
1. In the **Cloudflare Dashboard**, add your domain (e.g., `aems.pgel.in`).
2. Go to **DNS -> Records**.
3. Point your `A` or `CNAME` record to your deployment server/Vercel CNAME:
   * **Name:** `aems` (or `@`)
   * **Target:** `cname.vercel-dns.com` (or server IP)
   * **Proxy status:** **Proxied (Orange Cloud ON)** 🟠

---

### Step 2: Configure Recommended Cloudflare WAF Custom Rules

Navigate to **Security -> WAF -> Custom Rules -> Create Rule**:

#### Rule 1: High Threat Score Blocker
* **Rule Name:** `AEMS Threat Score Shield`
* **Field:** `Threat Score`
* **Operator:** `greater than`
* **Value:** `50`
* **Action:** **Block** (or Managed Challenge)

#### Rule 2: Automated Malicious Bot Mitigation
* **Rule Name:** `AEMS Bot Mitigation`
* **Field:** `Verified Bot` equals `false` **AND** `Threat Score` greater than `20`
* **Action:** **Managed Challenge (Cloudflare Turnstile)**

#### Rule 3: Enforce Country / Geo-Protection (Optional)
* **Rule Name:** `Allow Domestic Traffic Only`
* **Field:** `Country` does not equal `India (IN)`
* **Action:** **Managed Challenge**

---

### Step 3: Enable Cloudflare Security Settings

In **Security -> Settings**:
1. **Security Level:** Set to **Medium** or **High**.
2. **Challenge Passage:** Set to **30 minutes**.
3. **Browser Integrity Check (BIC):** Set to **ON**.
4. In **SSL/TLS -> Overview**:
   * Set Encryption Mode to **Full (Strict)**.
   * In **Edge Certificates**: Turn ON **Always Use HTTPS**, **Minimum TLS Version: 1.3**, and **Opportunistic Encryption**.

---

## ✅ Verification
Once the DNS propagates, all incoming traffic to AEMS is filtered through Cloudflare's global edge network before reaching the backend server.
