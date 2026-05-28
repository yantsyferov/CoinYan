# CoinYan — Claude Code Instructions

## Test Debugging Protocol

When a test fails, follow this fixed workflow — do NOT deviate or loop:

### Step 1: Run the failing test in isolation
```bash
cd frontend && npx playwright test <test-file> --reporter=list 2>&1 | tail -50
```
Never run the full suite to debug a single test.

### Step 2: Read the error output carefully
- Look at the exact assertion that failed
- Check the line number and the actual vs expected values
- Read the page snapshot or screenshot path if included

### Step 3: Make ONE focused hypothesis and fix
- Identify the single most likely root cause
- Make the minimal change to fix it
- Do not refactor, rename, or touch unrelated code

### Step 4: Verify with a single re-run
```bash
cd frontend && npx playwright test <test-file> --reporter=list 2>&1 | tail -50
```

### Step 5: If still failing after 2 attempts — STOP and report
Do not attempt a third fix. Instead:
- Describe exactly what the test expects vs what is happening
- Show the relevant code diff you already tried
- Ask the user how to proceed

## Test Commands

| Purpose | Command |
|---|---|
| Run all tests | `cd frontend && npx playwright test` |
| Run one file | `cd frontend && npx playwright test tests/<file>.spec.ts` |
| Run with grep | `cd frontend && npx playwright test --grep "test name"` |
| Show UI (debug) | `cd frontend && npx playwright test --ui` |
| Headed mode | `cd frontend && npx playwright test --headed` |

Always `cd frontend` before running playwright commands.

## Services

The app requires running Docker services. Before running tests, ensure:
```bash
docker-compose up -d
```

The frontend dev server must be running on `http://localhost:5173`:
```bash
cd frontend && npm run dev
```

## General Rules

- Maximum **2 fix attempts** per failing test before reporting to user
- Never run `npm run dev` and tests in the same shell — use background processes
- When stuck, prefer asking the user over guessing
