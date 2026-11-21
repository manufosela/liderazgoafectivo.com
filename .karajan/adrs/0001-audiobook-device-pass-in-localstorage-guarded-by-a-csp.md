# Audiobook device pass in localStorage guarded by a CSP

Status: accepted (by the user, in the session where it was raised, 2026-11-21)
Date: 2026-11-21

## Context

The listener must not type the code on every visit. An HttpOnly cookie would be safer, but the API lives on cloudfunctions.net and browsers block third-party cookies; a first-party API subdomain would need DNS changes at the host. The user chose localStorage with the CSP on 2026-11-21.

## Decision

The audiobook device pass (signed by the server, one year, renewed on use, void once the code is revoked) is kept in localStorage. /audiolibro ships a Content-Security-Policy that only runs the site's own scripts and only lets data go to the audiobook Cloud Functions.

## Consequences

A script running on the page could read the pass, but the CSP blocks foreign scripts and blocks sending data anywhere but the audiobook API. Revoking the code voids every pass. Moving the API to a first-party subdomain with an HttpOnly cookie remains the stronger option if the risk changes.
