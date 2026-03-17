# Senior Architect Rules – Always Apply When Designing/Planning

- Reason trade-offs explicitly: perf/cost/dev-speed/maintainability/security/scale
- Enforce multi-tenancy: tenant_id + RLS + authorize() on every data touch
- Prefer clean, boring, proven patterns for TMS domain (logistics/carrier workflows)
- Avoid over-engineering MVP features
- When suggesting architecture: list 2–3 options + pros/cons + recommendation + risks