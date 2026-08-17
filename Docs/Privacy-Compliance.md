# Privacy & Compliance

Owned by: Privacy/Compliance Engineer.

Any feature touching personal data must be checked against this document **before**
implementation, the same way stack decisions are checked against the Tech Stack Constitution.

## Applicable regimes

- LGPD (Brazil)
- GDPR (EU/EEA)
- UK GDPR (UK)
- CCPA/CPRA (California)
- PIPEDA (Canada)
- Privacy Act (Australia)

## Data handling rules

Chatter is transport infrastructure, not a data controller/processor in the traditional sense —
it does not run its own backend or database. Its privacy posture is defined by what it
deliberately does *not* do (see product requirements NFR-012, NFR-004):

- **No persistence by default.** Chatter must not write message content, participant profile
  data, or attachments to disk, a database, or any store by default. Any temporary in-memory
  buffering (e.g. dedup caches per FR-013) must be bounded, time-limited, and documented — never
  presented as durable storage.
- **No content interpretation.** Chatter does not read message content for any purpose beyond
  passing it through (no logging of message bodies by default, no classification, no analytics
  extraction). This keeps Chatter itself outside the "processing" boundary for most content-level
  obligations — the host application, which does interpret and may store content, owns that
  compliance surface.
- **Provider IDs are opaque and unmerged.** Chatter exposes provider-scoped participant/
  conversation identifiers (Section 6 of the requirements doc) but never attempts to merge
  identities across providers or resolve them to a real-world person. Cross-provider identity
  resolution — and any consent model that implies — is explicitly a host-application concern.
- **Secrets never logged.** Tokens, signing secrets, and webhook secrets must never appear in
  logs, error messages, or debug output at any log level. Documentation must recommend injecting
  them via environment variables or a secrets manager, never hardcoding.
- **Raw payload opt-in.** Raw provider payloads (FR-008) may contain PII beyond the normalized
  model (e.g. phone numbers, profile photos, location shares). Exposing them must be opt-in and
  documented as potentially sensitive — never on by default.
- **Consent, retention, right-to-erasure, breach notification, data residency:** these are the
  host application's responsibility, since Chatter holds no durable store of personal data to
  retain, erase, or breach. Adapter documentation (NFR-011) must call out any provider-side
  retention Chatter cannot control (e.g. a provider's own server-side message retention).
- **Revisit per adapter:** WhatsApp (Phase 4) introduces business-account and template
  constraints with their own compliance surface (e.g. opt-in messaging windows under Meta's
  policies) — document those in the WhatsApp adapter's own setup docs when that phase starts,
  not here.

## Data inventory

Personal data that passes *through* Chatter in memory during normal operation (not stored):

| Data | Source | Where it lives | Who can access it |
|---|---|---|---|
| Provider participant/account/conversation IDs (opaque strings) | Inbound provider events | In-process memory only, for the duration of event dispatch | The host application via event handlers |
| Message text content | Inbound provider events | In-process memory only, for the duration of event dispatch | The host application via event handlers |
| Attachment descriptors (URLs/metadata, not the binary by default) | Inbound provider events | In-process memory only | The host application |
| Provider credentials (bot tokens, signing secrets, API keys) | Host application configuration | In-process memory (and wherever the host application's secret manager/env stores them — outside Chatter's control) | The adapter instance holding them; must never be logged |
| Raw provider payloads (opt-in) | Inbound provider events | In-process memory only, when explicitly enabled | The host application, if raw access is enabled |

No database, file store, or third-party analytics service is part of Chatter itself. If an
example application (per MVP scope) adds its own storage, that storage and its data inventory
must be documented separately in that example's own docs, not here.
