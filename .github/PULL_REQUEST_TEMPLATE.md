## Scope
- Spec: <!-- path to specs/.../spec.md or bug assessment -->
- Plan: <!-- path or N/A -->
- Tracking issues: <!-- optional -->

## Human gates
- [ ] Feature spec was approved before implementation, when full SDD applies.
- [ ] Material technical/public-contract decisions in the plan were human-approved.
- [ ] Any stack substitution was approved and recorded.

## TDD evidence
- RED command/test: <!-- exact targeted command/test -->
- RED observed failure: <!-- concise real failure -->
- GREEN command/test: <!-- exact rerun -->
- GREEN result: <!-- concise result -->
- If test-first was not practical, rationale: <!-- required when RED evidence is absent -->

## Verification
- [ ] `bash scripts/verify.sh` passed in the canonical development container.
- Verification summary:

## Convergence
- [ ] Agent-native Spec Kit converge reported converged, or appended work was completed and converge was rerun.
- [ ] No convergence task was silently deferred from this feature.

## Adversarial review
- Required by assessment/spec? yes / no
- Findings path or N/A: <!-- specs/<feature>/reviews/adversarial.md -->
- [ ] Any P0/P1 findings were resolved or explicitly accepted by the human.

## Security / privacy
- [ ] Tier 1 checks pass.
- [ ] Privacy/data-handling implications were reviewed when applicable.
- [ ] Tier 2 was only recommended/triggered by a human if applicable.

## Human review
- [ ] Final merge is performed/approved by a human decision-maker.
