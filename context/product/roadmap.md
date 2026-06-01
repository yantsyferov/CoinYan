# Product Roadmap: CoinYan

_This roadmap outlines our strategic direction based on customer needs and business goals. It focuses on the "what" and "why," not the technical "how."_

---

### Phase 1 — Foundation

_The highest-priority features that form the core foundation of the product. Without these, nothing else works._

- [x] **User Account Essentials**
  - [x] **Sign-Up & Login:** Users create an account and sign in with email and password, providing a secure, personal entry point to the application.
  - [x] **Profile Management:** Users can view and update their display name and email address.

- [x] **Accounts & Wallets**
  - [x] **Create & Manage Accounts:** Users can add multiple financial accounts (e.g. cash, bank card, savings) and give each a custom name.
  - [x] **Real-Time Balance Tracking:** Account balances update automatically as transactions are logged against them.

---

### Phase 2 — Core Financial Tracking

_Once the foundation is live, we layer on the primary day-to-day financial tracking functionality._

- [x] **Income Management**
  - [x] **Income Sources:** Users define named income sources (e.g. salary, freelance, rental) and log income entries against them.

- [x] **Expense Management**
  - [x] **Custom Expense Categories:** Users create, edit, and delete their own expense categories (e.g. food, rent, transport). Categories are fully dynamic — none are pre-defined by the system.
  - [x] **Expense Logging:** Users log individual expenses, assigning each to one of their custom categories, an account, and a date.
  - [x] **Cancel Any Transaction:** Users can cancel any expense, income, or transfer entry from the account history or the category/income source history, with full balance restoration.
  - [x] **Edit Any Transaction:** Users can correct the amount and note on any existing transaction (expense, income, or transfer) without cancelling and re-entering it. Account balances recalculate automatically to reflect the change.
  - [x] **Custom Transaction Date:** Users can set the date of a transaction when creating or editing it; future dates are not permitted. Past-dated transactions appear in the correct chronological position in history lists.

- [x] **Account Transfers**
  - [x] **Transfers Between Own Accounts:** Users move money between their own accounts (e.g. cash → card) without it appearing as income or expense, preserving accurate totals.

---

### Phase 3 — Budgeting & Dashboard

_Turns raw transaction data into financial awareness and control._

- [x] **Budget Controls**
  - [x] **Per-Category Budget Limits:** Users set a monthly spending ceiling for any category. The app alerts them when they approach or exceed the limit.

- [x] **Dashboard & Overview**
  - [x] **At-a-Glance Financial Summary:** A primary dashboard showing total income, total expenses, net balance, and a spending breakdown by category for the current period.

- [x] **Full Transaction History**
  - [x] **History Grouped by Month:** Users can view the complete history of an account, expense category, or income source, organized by month, with older periods loading automatically as they scroll.

---

### Phase 4 — Reports & Insights

_Deepens engagement and delivers on the promise of financial clarity over time._

- [ ] **Basic Reports & Charts**
  - [ ] **Monthly & Weekly Spending Charts:** Visual timeline of spending patterns so users can see trends across weeks and months.
  - [ ] **Category Breakdown Reports:** Drill-down view of spending per category across any selected period.

---

### Phase 5 — Future Features

_Features planned for post-V1 consideration. Priority and scope will be refined based on user feedback from earlier phases._

- [x] **Multi-Currency Workspace** — Track transactions in multiple currencies within a single workspace, designed for travelers and users with cross-border finances.
- [x] **Base Value Anchor** — Let users choose a fundamental unit of value (USD, EUR, Gold, Bitcoin, or any asset) as the lens through which all balances are displayed, recalculated daily at market rates.
- [ ] **Crypto & Broker Integrations** — Connect crypto wallets, exchanges (e.g. Binance, Coinbase), and stock brokers to automatically import and track holdings.
- [ ] **Automatic Bank Imports** — Securely link bank accounts to sync transactions automatically, reducing manual entry.
- [ ] **Mobile Apps** — Native iOS and Android applications, built after the web platform is established.
- [ ] **Shared / Family Accounts** — Collaborative budgeting workspace shared across multiple users.
