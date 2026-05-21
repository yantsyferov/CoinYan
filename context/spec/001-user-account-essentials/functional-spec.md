# Functional Specification: User Account Essentials

- **Roadmap Item:** Phase 1 — User Account Essentials (Sign-Up & Login, Profile Management)
- **Status:** Completed
- **Author:** CoinYan Team

---

## 1. Overview and Rationale (The "Why")

CoinYan is a personal finance tool where all financial data — accounts, transactions, and budgets — belongs to a specific individual. Without an account system, there is no way to keep each person's data private, separate, and accessible only to them.

This specification covers the complete lifecycle of a user's identity in the app: creating an account, signing in, recovering access if a password is forgotten, and maintaining their personal profile.

**Success looks like:** A new user can create an account in under two minutes, sign back in without friction, recover their account if they forget their password, and keep their profile information up to date — all without needing any help.

---

## 2. Functional Requirements (The "What")

### 2.1 Sign-Up

A new user can create a personal account from the Sign-Up page.

- The sign-up form collects: **display name**, **email address**, **password**, and **confirm password**.
- The password must meet all of the following requirements:
  - At least 8 characters long
  - Contains at least one uppercase letter
  - Contains at least one number
- The requirements are shown clearly on the form so the user knows what is expected before they try to submit.
- The "Confirm password" field must match the password field exactly. If they don't match, the user sees: *"Passwords do not match."*
- If the user submits an email address that already belongs to an existing account, they see: *"An account with this email already exists."* with a link to the Sign-In page.
- If sign-up is successful, the user is automatically signed in and taken directly into the app — no separate login step required.

**Acceptance Criteria:**
- [x] Given I am on the Sign-Up page, when I fill in all fields correctly and submit, then I am automatically signed in and redirected into the app.
- [x] Given I submit a password shorter than 8 characters, then the form shows an error explaining the minimum length requirement without submitting.
- [x] Given I submit a password without an uppercase letter or without a number, then the form shows a specific error describing what is missing.
- [x] Given I enter two different values in "Password" and "Confirm password," then the form shows *"Passwords do not match"* and does not submit.
- [x] Given I submit an email already in use, then I see *"An account with this email already exists"* and a link to sign in.

---

### 2.2 Sign-In

A returning user can sign in from the Sign-In page using their email and password.

- The sign-in form collects: **email address** and **password**.
- If the email or password is incorrect, the user sees: *"Incorrect email or password."* (The same message is shown regardless of which field is wrong, for security reasons.)
- After **5 consecutive failed sign-in attempts**, the account is **temporarily locked**. The user sees: *"Account temporarily locked due to too many failed attempts. Please try again in 15 minutes."*
- The account unlocks automatically after **15 minutes**. No action is needed from the user.
- If sign-in is successful, the user is taken to the main screen of the app.

**Acceptance Criteria:**
- [x] Given I enter my correct email and password, then I am signed in and taken to the app.
- [x] Given I enter a wrong password, then I see *"Incorrect email or password"* and remain on the sign-in page.
- [x] Given I fail to sign in 5 times in a row, then I see the account-locked message and the sign-in form is disabled.
- [x] Given my account is locked and 15 minutes have passed, then I can attempt to sign in again.

---

### 2.3 Forgot Password / Password Reset

A user who cannot remember their password can request a reset from the Sign-In page.

- A "Forgot password?" link is visible on the Sign-In page.
- Clicking it takes the user to a page where they enter their **email address** and submit.
- If the email belongs to an account, a **password reset link** is sent to that address.
- The reset link is valid for **1 hour**. After that, it expires and cannot be used.
- If the email does not belong to any account, the same success message is shown regardless — the user sees: *"If an account exists for this email, a reset link has been sent."* (This prevents confirming whether an email is registered.)
- Clicking the link in the email takes the user to a page where they enter and confirm a new password (subject to the same rules as sign-up).
- Once the new password is saved, the user is automatically signed in and taken into the app.
- The reset link is single-use — once it has been used or has expired, it cannot be used again.

**Acceptance Criteria:**
- [x] Given I click "Forgot password?" and enter a registered email, then I see the confirmation message and receive a reset email.
- [x] Given I enter an unregistered email, then I see the same confirmation message (no hint about whether the email exists).
- [x] Given I click the reset link within 1 hour and enter a valid new password, then my password is updated and I am signed in automatically.
- [x] Given I try to use a reset link more than 1 hour after it was sent, then I see an error and am directed to request a new one.
- [x] Given I try to use a reset link that has already been used, then I see an error and am directed to request a new one.

---

### 2.4 Profile Management

A signed-in user can view and update their personal information from the Profile page.

**Display Name:**
- The user can update their display name at any time.
- The name must not be empty.
- On save, the updated name is reflected immediately everywhere it appears in the app.

**Email Address:**
- The user can request a change to their email address.
- After entering the new address and saving, a **confirmation link is sent to the new email address**.
- At the same time, a **security notification is sent to the old email address** informing the user that a change was requested. The message reads: *"A request was made to change the email address on your CoinYan account. If this wasn't you, please contact support immediately."*
- The email address in use does **not change** until the user clicks the confirmation link sent to the new inbox.
- Until confirmed, the user continues to sign in with their old email.

**Password:**
- The user can change their password by entering their **current password** and then entering and confirming a **new password**.
- The new password must meet the same requirements as at sign-up (8+ characters, one uppercase letter, one number).
- If the current password entered is incorrect, the user sees an error and the password is not changed.
- On success, the user sees a confirmation message: *"Password updated successfully."* They remain signed in on their current device.

**Profile Picture:**
- The user can upload a personal photo to use as their avatar across the app.
- Accepted formats: JPG and PNG only.
- Maximum file size: 5 MB.
- If the file is too large or in an unsupported format, the user sees a clear error before any upload is attempted.
- If no photo has been set, the app displays the first letter of the user's display name as a default avatar.

**Acceptance Criteria:**
- [x] Given I update my display name and save, then the new name appears immediately throughout the app.
- [x] Given I request an email change, then a confirmation link is sent to the new email and a security alert is sent to the old email.
- [x] Given my email change is pending, then I continue to sign in with my old email until I click the confirmation link.
- [x] Given I click the confirmation link in the new inbox, then my email address is updated and takes effect immediately.
- [x] Given I change my password successfully, then I see *"Password updated successfully"* and remain signed in.
- [x] Given I enter my current password incorrectly when attempting a change, then I see an error and the password is not changed.
- [ ] ~~Given I upload a PNG file under 5 MB as my profile picture, then the photo appears as my avatar.~~ **[Deferred — profile picture upload descoped to V2 per technical spec]**
- [ ] ~~Given I try to upload a file larger than 5 MB, then I see an error before the upload proceeds.~~ **[Deferred — profile picture upload descoped to V2 per technical spec]**
- [ ] ~~Given I try to upload a file that is not JPG or PNG, then I see an error indicating the allowed formats.~~ **[Deferred — profile picture upload descoped to V2 per technical spec]**
- [x] Given I have not set a profile picture, then I see the first letter of my display name as a default avatar.

---

## 3. Scope and Boundaries

### In-Scope

- Sign-up form with display name, email, password, and confirm password fields
- Password requirements (8+ characters, one uppercase letter, one number) with inline validation
- Automatic sign-in and redirect to the app after successful sign-up
- Sign-in with email and password
- Account lockout after 5 consecutive failed sign-in attempts (auto-unlocks after 15 minutes)
- Password reset via email link (single-use, expires after 1 hour)
- Profile page: update display name, email (with new-email confirmation and old-email security alert), password (requires current password), and profile picture (JPG/PNG, max 5 MB)
- Default avatar showing first letter of display name when no photo is set

### Out-of-Scope

The following are separate roadmap items and will be defined in their own specifications:

- **Accounts & Wallets** — creating and managing financial accounts (cash, bank card, savings)
- **Income Sources** — defining and logging income entries
- **Custom Expense Categories** — creating and managing spending categories
- **Expense Logging** — recording individual expenses
- **Account Transfers** — moving money between own accounts
- **Budget Limits** — per-category monthly spending ceilings
- **Dashboard & Overview** — at-a-glance financial summary
- **Reports & Charts** — spending charts and category breakdowns
- **Multi-Currency Workspace, Base Value Anchor, Crypto Integrations, Mobile Apps** — all Phase 5 features
