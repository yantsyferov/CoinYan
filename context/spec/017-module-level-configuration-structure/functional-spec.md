# Functional Specification: Module-Level Configuration Structure

- **Roadmap Item:** Developer tooling — per-module configuration folders for each service and the frontend
- **Status:** Completed
- **Author:** yantsyferov

---

## 1. Overview and Rationale (The "Why")

As CoinYan grows — with 7 independent backend services and a dedicated frontend — working effectively within any single module requires understanding that module's specific context: how to run it, how it fits into the larger system, and what conventions apply. Today, all configuration guidance lives in a single root-level folder, which means a developer (or AI assistant) opening the `transactions` service or the frontend must mentally filter through instructions written for the entire project rather than for the specific module at hand.

This change introduces a dedicated configuration folder inside each module. When a developer opens any service or the frontend directory, they have immediate access to everything relevant to that module — its commands, its architecture, its rules — without noise from the rest of the system.

**Desired outcome:** Any contributor (human or AI assistant) who opens a module directory can immediately understand how to run, test, and modify that module — using only the configuration folder located directly inside it.

---

## 2. Functional Requirements (The "What")

### 2.1 — Each module receives its own dedicated configuration folder

Each of the following modules gets its own configuration folder placed directly inside its directory:

- **Authentication service** (user registration and sign-in)
- **Accounts service** (wallets and balance tracking)
- **Categories service** (expense categories)
- **Transactions service** (transaction logging and history)
- **Budgets service** (budget limits and alerts)
- **Rates service** (currency exchange rate data)
- **Web gateway** (the API layer that connects the frontend to all backend services)
- **Frontend** (the React web application)

**Acceptance Criteria:**
- [x] Opening any of the 8 modules above reveals a dedicated configuration folder inside it
- [x] The folder is present in all 8 modules without exception — including the lightweight Rates service, for consistency

### 2.2 — Each configuration folder contains a module-specific instruction file

Inside each module's configuration folder sits a single instruction file written specifically for that module. It is organized into four standard sections:

1. **Launch and Test Commands** — how to start the module, run its tests, and what environment is required
2. **Architecture Overview** — the module's role in the system, what it is responsible for, and which other modules it depends on
3. **Rules and Conventions** — what to do and avoid when modifying this module (patterns specific to this domain, known pitfalls)
4. **Key Files and Structure** — a guide to the most important directories and files inside the module

**Acceptance Criteria:**
- [x] Each module's instruction file contains all four sections
- [x] The content in every section is specific to that module — no copy-paste of global instructions
- [x] A developer who has never worked in this module before can, using only this file, understand how to start the module and find the main code

### 2.3 — The root-level configuration folder is retained for global content only

The existing root configuration folder is kept but narrowed in scope. After the restructuring it holds only content that applies to the entire project:

- Global agent definitions (e.g. Python backend specialist, React frontend specialist, DevOps)
- Global custom commands
- Global skill configurations
- Global application settings

Module-specific instructions are removed from the root level and moved into their respective module folders.

**Acceptance Criteria:**
- [x] The root configuration folder remains intact after the restructuring
- [x] No module-specific instructions remain in the root-level instruction file
- [x] All global content (agents, commands, skills, settings) remains in the root, unchanged

### 2.4 — Modules that are too large for a flat structure may receive additional nested structure

If a module's codebase is sufficiently large or complex that a single instruction file does not provide adequate guidance, that module's configuration folder may include additional internal structure. The decision is a judgment call based on observed complexity.

**Acceptance Criteria:**
- [x] Any module deemed too complex for a flat single-file layout receives additional nested folders inside its configuration folder
- [x] The reason for the expanded structure is noted in the module's instruction file

---

## 3. Scope and Boundaries

### In-Scope

- Creating a dedicated configuration folder inside each of the 8 modules listed above
- Writing a module-specific instruction file for each module, covering the four required sections
- Removing module-specific content from the root-level instruction file
- Optionally expanding the configuration folder of any module that warrants additional nested structure

### Out-of-Scope

- Changes to global agent definitions, commands, skills, or application settings (these remain in the root folder, untouched)
- Changes to any source code within the modules themselves
- Changes to the `context/spec/` directory or any existing functional/technical specification files
- Changes to Docker configuration, CI/CD pipelines, or deployment files
- All other roadmap items: Reports & Charts, Crypto & Broker Integrations, Automatic Bank Imports, Mobile Apps, Shared/Family Accounts
