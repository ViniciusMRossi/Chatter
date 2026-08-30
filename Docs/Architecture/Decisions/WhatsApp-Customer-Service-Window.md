# Chatter Decision Record — WhatsApp Customer-Service Window

## Status

**Accepted / Frozen**

## Decision

Chatter will **not** persist, cache, or maintain conversation history in order to determine whether the WhatsApp customer-service window is open.

Meta remains the authority for whether a specific free-form send is currently permitted.

## Architectural Reason

Chatter is transport/integration infrastructure.

Persisting `lastInboundAt`, hidden conversation state, or a provider-policy cache would make Chatter responsible for business conversation state.

Such state would also be unreliable after restarts or periods where the process did not observe messages unless Chatter owned complete history, which it explicitly does not.

## Capability Consequence

`message.send` describes semantic support for sending a message.

The WhatsApp customer-service window is provider policy/state, not semantic support.

Therefore Chatter must not dynamically remove `message.send` based on hidden historical state.

## Canonical Flow

```text
Application requests free-form send
→ Chatter performs local structural/semantic validation
→ WhatsApp adapter sends to Meta
→ Meta accepts or rejects
→ adapter normalizes the result
```

## Normalized Error

If Meta rejects because the customer-service window is closed:

```text
category: ProviderPolicyError
code: WHATSAPP_CUSTOMER_SERVICE_WINDOW_EXPIRED
retryable: false
cause: original provider error
```

Do not classify this as `MessageDeliveryError`.

Do not include a generic Core field such as:

```text
recovery: send-template
```

The stable provider-specific error code is sufficient for an application/provider extension to offer the template workflow.

## Mapping Rule

Map the condition using stable provider numeric/structured error information.

Do not match human-readable error text.

Map it in the shared WhatsApp provider-error layer so the behavior is consistent for text, media, reply, and interactive operations.

## Application Responsibility

An application that already stores conversation history may proactively predict that the free-form window is likely closed.

That optimization remains application logic.

The provider response remains authoritative.

## Retry Rule

Do not automatically retry the same free-form state-changing operation.

The caller may choose another operation explicitly.

## Tests

Required:

1. known expired-window provider error → `ProviderPolicyError`;
2. stable `WHATSAPP_CUSTOMER_SERVICE_WINDOW_EXPIRED` code;
3. `retryable === false`;
4. original provider error preserved internally as `cause`;
5. default serialized error excludes sensitive `cause`;
6. unrelated provider errors do not map to this code;
7. mapping is shared across free-form WhatsApp send variants;
8. no conversation persistence is required;
9. provider-specific template path can be exercised separately when test infrastructure permits it.
