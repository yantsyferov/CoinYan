# Functional Specification: Categories

- **Roadmap Items:** Phase 2 — Income Sources; Phase 2 — Custom Expense Categories
- **Status:** Completed

---

## 1. Overview and Rationale (The "Why")

Before a user can record any income or expense transaction, they need a way to organize that activity into meaningful personal labels. Without categories, transactions have no context — a user can see their total balance change but cannot understand *why* it changed.

CoinYan seeds a practical set of default expense categories so that a new user can start logging transactions immediately without any setup. Income sources, on the other hand, are fully personal and always start empty — only the user knows where their money comes from.

Every label — whether default or custom — can be renamed, given a new icon, or deleted at any time. The system provides a starting point; the user owns the result.

This spec covers two types of user-defined labels:
- **Expense categories** — represent where money goes (e.g. Groceries, Rent, Transport)
- **Income sources** — represent where money comes from (e.g. Salary, Freelance, Rental)

---

## 2. Functional Requirements (The "What")

### 2.1 Categories Screen

The categories screen is divided into two sections: **Expense Categories** and **Income Sources**. Each section lists the user's items and provides a "+" button to add new ones.

- Every new user automatically gets **9 default expense categories**: Groceries, Rent, Transport, Dining Out, Entertainment, Healthcare, Utilities, Shopping, and Education.
- Income sources always start empty — none are pre-created by the system.
- Each item in the list shows its icon and name.
- If a section is empty, an empty-state prompt is shown.

**Acceptance Criteria:**
- [x] Given I open the categories screen for the first time, then I see 9 default expense categories already in the list.
- [x] Given I open the categories screen for the first time, then the Income Sources section is empty with a prompt to add one.
- [x] Given I have created additional categories, then each section lists all items with their icon and name.

---

### 2.2 Creating a Category

A user can create a new expense category or income source at any time by tapping the "+" button in the appropriate section. This works from **both the home page and the categories screen** — a modal dialog opens inline in either place, so the user never has to navigate away.

Required fields:
- **Name** (required) — free-text label, e.g. "Groceries", "Salary"
- **Icon** (required) — chosen from a predefined library

**Acceptance Criteria:**
- [x] Given I tap "+" in the Expense Categories section (home page or categories screen), then I see a modal form to create an expense category.
- [x] Given I tap "+" in the Income Sources section (home page or categories screen), then I see a modal form to create an income source.
- [x] Given I fill in a name and icon and save, then the new item appears in the correct section immediately without page navigation.
- [x] Given I try to save without entering a name, then I see an error and nothing is created.
- [x] Given I enter a name that already exists in the same section, then I see a duplicate-name error.

---

### 2.3 Editing a Category

A user can change any category's name and icon at any time — including the default ones.

**Acceptance Criteria:**
- [x] Given I tap an existing category, then I can edit its name and icon.
- [x] Given I save the changes, then the updated name and icon appear in the list immediately.
- [x] Given I clear the name field and try to save, then I see an error and the change is not saved.

---

### 2.4 Deleting a Category

A user can delete any category, including the default ones. A single confirmation prompt is shown before deletion. If the deleted category was linked to past transactions, those transactions are not removed — they simply appear as uncategorized.

**Acceptance Criteria:**
- [x] Given I choose to delete a category, then I see a confirmation prompt.
- [x] Given I confirm, then the category is removed from the list.
- [x] Given I cancel, then the category remains.
- [x] Given the deleted category was used in past transactions, then those transactions remain but show no category label.

---

## 3. Scope and Boundaries

### In-Scope
- 9 default expense categories seeded automatically for every new user
- Creating, editing, and deleting expense categories (including defaults)
- Creating, editing, and deleting income sources
- Icon picker (same predefined set used by accounts)
- Duplicate name prevention within the same type

### Out-of-Scope
- Logging income or expense transactions — covered in spec 004
- Account transfers — covered in spec 004
- Budget limits per category — covered in a later spec
- Reports and charts — covered in a later spec
