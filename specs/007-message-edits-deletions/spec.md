# Feature Specification: Message Edits and Deletions

**Feature Branch**: `007-message-edits-deletions`

**Created**: 2026-08-22

**Status**: Draft

**Input**: User description: "Message edits and deletions for Chatter, feature 007. Depth-first Telegram completion continues here, after 006-mentions. Three distinct halves: (1) inbound edits, which Telegram delivers as separate `edited_message`/`edited_channel_post` updates the adapter currently ignores entirely — core needs to express 'this message replaced an earlier one', and the spec must pin whether that dispatches as a new message superseding the prior one or as a distinct edit event, the way FR-017 was pinned in 006; `edit_date` must be distinguishable from the original send time, and 006's mention mapping must apply to edited content too. (2) inbound deletions, which Telegram does NOT report at all — a hard provider constraint that must be stated as an explicit non-capability rather than left to look like an oversight, with no polling or diffing invented to simulate it. (3) outbound edit and delete operations, which are available and must be capability-gated, surfacing the provider's real constraints: a time window on deleting others' messages, an error rather than a no-op when editing to identical content, and separate endpoints for text versus caption chosen by the same branch discipline 006 established. The shared conformance suite is still send()-oriented; 006 bolted on a single mention-specific inbound hook and reactions will need a third, so this feature should generalize inbound emission rather than add another bespoke hook — keeping 006's rule that an adapter declaring a capability without supplying its hook FAILS loudly rather than skipping. Out of scope: reactions, interactive components, Slack, and any attempt to synthesize deletion events Telegram does not send."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A developer is told when a message they already received changed (Priority: P1)

A developer building on Chatter has already received and acted on a message. Someone then edits
that message. The developer wants to be told — with the message's new content, and enough
information to know *which* previously-received message it replaces — so what their application
showed or stored can be brought back in line with what the conversation now actually says.

**Why this priority**: Today an edited message is invisible: the adapter drops the update
entirely, so an application's view of a conversation silently diverges from the real one and stays
wrong indefinitely. Everything else in this feature is an operation the developer chooses to
perform; this is the one that closes an existing correctness gap they cannot work around.

**Independent Test**: Deliver a synthetic inbound message, then a synthetic edit of that same
message, and confirm the application is notified of the change with the new content and the
identifier of the message it replaces — no real provider credentials involved.

**Acceptance Scenarios**:

1. **Given** a message that was previously delivered, **When** its text is edited, **Then** the
   application is notified of an edit carrying the message's new text.
2. **Given** any edit notification, **When** the application inspects it, **Then** it carries the
   same message identifier as the original delivery, so the application can correlate the two
   without matching on content.
3. **Given** any edit notification, **When** the application inspects its timestamps, **Then** the
   time the message was originally sent and the time it was last edited are separately available,
   and the original send time is unchanged from the first delivery.
4. **Given** an edit that adds or removes a reference to a person, **When** the application
   inspects the edit, **Then** the references reported reflect the edited content, not the
   original content.
5. **Given** an edit to a message whose original the application never received (for example, the
   application started after that message was sent), **When** the edit arrives, **Then** the
   application is still notified, and is not required to hold prior state to make sense of it.
6. **Given** an application written before this feature existed, **When** an edit arrives, **Then**
   its existing handling of newly-created messages is not invoked — it neither sees a duplicate
   message nor changes behavior until it opts in to edits.

---

### User Story 2 - A developer changes a message their application already sent (Priority: P1)

A developer whose application posted a message — a status line, a result that has since been
recalculated, a message with a typo — wants to change what that message says in place, rather than
posting a correction underneath it.

**Why this priority**: Editing is the paired half of receiving edits and the more commonly reached
for of the two outbound operations. An application that can only append is forced to produce a
running log where a single updating message is what the situation calls for.

**Independent Test**: Ask the adapter to edit a known message and confirm the request carries the
new content to the right message, and that the outcome reported back identifies the message
edited — verifiable against a stubbed provider with no real credentials.

**Acceptance Scenarios**:

1. **Given** a message the application previously sent, **When** the developer requests an edit
   with new text, **Then** the message's content is changed in place and the developer is told the
   edit succeeded.
2. **Given** a message whose content is a caption on an attachment rather than standalone text,
   **When** the developer requests an edit, **Then** the caption is the thing changed, and the
   request is not made as though the message were a text message.
3. **Given** an edit request naming a message that does not exist or cannot be reached, **When**
   it is attempted, **Then** the developer receives a categorized failure identifying the target as
   the problem, not a generic failure.
4. **Given** a provider that does not support editing, **When** the developer requests an edit,
   **Then** they receive an explicit unsupported-capability failure before any request is made to
   the provider.

---

### User Story 3 - A developer removes a message from the conversation (Priority: P2)

A developer wants to remove a message from a conversation entirely — one their application sent
that is now obsolete, or, where the account is permitted to, one someone else sent.

**Why this priority**: Deleting is genuinely useful but less frequently reached for than editing,
and an application can usually tolerate an obsolete message remaining while it cannot tolerate
never learning that a message changed. It is separable: shipping edits without deletes leaves a
coherent, useful feature.

**Independent Test**: Ask the adapter to delete a known message and confirm the request targets
that message and reports its outcome; separately confirm that a provider-refused deletion surfaces
as a categorized failure — verifiable against a stubbed provider.

**Acceptance Scenarios**:

1. **Given** a message the application sent, **When** the developer requests its deletion, **Then**
   the message is removed and the developer is told the deletion succeeded.
2. **Given** a deletion the provider refuses because the account lacks permission, **When** it is
   attempted, **Then** the developer receives a categorized authorization failure, distinguishable
   from the message simply not existing.
3. **Given** a deletion the provider refuses because too much time has passed, **When** it is
   attempted, **Then** the developer receives a categorized failure that makes the refusal
   attributable to the provider's constraint rather than to a bug in their own code.
4. **Given** a provider that does not support deletion, **When** the developer requests one,
   **Then** they receive an explicit unsupported-capability failure before any request is made to
   the provider.

---

### User Story 4 - A developer learns what is actually supported before relying on it (Priority: P3)

A developer wants to know, at runtime and without reading provider documentation or checking a
provider's name, which of these three things the connected account can actually do: report edits
made by others, edit a message, and delete a message. In particular they want to discover — not
assume — that being notified when someone deletes a message is something no connected provider
currently offers.

**Why this priority**: The capability model already exists and applications already branch on it,
so this extends an established pattern rather than breaking new ground. It matters most for the
deletion-notification gap, which is otherwise indistinguishable from an unfinished feature.

**Independent Test**: Inspect a connected account's reported capabilities and confirm each of the
three is reported independently and truthfully, and that no capability claims to report inbound
deletions.

**Acceptance Scenarios**:

1. **Given** a connected account, **When** the developer inspects its capabilities, **Then**
   receiving edits, editing a message, and deleting a message are each reported separately, so an
   account offering one is not assumed to offer the others.
2. **Given** any connected account, **When** the developer looks for a capability meaning "this
   account will tell me when a message is deleted", **Then** no such capability exists to be
   declared, and the documentation states this is a provider limitation rather than unfinished
   work.

---

### Edge Cases

- **An edit that changes nothing observable.** A provider may report an edit whose visible content
  matches what was already delivered. The application is notified anyway; Chatter does not compare
  content to decide whether an edit was "real", because it does not retain the previous content to
  compare against (FR-005).
- **Repeated edits of the same message.** Each edit produces its own notification carrying the
  content as of that edit. Notifications are not coalesced, and a later edit does not invalidate an
  earlier one the application already handled.
- **The same edit delivered twice.** A provider may redeliver an update, for example after a
  webhook acknowledgement is lost. Duplicate suppression must cover edits exactly as it already
  covers new messages, or a redelivery becomes a spurious second edit.
- **An edit that only changes an attachment caption.** The caption is the message's content, and
  the edit is reported against the same message identifier as any other edit.
- **An edit that removes a message's text entirely.** The notification reports the message as
  having no text, rather than reporting empty text or failing to map.
- **Editing a message to content identical to what it already has.** Some providers treat this as
  an error rather than a no-op. See FR-020.
- **Deleting a message that was already deleted.** The provider reports the message as
  unreachable; this surfaces as a categorized invalid-target failure, not as success.
- **An edit or deletion requested in a conversation the account is no longer part of.** Surfaces as
  a categorized failure attributable to the target or to authorization, according to what the
  provider reports.
- **An edit arriving for a message the application already deleted.** Chatter has no way to know
  the message was deleted and reports the edit; ignoring it is the application's decision.
- **Malformed or unmappable edit updates.** An edit that cannot be mapped is skipped without taking
  down the connection, consistent with how unmappable inbound messages are already treated.

## Requirements *(mandatory)*

### Functional Requirements

#### Receiving edits

- **FR-001**: The system MUST notify applications when a previously-deliverable message's content
  is changed by the provider, for both messages whose content is text and messages whose content is
  an attachment caption.
- **FR-002**: An edit MUST be reported as a distinct kind of notification, separate from the
  notification used for newly-created messages. It MUST NOT be reported by re-issuing a
  created-message notification.

  *Rationale, recorded so this is not re-litigated*: applications written against the existing
  created-message notification append or act on what they receive. Re-issuing an edit through that
  same channel would make every one of them silently double-handle it — appending a duplicate or
  re-running a side effect — with no way to tell the two apart. A separate notification kind is
  ignored by default by every existing consumer, making edits additive rather than breaking.
- **FR-003**: An edit notification MUST carry the same message identifier as the original delivery
  of that message, so an application can correlate the two without comparing content.
- **FR-004**: An edit notification MUST carry the message's full content as of the edit, not a
  description of what changed.
- **FR-005**: An edit notification MUST NOT carry the message's previous content, and the system
  MUST NOT retain message content in order to supply it.

  *Rationale, recorded so this is not re-litigated*: supplying the prior content requires
  remembering every message delivered. The project constitution forbids Chatter from owning message
  history and from persisting message content by default. "What it said before" is therefore the
  application's to keep if it needs it — a spec-level boundary, not a gap in the mapping.
- **FR-006**: A message MUST expose the time it was originally sent and the time it was last edited
  as separately readable values. The original send time MUST NOT be overwritten by an edit.
- **FR-007**: A message that has never been edited MUST NOT carry a last-edited value at all,
  keeping its shape identical to what it was before this feature existed.
- **FR-008**: Where an adapter reports references to people within message content, an edit
  notification MUST report the references present in the edited content, including reporting none
  when an edit removed the only reference.
- **FR-009**: Duplicate-delivery suppression MUST apply to edit notifications on the same terms it
  already applies to new messages, so a provider redelivering an update does not produce a second
  edit notification.
- **FR-010**: An edit that cannot be mapped MUST be skipped without terminating the connection or
  preventing subsequent updates from being processed.
- **FR-011**: The system MUST notify applications of an edit even when the message it edits was
  never delivered to that application, and MUST NOT require prior knowledge of the message.

#### Not receiving deletions

- **FR-012**: The system MUST NOT offer any capability asserting that an adapter will report
  messages deleted by others.

  *Rationale, recorded so this is not mistaken for unfinished work*: the current provider sends no
  notification of any kind when a message is deleted. A capability no adapter can honestly declare
  is worse than no capability, because application code would branch on something permanently false.
- **FR-013**: The system MUST NOT approximate deletion notifications by polling, by re-fetching
  conversations, or by comparing snapshots of conversation state.
- **FR-014**: Documentation MUST state that inbound deletion notification is unavailable because the
  provider does not offer it, distinguishing a provider limitation from a feature not yet built.

#### Editing and deleting messages

- **FR-015**: Applications MUST be able to request that a previously-sent message's content be
  changed in place, identifying the message by the identifier they were given when it was sent.
- **FR-016**: Applications MUST be able to request that a message be removed from its conversation,
  identifying it the same way.
- **FR-017**: An edit request MUST change the message's caption when the message's content is a
  caption, and its text when the message's content is text. The choice MUST be made from what the
  message actually carries, not assumed.
- **FR-018**: Both operations MUST be gated by separately declared capabilities, and MUST fail with
  an explicit unsupported-capability error — before contacting the provider — when the connected
  account does not declare the relevant one.
- **FR-019**: Failures of either operation MUST be reported as categorized errors, distinguishing at
  minimum: the target message cannot be reached, the account is not permitted to perform the
  operation, the provider refused because a time limit has passed, and the provider is temporarily
  unavailable.
- **FR-020**: When a provider rejects an edit because the new content is identical to the message's
  current content, the system MUST report that rejection as a categorized failure. It MUST NOT
  report success, and MUST NOT suppress the rejection.

  *Rationale, recorded so this is not re-litigated*: reporting success would mean Chatter deciding
  that a request the provider refused should be presented to the application as having been carried
  out. That is interpretation of provider behavior, not transport of it, and it is the kind of
  convenience that hides a real bug — an application whose edit silently "succeeds" every time
  because it is computing the same content repeatedly has a defect Chatter would be concealing.
  The cost is accepted knowingly: an application that edits on a timer will encounter this
  rejection routinely and must handle it.

  The failure MUST NOT be reported in a category that misattributes the cause — in particular not
  as the target being unreachable and not as an authorization problem, since both would send a
  developer looking for a defect that is not there. Which category carries it is settled in
  planning; the constraint is that it be truthful and consistently applied.
- **FR-021**: The system MUST NOT locally pre-judge whether a provider's time limit on an operation
  has passed. Such requests MUST be attempted and the provider's answer reported.

  *Rationale*: a time limit evaluated against a local clock is wrong near the boundary whenever
  clocks disagree, and would refuse operations the provider would have accepted.
- **FR-022**: A successful edit or deletion MUST report an outcome identifying the message acted on,
  consistent in shape with what sending a message already reports.

#### Proving the contract holds

- **FR-023**: The shared conformance suite MUST be able to exercise inbound behavior generally,
  rather than through a mechanism specific to any one inbound feature.

  *Rationale*: the suite was built entirely around sending. The previous feature added a single hook
  for its own inbound case; this feature needs inbound emission a second time and reactions will
  need it a third. A third bespoke hook makes the pattern permanent.
- **FR-024**: An adapter that declares any capability introduced by this feature but does not supply
  what the conformance suite needs to exercise it MUST fail the suite with an explicit message, and
  MUST NOT be silently skipped.
- **FR-025**: The conformance suite MUST verify, for any adapter declaring inbound edit reporting,
  that: edits arrive as the distinct notification kind and not as created-message notifications; the
  identifier matches the original; original and last-edited times are separately present and the
  original is unchanged; and a never-edited message carries no last-edited value.
- **FR-026**: The conformance suite MUST verify, for any adapter declaring either outbound
  operation, that a request against a target the provider rejects surfaces as a categorized error
  rather than as a generic failure or a silent success — including an edit rejected for identical
  content (FR-020), which MUST NOT pass as a success.
- **FR-027**: The fake adapter used for credential-free testing MUST support every capability this
  feature introduces, so the contract is exercised without a real provider account.

### Key Entities

- **Message**: gains a last-edited time, distinct from and never replacing its existing original
  send time, and absent entirely when the message has never been edited. All other attributes,
  including its identifier, are unchanged by an edit.
- **Edit notification**: a new kind of event alongside the existing created-message event, carrying
  the account it belongs to and the message in its edited state. Carries no previous state.
- **Capability**: gains three independently declarable entries — reporting inbound edits, editing a
  message, and deleting a message. Deliberately gains nothing for inbound deletions.
- **Operation outcome**: what an edit or deletion reports on success, identifying the message acted
  on, shaped consistently with what sending already reports.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An application displaying a conversation reflects an edit made to a message it has
  already shown, without restarting, re-fetching the conversation, or comparing message text itself.
- **SC-002**: An application written before this feature and left unchanged behaves identically
  after it: no duplicated messages, no new notifications routed into its existing handling, and no
  change to any message it receives that has never been edited.
- **SC-003**: A developer can determine whether the connected account supports each of the three
  operations, and can determine that deletion notification is unavailable, using only runtime
  information — never a provider name and never external documentation.
- **SC-004**: Every failure mode of editing and deleting listed in FR-019 and FR-020 is
  distinguishable programmatically, without inspecting a human-readable message string.
- **SC-005**: All behavior introduced by this feature is verifiable with no real provider account or
  credential.
- **SC-006**: An adapter that claims one of this feature's capabilities without honoring it fails the
  shared conformance suite, and the failure names what is missing.
- **SC-007**: Adding a further inbound-only feature to the conformance suite requires no new
  feature-specific emission mechanism.

## Assumptions

- **Scope of who may be edited or deleted.** Outbound edit and delete requests are not restricted by
  Chatter to messages the account itself sent. Chatter forwards the request and reports what the
  provider answers, because deciding who may change which message is the provider's authorization
  model; reimplementing it locally would both duplicate it and drift from it. An account the
  provider permits to remove another participant's message may do so through Chatter.
- **Content of an edit request.** Editing changes textual content — a message's text or its
  attachment caption. Replacing a message's attachment, or adding an attachment to a message that
  has none, is not editing and is out of scope.
- **Ordering.** Edit notifications are delivered in the order the provider reports them. Chatter does
  not reorder, buffer, or delay them to align with the messages they edit, so an edit may reach an
  application before it has finished handling the original.
- **Exact capability identifiers** and the precise names of new types are settled during planning
  rather than here, subject to the requirement that inbound edit reporting and outbound editing be
  named distinguishably enough that an adapter cannot plausibly declare one while meaning the other.
- **Existing behavior reused.** The connection lifecycle, signature verification, duplicate
  suppression, and error categorization established by earlier features apply unchanged; this feature
  extends them rather than introducing parallel mechanisms.
- **Telegram is the only adapter in scope.** Requirements are written provider-agnostically so a
  future adapter is bound by them, but only the existing Telegram adapter and the fake adapter are
  implemented here.

## Out of Scope

- Reactions, interactive components, and any Slack adapter work.
- Synthesizing deletion notifications the provider does not send, by any means.
- Supplying an edited message's previous content (FR-005).
- Replacing or adding attachments as part of an edit.
- Editing or deleting messages in bulk.
