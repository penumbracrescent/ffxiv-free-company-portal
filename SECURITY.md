# Security Policy

## Supported version

Security fixes are made against the current public release. Operators should rebuild from the latest release rather than continuing to expose an older image.

## Reporting a vulnerability

Do not publish a vulnerability, credential, member record, database dump, or exploit in a public issue. Open this repository's **Security** tab and choose **Report a vulnerability** to use GitHub Private Vulnerability Reporting. If that option is unavailable, do not open a public issue containing sensitive details; ask the maintainer to enable private reporting first. Include the affected version, deployment mode, reproducible steps, and impact. Allow reasonable time for investigation and a coordinated fix.

Installation-specific account, privacy, content, or moderation requests must go to that installation's operator using its `/privacy` contact. The open-source maintainers do not control independent deployments.

## Operator responsibilities

- Keep `.env`, backups, database ports, Docker access, Authentik credentials, Discord tokens, tunnel tokens, and Google credentials private.
- Publish HTTPS for any non-local deployment and enable HSTS at the reverse proxy or tunnel edge after HTTPS is confirmed.
- Restrict the Officer Area and database administration to trusted people, remove access promptly, and review bot role ordering and permissions.
- Apply security updates, review logs, test backups, enforce the configured retention schedule, and reconcile restored backups with deletion requests.
- Never attach an unredacted `.env`, backup, database export, or member-data export to a bug report.
