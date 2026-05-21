# Product Definition: CoinYan

- **Version:** 1.0
- **Status:** Proposed

---

## 1. The Big Picture (The "Why")

### 1.1. Project Vision & Purpose

To give everyday people a clear, intuitive window into their personal finances — where money comes from, where it goes, and how their balance evolves over time. CoinYan starts as a solid personal finance foundation inspired by CoinKeeper, and grows into a uniquely powerful tool with multi-currency, crypto, and investment integrations.

### 1.2. Target Audience

Everyday individuals who want simple, visual control over their personal income and spending. The product is designed for people who may not be financial experts but want to be aware of their financial reality without friction.

The initial product is delivered as a **web application**, with iOS and Android apps planned for future releases.

### 1.3. User Personas

- **Persona 1: "Alex the Remote Worker"**
  - **Role:** Freelancer with multiple income streams (salary, side projects, investments).
  - **Goal:** Wants to know at a glance how much he earned, spent, and has left this month — across all his accounts.
  - **Frustration:** Juggling multiple bank accounts and spreadsheets is tedious and error-prone.

- **Persona 2: "Maria the Traveler"**
  - **Role:** Professional who travels frequently and deals with multiple currencies.
  - **Goal:** Track all spending in one place regardless of currency, and see everything through the lens of a single base currency (e.g. USD).
  - **Frustration:** Current apps either don't support multi-currency well or are too complex to set up.

### 1.4. Success Metrics

- **Financial Clarity:** Users report better awareness of their spending habits after 1 month of use.
- **Retention:** The majority of users return weekly to log transactions and check their dashboard.
- **Fast Onboarding:** New users successfully set up their accounts and log their first transaction without needing help or support.

---

## 2. The Product Experience (The "What")

### 2.1. Core Features

- **User Authentication** — Secure sign-up and login so each user's data is private and persisted.
- **Accounts & Wallets** — Multiple accounts (cash, bank card, savings, etc.) with real-time balances updated as transactions are added.
- **Income Sources** — Define and track multiple named income sources (e.g. salary, freelance, rental income).
- **Expense Categories** — Log and categorize spending (e.g. food, rent, transport, entertainment) with customizable categories.
- **Transfers Between Accounts** — Move money between a user's own accounts (e.g. cash → card) without skewing income/expense totals.
- **Budget Limits** — Set monthly spending limits per category and receive warnings when approaching or exceeding them.
- **Dashboard & Overview** — Visual summary showing total income, total expenses, current balance, and spending breakdown by category.
- **Basic Reports & Charts** — Monthly and weekly views with spending charts and category breakdowns to track trends over time.

### 2.2. User Journey

A new user lands on the CoinYan web app and signs up for an account. They then set up their accounts and wallets (e.g. "Main Card", "Cash", "Savings"). Next, they log their income sources. From there, they start adding daily expenses, assigning each to a category. They can transfer funds between accounts as needed and set budget limits for categories they want to control. Each day or week, they return to the dashboard to see their financial picture at a glance, and explore the reports section to understand longer-term trends.

---

## 3. Project Boundaries

### 3.1. What's In-Scope for V1

- User account creation and secure login.
- Multiple accounts/wallets with balance tracking.
- Income source management.
- Expense logging with customizable categories.
- Transfers between the user's own accounts.
- Per-category monthly budget limits with alerts.
- Dashboard with income, expenses, balance, and category breakdown.
- Basic charts: monthly/weekly spending and category reports.

### 3.2. What's Out-of-Scope for V1 (Future Killer Features)

- **Crypto & Broker Integrations** — Connecting crypto wallets, exchanges (e.g. Binance, Coinbase), and stock brokers to automatically import and track investment holdings.
- **Multi-Currency Workspace** — Tracking transactions in multiple currencies within a single workspace, designed for frequent travelers.
- **Base Value Anchor** — Choosing a fundamental unit of value (USD, EUR, Gold, Bitcoin, or any asset with a daily market price) as the lens through which all balances and budgets are displayed and recalculated daily.
- **Mobile Apps** — Native iOS and Android applications (planned post-web-launch).
- **Shared/Family Accounts** — Collaborative budgeting across multiple users.
- **Automatic Bank Imports** — Connecting directly to banks for automatic transaction syncing.
- **Tax Calculations** — Any tax-related reporting or advice.
