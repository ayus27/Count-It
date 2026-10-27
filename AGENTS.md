<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Rules
- Counters live in `counters` (per user); daily counts/visitors in `tally_days` keyed by (user_id, day). Totals use `counters.role`, not names, so renaming never breaks the math.
- Initialize defaults through the authenticated atomic initialize_counters RPC; archive duplicate roles and normalize their counts into the active role to prevent repeated initialization without losing history.
- Store generated report snapshots on tally_days separately from live counts so historical names and totals remain stable; display history within the tally screen.
- Generate remarks deterministically from report entries, snapshot descriptions and remarks with reports, and use calls dialed as the shared subcategory percentage denominator; avoid inferring unique students or unrecorded intentions because subcategory counts may overlap.
- Persist appearance in browser storage and apply data-theme to the document so explicit choices override the system preference.
