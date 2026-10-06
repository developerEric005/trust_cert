# Team rules
Roles: **A** Chain + Backend core | **B** AI + Data | **C** Frontend + Pitch. Each owns their folder and branch (`feature/chain`, `feature/ai`, `feature/ui`).
- Merge to `main` by pull request; another person gives a 5-minute look.
- Pull `main` before starting; push at least twice a day.
- Frozen specs in `/docs` change only after posting in the group first.
- Mock first: C builds against fake JSON matching `API.md`.
- Syncs: 9am (15 min), 6pm (30 min, full-flow demo). Feature freeze Wed 7 Oct, 2pm.
- Secrets: share privately, commit only `.env.example`. Use a throwaway test wallet only.
- Cut order if short: QR scanning, admin page (seed manually), fuzzy matching. Never cut upload > anchor > verify > mismatch > revoke.
