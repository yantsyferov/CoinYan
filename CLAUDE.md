# CoinYan — Claude Code Instructions

## Module-Specific Instructions

Each module has its own `.claude/CLAUDE.md` with instructions tailored to that service or package. When working inside a specific directory, read that file first:

- `frontend/.claude/CLAUDE.md` — Playwright test protocol, test commands, dev server setup
- `services/auth-service/.claude/CLAUDE.md`
- `services/accounts-service/.claude/CLAUDE.md`
- `services/categories-service/.claude/CLAUDE.md`
- `services/transactions-service/.claude/CLAUDE.md`
- `services/budgets-service/.claude/CLAUDE.md`
- `services/rates-service/.claude/CLAUDE.md`
- `services/web-bff/.claude/CLAUDE.md`

## Global Prerequisites

All modules depend on the Docker services being up. Before doing any development or testing, run:

```bash
docker-compose up -d
```
