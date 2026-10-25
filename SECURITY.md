# Security Policy

## Reporting a vulnerability

**Please don't report security issues in public issues, pull requests or anywhere else public.**

Report them privately through GitHub instead:
[**Report a vulnerability**](https://github.com/logigator/logigator/security/advisories/new)
(or the _Security_ tab of this repository → _Report a vulnerability_). Only the maintainers can see
the report.

Include as much of this as you can:

- what the issue is and what an attacker could do with it
- the steps to reproduce it, or a proof of concept
- the affected part (editor, website, API) and URL or endpoint
- any idea you have for a fix

## What happens next

- You get an acknowledgement within a few days.
- We confirm the issue, work out a fix and keep you posted on progress in the advisory.
- Once the fix is deployed, the advisory is published. You're credited in it unless you'd rather not
  be.

Please give us a reasonable time to fix the issue before you disclose it anywhere.

## Scope

In scope are the hosted service at [logigator.com](https://logigator.com) and the code on this
repository's `master` branch: the editor, the website and the API. Only the newest release gets
security fixes.

When testing against logigator.com, use only accounts and circuits you own, and don't run automated
scanners, load tests or anything else that degrades the service for other people. Prefer a local
copy of the stack (see the [README](README.md#running-it-locally)) wherever you can.

Out of scope:

- `logigator-editor-legacy/` and `logigator-backend/`, which are kept for reference and not deployed
- reports from automated scanners without a demonstrated impact
- missing best-practice headers or settings without a concrete way to exploit them
- denial of service through sheer request volume
- social engineering of maintainers or users
