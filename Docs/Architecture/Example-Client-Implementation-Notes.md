# Chatter Example Client — Implementation Notes After Core Freeze

The visual/product design remains frozen as `Chatter-Client-Design-Spec-v1.2.1-Frozen.zip`.

These notes reconcile Core decisions without reopening the design.

## Lifecycle

The design's conceptual `degraded` row is unreachable in Chatter V1 because Core currently exposes:

```text
idle
starting
ready
reconnecting
failed
stopping
stopped
```

Do not invent a `degraded` Core state merely to exercise the row. The design explicitly treats lifecycle names as conceptual/mappable.

## Capabilities

Capability resolution remains available while an account is unhealthy. Effective sendability is:

```text
account health
+
contextual capability support
```

not an empty capability set caused by `failed`/`reconnecting`.

## Provider Content

Provider extension renderers key off stable provider-prefixed `ProviderContent.type` values.

Enumeration/discovery of every possible provider content type remains non-blocking unless a provider feature needs it.

## SentMessage Without Ref

A successful send may produce a `SentMessage` without `ref` if a provider does not return a stable id. The optimistic row may settle as sent but cannot expose reply/reaction/entity-targeted actions until a real ref is known.

## Privacy

Canonical refs may include provider-native personal identifiers. Do not place raw canonical refs in browser URLs/logs when they expose PII; application routing should use an application-safe opaque route key or encode/redact appropriately.

## Customer-Service Window

The WhatsApp extension may recognize:

```text
WHATSAPP_CUSTOMER_SERVICE_WINDOW_EXPIRED
```

and offer the existing template workflow. Core does not provide a generic recovery instruction.
