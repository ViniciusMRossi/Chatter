# Quickstart: Validating the Repository / Workspace Foundation

**Feature**: `001-repository-workspace-foundation` | **Date**: 2026-08-31

How to prove F1 actually works, once it is implemented. Every command runs **inside the canonical
development container** — results obtained on the host are not evidence (SC-011).

> **These are planned acceptance commands, not a record of executed runs.** None of them can run
> until F1 is implemented: there is no workspace, no lockfile and no toolchain yet. Expected outputs
> below are the acceptance criteria, not observations.

---

## How these probes are run

Every multi-command probe is delivered to the container as a **self-contained script with its own
strict shell**, never pasted into an interactive shell:

```bash
bash scripts/dev.sh exec bash -ls <<'PROBE'
set -euo pipefail
…
PROBE
```

Three properties matter, and each exists because the alternative silently passes:

1. **The script sets its own `set -euo pipefail`.** It must never rely on inherited `errexit` — an
   interactive container shell (`scripts/dev.sh shell`) does not provide it, so a block that assumed
   it would run every remaining line after a failed assertion and still exit 0.
2. **Every mandatory comparison has an explicit failure path**, via the `fail` helper. A bare
   `[ "$a" = "$b" ] && echo ok` is *not* an assertion: it prints nothing and continues when false,
   and the block's exit status ends up being whatever the last command returned.
3. **The probe's exit status is the acceptance verdict.** `0` means every assertion held; anything
   else means at least one did not. Nothing after an assertion may mask its status.

Probes that deliberately trigger a failure (`P-DIVERGE`, `P-UNDECLARED`) capture the tested command's
**raw status** with `set +e` / `set -e`, print it as RED evidence, and then assert it was non-zero —
so the probe fails if the command unexpectedly *succeeded*. Both mutate a file and both install a
`trap … EXIT INT TERM` before mutating, so the file is restored on success, on assertion failure, and
on interruption.

**Not every piece of evidence is an assertion.** Where a check is genuinely human inspection, it is
labelled **[inspection]**. See `plan.md` D13 for the full split.

Probes are referred to by **stable labels** (`P-MEMBERS`, `P-LOAD`, …) rather than by number, so
inserting one never invalidates a cross-reference in `plan.md`, `data-model.md` or the contract.

Related: [plan.md](./plan.md) · [research.md](./research.md) ·
[data-model.md](./data-model.md) · [contracts/workspace-member.contract.md](./contracts/workspace-member.contract.md)

---

## Prerequisites

- A container runtime running on the host.
- The development container built from the F1 Dockerfile and started:

  ```bash
  bash scripts/dev.sh up
  ```

- Nothing else. F1 requires no host toolchain: `node`, `pnpm` and `tsc` live in the image.

---

## Scenario 1 · `P-TOOLCHAIN` — The toolchain is present at the pinned versions **[assertion]**

**Proves**: FR-027, US1 acceptance scenario 5.

```bash
bash scripts/dev.sh exec bash -ls <<'PROBE'
set -euo pipefail
fail() { printf 'ASSERT FAILED: %s\n' "$*" >&2; exit 1; }

node_v="$(node --version)"
[ "$node_v" = "v24.20.0" ] || fail "node: expected v24.20.0, got $node_v"

pnpm_v="$(pnpm --version)"
[ "$pnpm_v" = "11.24.0" ] || fail "pnpm: expected 11.24.0, got $pnpm_v"

tsc_v="$(pnpm exec tsc --version)"
[ "$tsc_v" = "Version 6.0.3" ] || fail "tsc: expected 'Version 6.0.3', got '$tsc_v'"

echo "OK: node $node_v, pnpm $pnpm_v, $tsc_v"
PROBE
```

**Expected**: exit 0 and the `OK:` line.

`bash -ls` is a **login** shell on purpose — `scripts/verify.sh` runs commands through `bash -lc`, so
that is the shell whose `PATH` actually matters. A toolchain that only resolves in an interactive
shell would pass a casual check and fail verification.

---

## Scenario 2 · `P-LOCK` — Lock immutability and a stable resolved set **[assertion]**

**Proves**: FR-026, FR-029, US1 acceptance scenarios 1 and 3, SC-007.

*(SC-001 and SC-011 are proven end to end by `P-VERIFY`, which exercises the documented entry point
from a cold checkout; this probe proves only the install half.)*

```bash
bash scripts/dev.sh exec bash -ls <<'PROBE'
set -euo pipefail
fail() { printf 'ASSERT FAILED: %s\n' "$*" >&2; exit 1; }

clean_modules() { rm -rf node_modules packages/*/node_modules apps/*/node_modules; }
lock_digest()   { sha256sum pnpm-lock.yaml | cut -d' ' -f1; }
store_set()     { find node_modules/.pnpm -mindepth 1 -maxdepth 1 -printf '%f\n' | LC_ALL=C sort; }

baseline="$(lock_digest)"

clean_modules
pnpm install --frozen-lockfile
[ "$(lock_digest)" = "$baseline" ] || fail "install 1 rewrote pnpm-lock.yaml"
store_set > /tmp/resolved.1

clean_modules
pnpm install --frozen-lockfile
[ "$(lock_digest)" = "$baseline" ] || fail "install 2 rewrote pnpm-lock.yaml"
store_set > /tmp/resolved.2

diff -u /tmp/resolved.1 /tmp/resolved.2 \
  || fail "resolved dependency set differs between two frozen-lock installs"

count="$(wc -l < /tmp/resolved.1)"
[ "$count" -gt 0 ] || fail "virtual store is empty; the comparison would be vacuous"

echo "OK: lock digest stable ($baseline); $count virtual-store entries identical across both installs"
PROBE
```

**Expected**: exit 0 and the `OK:` line.

**Why a content digest rather than `git status`.** The question is "did the install rewrite the
lock?", and a SHA-256 comparison answers exactly that — identically whether `pnpm-lock.yaml` is
untracked, staged or committed. `git status --porcelain pnpm-lock.yaml` is the wrong instrument
during F1: the lockfile is newly created, so it reports as untracked both when the install left it
alone and when the install rewrote it.

**What "identical resolved dependency set" means concretely.** Two things are compared: the lockfile
digest (unchanged by either install) and the sorted entry list of the virtual store
`node_modules/.pnpm`, which is the *materialised* resolution rather than a restatement of the lock.
The non-empty guard exists so the comparison cannot pass by comparing nothing to nothing.

---

## Scenario 3 · `P-DIVERGE` — A lock/manifest disagreement is rejected **[assertion, mutating]**

**Proves**: US1 acceptance scenario 4, SC-007.

```bash
bash scripts/dev.sh exec bash -ls <<'PROBE'
set -euo pipefail
fail() { printf 'ASSERT FAILED: %s\n' "$*" >&2; exit 1; }

MANIFEST=packages/core/package.json
BACKUP="$(mktemp)"
cp "$MANIFEST" "$BACKUP"
restore() { cp "$BACKUP" "$MANIFEST"; }
trap 'restore; rm -f "$BACKUP"' EXIT INT TERM

lock_before="$(sha256sum pnpm-lock.yaml | cut -d' ' -f1)"

# Introduce a dependency the committed lock does not know about.
jq '.dependencies = ((.dependencies // {}) + {"chatter-lockfile-divergence-probe": "1.0.0"})' \
   "$BACKUP" > "$MANIFEST"

# Capture the RAW status of the tested command; errexit must not swallow it.
set +e
pnpm install --frozen-lockfile > /tmp/divergence.red.log 2>&1
red_status=$?
set -e

echo "--- RED evidence: pnpm install --frozen-lockfile exited $red_status ---"
cat /tmp/divergence.red.log
echo "--- end RED evidence ---"

[ "$red_status" -ne 0 ] \
  || fail "frozen-lock install SUCCEEDED against a divergent manifest; it must fail"

[ "$(sha256sum pnpm-lock.yaml | cut -d' ' -f1)" = "$lock_before" ] \
  || fail "the failed install rewrote pnpm-lock.yaml"

restore
cmp "$BACKUP" "$MANIFEST" || fail "manifest was not restored byte-identically"

pnpm install --frozen-lockfile
[ "$(sha256sum pnpm-lock.yaml | cut -d' ' -f1)" = "$lock_before" ] \
  || fail "the GREEN install rewrote pnpm-lock.yaml"

echo "OK: divergence rejected (raw exit $red_status), manifest restored byte-identically, lock untouched, GREEN install clean"
PROBE
```

**Expected**: exit 0, RED evidence showing a **non-zero** `pnpm` status, and the `OK:` line. The probe
fails if the install unexpectedly succeeds, if the failed install rewrote the lock, if restoration is
not byte-identical, or if the GREEN install fails. The `trap` runs on normal exit, on assertion
failure and on interruption, so the manifest cannot be left mutated.

---

## Scenario 4 · `P-MEMBERS` — Membership is exactly the frozen layout **[assertion]**

**Proves**: FR-001, FR-006, US2 acceptance scenarios 1 and 4, SC-002.

*(FR-002 — members are real, resolvable packages rather than placeholder directories — is proven
jointly here and by `P-MANIFESTS`, which asserts each manifest's contents.)*

> **The workspace root is a pnpm project but not a member.** Recursive `list` reports *every*
> workspace project including the root — the root-exclusion behaviour of `exec`, `run`, `test` and
> `add` does **not** apply to `list`. Raw output therefore has **nine** entries, not eight. The raw
> count and the root's identity are stated as acceptance conditions below, so they are **asserted**,
> not merely printed.

```bash
bash scripts/dev.sh exec bash -ls <<'PROBE'
set -euo pipefail
fail() { printf 'ASSERT FAILED: %s\n' "$*" >&2; exit 1; }

root="$(pwd -P)"
pnpm list --recursive --depth -1 --json > /tmp/ws.json

total="$(jq 'length' /tmp/ws.json)"
[ "$total" = "9" ] || fail "expected 9 workspace projects (8 members + root), got $total"

root_names="$(jq -r --arg root "$root" '[.[] | select(.path == $root) | .name] | join(",")' /tmp/ws.json)"
[ "$root_names" = "chatter" ] \
  || fail "expected exactly one root project named 'chatter', got '$root_names'"

jq -r --arg root "$root" '.[] | select(.path != $root) | .name' /tmp/ws.json \
  | LC_ALL=C sort > /tmp/members.actual
cat > /tmp/members.expected <<'EOF'
@chatter/core
@chatter/discord
@chatter/slack
@chatter/telegram
@chatter/testing
@chatter/whatsapp
chatter-example-client
chatter-validation-server
EOF
diff -u /tmp/members.expected /tmp/members.actual \
  || fail "member NAME set does not match the frozen layout"

jq -r --arg root "$root" '.[] | select(.path != $root) | .path' /tmp/ws.json \
  | sed "s|^$root/||" | LC_ALL=C sort > /tmp/paths.actual
cat > /tmp/paths.expected <<'EOF'
apps/example-client
apps/validation-server
packages/core
packages/discord
packages/slack
packages/telegram
packages/testing
packages/whatsapp
EOF
diff -u /tmp/paths.expected /tmp/paths.actual \
  || fail "member PATH set does not match the frozen layout"

bruno_entries="$(ls -A bruno/ | LC_ALL=C sort | tr '\n' ' ')"
[ "$bruno_entries" = ".gitkeep " ] \
  || fail "bruno/ must contain only .gitkeep, found: $bruno_entries"

echo "OK: 9 projects (root 'chatter' + 8 members); name and path sets match; bruno/ holds no collections"
PROBE
```

**Expected**: exit 0 and the `OK:` line. Every comparison exits non-zero when false — including both
`diff`s, so the path comparison cannot mask a failed name comparison.

---

## Scenario 5 · `P-MANIFESTS` — Manifest metadata conforms to the approved contract **[assertion]**

**Proves**: FR-002, FR-003, FR-004, FR-005, FR-007, FR-012, FR-016, FR-032, FR-034, US2 acceptance
scenarios 2 and 3; contract clauses C1.1, C2.1, C2.2, C3.1, C3.2 and the root rules in `plan.md` D2.

The check is data-driven: one loop over the six libraries, one over the two applications, and one
block for the root, with the expected values held in variables so they stay aligned with the contract
artifact rather than being restated per package.

```bash
bash scripts/dev.sh exec bash -ls <<'PROBE'
set -euo pipefail
fail() { printf 'ASSERT FAILED: %s\n' "$*" >&2; exit 1; }

ENGINE='>=24.0.0'
LIB_VERSION='0.0.0'
PNPM_PIN='11.24.0'
TS_PIN='6.0.3'

# ---------------- library packages (contract C2) ----------------
for dir in core testing whatsapp slack telegram discord; do
  m="packages/$dir/package.json"
  [ -f "$m" ] || fail "missing $m"

  name="$(jq -r '.name // ""' "$m")"
  [ "$name" = "@chatter/$dir" ] || fail "$m: name expected '@chatter/$dir', got '$name'"

  # plan.md D3 and contract C2.1 fix every F1 library at 0.0.0 — nothing is released yet, so the
  # expected value is exact rather than a shape. A glob such as [0-9]*.[0-9]*.[0-9]* would accept
  # '1foo.2bar.3baz' and '1.2.3junk'.
  version="$(jq -r '.version // ""' "$m")"
  [ "$version" = "$LIB_VERSION" ] || fail "$m: version expected exactly '$LIB_VERSION', got '$version'"

  type="$(jq -r '.type // ""' "$m")"
  [ "$type" = "module" ] || fail "$m: type expected 'module', got '$type'"

  eng="$(jq -r '.engines.node // ""' "$m")"
  [ "$eng" = "$ENGINE" ] || fail "$m: engines.node expected '$ENGINE', got '$eng'"

  # exports: exactly one '.' subpath, with `types` declared BEFORE `default`
  subpaths="$(jq -r '(.exports // {}) | keys | join(",")' "$m")"
  [ "$subpaths" = "." ] || fail "$m: exports must declare exactly the '.' subpath, got '$subpaths'"
  conds="$(jq -r '.exports["."] | keys_unsorted | join(",")' "$m")"
  [ "$conds" = "types,default" ] \
    || fail "$m: exports['.'] conditions expected 'types,default' in that order, got '$conds'"
  [ "$(jq -r '.exports["."].types' "$m")" = "./dist/index.d.ts" ] \
    || fail "$m: exports['.'].types must be './dist/index.d.ts'"
  [ "$(jq -r '.exports["."].default' "$m")" = "./dist/index.js" ] \
    || fail "$m: exports['.'].default must be './dist/index.js'"

  # fields a library must NOT declare
  for f in main module browser publishConfig private; do
    [ "$(jq -r --arg f "$f" 'has($f)' "$m")" = "false" ] || fail "$m: must not declare '$f'"
  done
  for s in prepublishOnly prepack publish release version; do
    [ "$(jq -r --arg s "$s" '(.scripts // {}) | has($s)' "$m")" = "false" ] \
      || fail "$m: must not declare script '$s'"
  done
done

# ---------------- applications (contract C3) ----------------
for dir in validation-server example-client; do
  m="apps/$dir/package.json"
  [ -f "$m" ] || fail "missing $m"

  name="$(jq -r '.name // ""' "$m")"
  [ "$name" = "chatter-$dir" ] || fail "$m: name expected 'chatter-$dir', got '$name'"

  [ "$(jq -r '.private' "$m")" = "true" ] || fail "$m: private must be true"
  [ "$(jq -r '.type // ""' "$m")" = "module" ] || fail "$m: type must be 'module'"
  [ "$(jq -r '.engines.node // ""' "$m")" = "$ENGINE" ] \
    || fail "$m: engines.node must be '$ENGINE'"
  [ "$(jq -r 'has("exports")' "$m")" = "false" ] \
    || fail "$m: applications must not declare an exports map"
  [ "$(jq -r 'has("publishConfig")' "$m")" = "false" ] \
    || fail "$m: applications must not declare publishConfig"

  # Documented version rule: absent, or exactly the permitted '0.0.0' fallback.
  if [ "$(jq -r 'has("version")' "$m")" = "true" ]; then
    v="$(jq -r '.version' "$m")"
    [ "$v" = "0.0.0" ] \
      || fail "$m: applications carry no version, or exactly the documented '0.0.0' fallback; got '$v'"
  fi
done

# ---------------- root manifest (plan.md D2) ----------------
m=package.json
[ -f "$m" ] || fail "missing root $m"
[ "$(jq -r '.name // ""' "$m")" = "chatter" ] || fail "root: name must be 'chatter'"
[ "$(jq -r '.private' "$m")" = "true" ] || fail "root: private must be true"
[ "$(jq -r '.type // ""' "$m")" = "module" ] || fail "root: type must be 'module'"
[ "$(jq -r '.engines.node // ""' "$m")" = "$ENGINE" ] || fail "root: engines.node must be '$ENGINE'"
[ "$(jq -r '.packageManager // ""' "$m")" = "pnpm@$PNPM_PIN" ] \
  || fail "root: packageManager must be 'pnpm@$PNPM_PIN'"

ts="$(jq -r '.devDependencies.typescript // ""' "$m")"
[ "$ts" = "$TS_PIN" ] \
  || fail "root: devDependencies.typescript must be exactly '$TS_PIN' (no range prefix), got '$ts'"

devcount="$(jq -r '(.devDependencies // {}) | length' "$m")"
[ "$devcount" = "1" ] \
  || fail "root: expected exactly one devDependency (typescript), got $devcount"
[ "$(jq -r '(.dependencies // {}) | length' "$m")" = "0" ] \
  || fail "root: must declare no production dependencies"

scripts="$(jq -r '(.scripts // {}) | keys | sort | join(",")' "$m")"
[ "$scripts" = "build,clean,verify" ] \
  || fail "root: scripts expected exactly 'build,clean,verify', got '$scripts'"
[ "$(jq -r '.scripts.build' "$m")"  = "tsc -b" ]         || fail "root: build must be 'tsc -b'"
[ "$(jq -r '.scripts.clean' "$m")"  = "tsc -b --clean" ] || fail "root: clean must be 'tsc -b --clean'"
[ "$(jq -r '.scripts.verify' "$m")" = "pnpm run build" ] || fail "root: verify must be 'pnpm run build'"

echo "OK: 6 library, 2 application and 1 root manifest conform to D2/D3 and contract C1-C3"
PROBE
```

**Expected**: exit 0 and the `OK:` line.

Two of these deserve a note. Asserting the root's script set is *exactly* `build,clean,verify` and
that `build` is literally `tsc -b` is what makes **FR-016** (no bundler) checkable — a bundler would
have to appear either as a script or as a second devDependency, and both are asserted away. Asserting
the absence of `publishConfig` and of publish/release scripts across all nine manifests is part of
**FR-032/FR-034**; the rest of the publication evidence is in `P-ZERO`.

---

## Scenario 6 · `P-BUILD` — One root command builds all eight **[assertion]**

**Proves**: FR-014, FR-015, SC-003.

```bash
bash scripts/dev.sh exec bash -ls <<'PROBE'
set -euo pipefail
fail() { printf 'ASSERT FAILED: %s\n' "$*" >&2; exit 1; }

pnpm run clean
pnpm run build

for p in core testing whatsapp slack telegram discord; do
  for artefact in index.js index.js.map index.d.ts index.d.ts.map; do
    [ -f "packages/$p/dist/$artefact" ] || fail "missing packages/$p/dist/$artefact"
  done
done

for a in validation-server example-client; do
  [ -f "apps/$a/dist/main.js" ] || fail "missing apps/$a/dist/main.js"
done

echo "OK: 8 members built; 6 libraries emitted .js/.js.map/.d.ts/.d.ts.map; 2 applications built"
PROBE
```

**Expected**: exit 0 and the `OK:` line. A library that compiles but emits no declarations fails here.

Any `.d.ts` the applications emit is a by-product of `composite: true`, which `tsc -b` requires
(see `plan.md` → Complexity Tracking); nothing asserts or depends on it.

### `P-ORDER` — Inspecting the build order **[inspection]**

The canonical build stays exactly `tsc -b`. To observe the ordering, use the compiler's own reporting
rather than a different build:

```bash
bash scripts/dev.sh exec bash -lc 'pnpm exec tsc -b --verbose'
```

This is read by a human — parsing compiler progress output into an assertion would be brittle, and a
wrong reference graph already fails `P-EDGES`.

**Expected ordering**: `packages/core` before every other member. The graph is **two levels deep, not
three** —

```text
packages/core                        ← level 0: no internal dependency
   ↓
   ├── packages/testing              ← level 1: seven direct dependants of core,
   ├── packages/whatsapp               mutually independent, buildable in any order
   ├── packages/slack
   ├── packages/telegram
   ├── packages/discord
   ├── apps/validation-server
   └── apps/example-client
```

**Do not expect the applications after the libraries**: nothing orders them relative to
`packages/testing` or the provider packages. The only ordering guarantee to verify is `core` first.

---

## Scenario 7 · `P-LOAD` — Library entry points load synchronously **[assertion]**

**Proves**: FR-013, SC-006 (and reinforces SC-009). Must run **after** `P-BUILD`.

Absence of `await` in `src/` proves nothing about the delivered package: the `exports` map could point
at a path that does not exist, its conditions could be ordered wrongly, or the emitted output could be
invalid — all invisible to source inspection.

```bash
bash scripts/dev.sh exec bash -ls <<'PROBE'
set -euo pipefail
fail() { printf 'ASSERT FAILED: %s\n' "$*" >&2; exit 1; }

failed=""
for p in core testing whatsapp slack telegram discord; do
  set +e
  ( cd "packages/$p" && node --input-type=commonjs -e "
      const ns = require('@chatter/$p');
      if (ns === null || typeof ns !== 'object') {
        throw new Error('did not receive a module namespace');
      }
      const keys = Object.keys(ns);
      if (keys.length !== 0) {
        throw new Error('unexpected exports: ' + keys.join(','));
      }
    " )
  status=$?
  set -e
  if [ "$status" -eq 0 ]; then
    echo "ok   @chatter/$p"
  else
    echo "FAIL @chatter/$p (exit $status)"
    failed="$failed @chatter/$p"
  fi
done

[ -z "$failed" ] || fail "library entry points failed to load:$failed"

echo "OK: all six library entry points load synchronously with zero exports"
PROBE
```

**Expected**: six `ok` lines, the `OK:` line, exit 0. The loop reports every failure rather than
stopping at the first; the final assertion converts any failure into a non-zero probe status.

**What each part is doing**

- **`cd packages/$p` then `require('@chatter/$p')`** — resolution happens **by package name through
  the delivered `exports` map**, using Node's self-reference resolution, which requires that map to
  be present and correct (contract C2.2). A file-path load would bypass the configuration under test.
- **`require()` of an ES module** — unflagged on the pinned Node 24.20.0 baseline, and Node throws
  **`ERR_REQUIRE_ASYNC_MODULE`** if the entry graph needs asynchronous evaluation. That is the
  synchronicity test.
- **`--input-type=commonjs`** — explicit, because every manifest declares `"type": "module"`.
- **zero own keys** — gives SC-009 a runtime check alongside its inspection.

**Deliberately not used**: dynamic `import()`. It confirms ordinary ESM consumption but **cannot**
distinguish synchronous from asynchronous evaluation, so it is complementary, never a substitute.

**Scope**: this proves *Chatter's own* entry graphs are synchronously loadable. Per FR-013 it is not,
and must not be reported as, a promise of universal legacy CommonJS compatibility. Applications are
excluded — they declare no `exports` map.

---

## Scenario 8 · `P-EDGES` — The declared edge set is exactly the approved graph **[assertion]**

**Proves**: FR-017, FR-019, FR-020, FR-021, FR-022, FR-023, FR-024, US3 acceptance scenarios 1 and 3,
SC-004, SC-005.

```bash
bash scripts/dev.sh exec bash -ls <<'PROBE'
set -euo pipefail
fail() { printf 'ASSERT FAILED: %s\n' "$*" >&2; exit 1; }

MEMBERS="packages/core packages/testing packages/whatsapp packages/slack packages/telegram packages/discord apps/validation-server apps/example-client"

: > /tmp/deps.actual
: > /tmp/refs.actual
: > /tmp/extraneous
: > /tmp/badproto

for m in $MEMBERS; do
  [ -f "$m/package.json" ]  || fail "missing manifest: $m/package.json"
  [ -f "$m/tsconfig.json" ] || fail "missing tsconfig: $m/tsconfig.json"

  # Internal production dependencies, normalised to the member directory they name.
  jq -r '(.dependencies // {}) | keys[] | select(startswith("@chatter/"))' "$m/package.json" \
    | while IFS= read -r dep; do printf '%s -> packages/%s\n' "$m" "${dep#@chatter/}"; done \
    >> /tmp/deps.actual

  # FR-024: every internal dependency VALUE must be exactly the workspace protocol.
  jq -r --arg m "$m" \
    '(.dependencies // {}) | to_entries[]
       | select(.key | startswith("@chatter/"))
       | select(.value != "workspace:*")
       | "\($m): \(.key) = \(.value)"' \
    "$m/package.json" >> /tmp/badproto

  # Anything else in production dependencies is unexpected in F1 — this is where a provider
  # SDK or a stray external dependency would show up.
  jq -r --arg m "$m" \
    '(.dependencies // {}) | keys[] | select(startswith("@chatter/") | not) | "\($m): \(.)"' \
    "$m/package.json" >> /tmp/extraneous

  # F1 members declare no dev/peer/optional dependencies at all.
  for field in devDependencies peerDependencies optionalDependencies; do
    n="$(jq -r --arg f "$field" '(.[$f] // {}) | length' "$m/package.json")"
    [ "$n" = "0" ] || fail "$m declares $field ($n entries); F1 members declare none"
  done

  # Project references, resolved to repo-relative member directories.
  while IFS= read -r rel; do
    [ -n "$rel" ] || continue
    tgt="$(cd "$m/$rel" && pwd -P)"
    printf '%s -> %s\n' "$m" "${tgt#$PWD/}" >> /tmp/refs.actual
  done < <(jq -r '(.references // [])[].path' "$m/tsconfig.json")
done

[ ! -s /tmp/badproto ] \
  || fail "internal dependencies must use exactly 'workspace:*':$(printf '\n%s' "$(cat /tmp/badproto)")"

[ ! -s /tmp/extraneous ] \
  || fail "unexpected external production dependencies:$(printf '\n%s' "$(cat /tmp/extraneous)")"

LC_ALL=C sort -o /tmp/deps.actual /tmp/deps.actual
LC_ALL=C sort -o /tmp/refs.actual /tmp/refs.actual

cat > /tmp/edges.expected <<'EOF'
apps/example-client -> packages/core
apps/validation-server -> packages/core
packages/discord -> packages/core
packages/slack -> packages/core
packages/telegram -> packages/core
packages/testing -> packages/core
packages/whatsapp -> packages/core
EOF

diff -u /tmp/edges.expected /tmp/deps.actual \
  || fail "manifest dependency edges do not match the approved graph"
diff -u /tmp/edges.expected /tmp/refs.actual \
  || fail "project-reference edges do not match the approved graph (dual declaration broken)"

echo "OK: 7 edges, all to packages/core, value 'workspace:*', declared identically in manifests and project references"
PROBE
```

**Expected**: exit 0 and the `OK:` line.

The exact-set comparison **subsumes** the individual boundary rules rather than checking them one by
one: any provider → provider edge, any core → anything edge, any edge to `@chatter/testing`, and any
application → provider-package edge would each appear as a line the expected set does not contain.
Running the same expected set against both the manifests and the project references enforces the dual
declaration required by contract C4.1.

**FR-024 is about values, not just keys.** The `badproto` check fails a dependency declared as a
registry range (`^0.1.0`), a file path (`file:../core`), a `link:` protocol, or any workspace
variant other than `workspace:*` — all of which would satisfy an edge-name comparison while breaking
the requirement that internal dependencies resolve workspace-locally.

Provider SDKs and stray external dependencies are caught by the `extraneous` check together with the
dev/peer/optional assertion — in F1 the only dependency anywhere in the workspace is the root's
`typescript`.

---

## Scenario 9 · `P-UNDECLARED` — An undeclared cross-package import fails **[assertion, mutating]**

**Proves**: FR-025, US3 acceptance scenarios 2 and 4, SC-005. This is F1's one genuine
observed-failure/observed-pass cycle.

```bash
bash scripts/dev.sh exec bash -ls <<'PROBE'
set -euo pipefail
fail() { printf 'ASSERT FAILED: %s\n' "$*" >&2; exit 1; }

ENTRY=packages/slack/src/index.ts
BACKUP="$(mktemp)"
cp "$ENTRY" "$BACKUP"
restore() { cp "$BACKUP" "$ENTRY"; }
trap 'restore; rm -f "$BACKUP"' EXIT INT TERM

# slack does not declare @chatter/telegram — this edge exists nowhere.
printf "import '@chatter/telegram';\nexport {};\n" > "$ENTRY"

set +e
pnpm run build > /tmp/undeclared.red.log 2>&1
red_status=$?
set -e

echo "--- RED evidence: pnpm run build exited $red_status ---"
cat /tmp/undeclared.red.log
echo "--- end RED evidence ---"

[ "$red_status" -ne 0 ] \
  || fail "build SUCCEEDED with an undeclared cross-package import; it must fail"

restore
cmp "$BACKUP" "$ENTRY" || fail "entry module was not restored byte-identically"

pnpm install --frozen-lockfile
pnpm run build

echo "OK: undeclared import rejected (raw exit $red_status), entry restored byte-identically, GREEN build clean"
PROBE
```

**Expected**: exit 0, RED evidence showing a **non-zero** build status, and the `OK:` line.

> Note the boundary. F1 proves an **undeclared** import cannot resolve. Automated rejection of a
> deliberately **declared** forbidden edge is F2's manifest meta-test, and is not expected to work
> yet.

---

## Scenario 10 · `P-BASELINE` — The runtime baseline provides the required capabilities **[assertion]**

**Proves**: FR-009, SC-008.

```bash
bash scripts/dev.sh exec bash -ls <<'PROBE'
set -euo pipefail
node -e '
  const e = new Error("x", { cause: 42 });
  if (e.cause !== 42) { throw new Error("Error.cause unsupported at the declared baseline"); }
  if (typeof ReadableStream !== "function") { throw new Error("Web ReadableStream unsupported at the declared baseline"); }
  console.log("OK: Error.cause and Web ReadableStream available");
'
PROBE
```

**Expected**: exit 0 and the `OK:` line. `node -e` exits non-zero on a thrown error, and `set -e`
propagates it. The probe needs no dependency and no `@types/node`.

---

## Scenario 11 · `P-ZERO` — Zero Chatter behaviour, and no release automation **[assertion + inspection]**

**Proves**: FR-035, SC-009, SC-010.

```bash
bash scripts/dev.sh exec bash -ls <<'PROBE'
set -euo pipefail
fail() { printf 'ASSERT FAILED: %s\n' "$*" >&2; exit 1; }

# --- entry modules are byte-identical to the canonical content ---
CANON="$(mktemp)"
trap 'rm -f "$CANON"' EXIT INT TERM
printf 'export {};\n' > "$CANON"

n=0
for f in packages/*/src/index.ts apps/*/src/main.ts; do
  cmp "$CANON" "$f" || fail "$f is not byte-identical to the canonical entry module 'export {};'"
  n=$((n + 1))
done
[ "$n" -eq 8 ] || fail "expected 8 entry modules, compared $n"

# --- publication fields, scoped to the root and the eight workspace manifests only ---
MANIFESTS="package.json
packages/core/package.json
packages/testing/package.json
packages/whatsapp/package.json
packages/slack/package.json
packages/telegram/package.json
packages/discord/package.json
apps/validation-server/package.json
apps/example-client/package.json"

while IFS= read -r m; do
  [ -f "$m" ] || fail "missing manifest: $m"
  [ "$(jq -r 'has("publishConfig")' "$m")" = "false" ] || fail "$m declares publishConfig"
  for s in prepublishOnly prepack publish release changeset; do
    [ "$(jq -r --arg s "$s" '(.scripts // {}) | has($s)' "$m")" = "false" ] \
      || fail "$m declares publication script '$s'"
  done
done <<< "$MANIFESTS"

# --- release-automation artefacts anywhere in the project tree ---
# git ls-files honours .gitignore, so installed dependencies are excluded by construction.
release_hits="$(git ls-files --cached --others --exclude-standard \
  '.changeset' '.changeset/**' \
  '.release-please*' 'release-please*' '.releaserc*' 'release.config.*' \
  '.auto-changelog*' 'lerna.json' 'CHANGELOG.md' '**/CHANGELOG.md' || true)"
[ -z "$release_hits" ] \
  || fail "release-automation artefacts present:$(printf '\n%s' "$release_hits")"

echo "OK: 8 canonical entry modules; 9 manifests free of publication config; no release-automation artefacts"
PROBE
```

**Expected**: exit 0 and the `OK:` line.

Three deliberate scoping choices. The entry-module comparison is `cmp` against a canonical file, so
"byte-identical" is literally true — including the trailing newline — rather than a
command-substitution comparison that silently strips trailing whitespace. The manifest inspection
enumerates **exactly the nine project manifests** rather than scanning recursively, so it can never
report a finding from an installed dependency. And SC-010 no longer rests on three strings in
`package.json`: `git ls-files --cached --others --exclude-standard` sweeps tracked *and* untracked
files for the artefacts a release tool would introduce, while honouring `.gitignore` so
`node_modules/` is excluded by construction. Release automation appearing as a workflow is caught
separately by `P-CI`.

**[inspection]** Read the emitted declarations to confirm nothing reached the public surface. This is
not the primary evidence — `P-LOAD` already asserts at runtime that each loaded namespace has zero
own keys:

```bash
bash scripts/dev.sh exec bash -lc 'cat packages/*/dist/index.d.ts'
```

---

## Scenario 12 · `P-VERIFY` — The canonical verification surface passes from a cold checkout **[assertion]**

**Proves**: FR-030, FR-031, SC-001, SC-011, SC-012. This is the acceptance gate for the feature.

Run the three steps in order. Steps 1 and 3 are container probes; step 2 is the canonical host-side
entry point, which starts its own container run.

**Step 1 — assert the wiring, then remove every installed dependency.**

```bash
bash scripts/dev.sh exec bash -ls <<'PROBE'
set -euo pipefail
fail() { printf 'ASSERT FAILED: %s\n' "$*" >&2; exit 1; }

EXPECTED_FULL='pnpm install --frozen-lockfile && pnpm run verify'

# shellcheck disable=SC1091
. .sdd/commands.env

[ "${SDD_FULL_VERIFY_COMMAND:-}" = "$EXPECTED_FULL" ] \
  || fail "SDD_FULL_VERIFY_COMMAND must be exactly: $EXPECTED_FULL (got: '${SDD_FULL_VERIFY_COMMAND:-}')"

for v in SDD_BUILD_COMMAND SDD_LINT_COMMAND SDD_TYPECHECK_COMMAND \
         SDD_UNIT_TEST_COMMAND SDD_INTEGRATION_TEST_COMMAND; do
  [ -z "${!v:-}" ] || fail "$v must remain empty in F1 (value: ${!v})"
done

# The root verify script must be the planned F1 command — nothing more.
[ "$(jq -r '.scripts.verify' package.json)" = "pnpm run build" ] \
  || fail "root 'verify' script must be exactly 'pnpm run build'"

# Record the lock digest, then go cold.
sha256sum pnpm-lock.yaml | cut -d' ' -f1 > /tmp/lock.before
rm -rf node_modules packages/*/node_modules apps/*/node_modules dist packages/*/dist apps/*/dist
[ ! -d node_modules ] || fail "node_modules must be absent before the cold verification run"
[ ! -d packages/core/dist ] || fail "build output must be absent before the cold verification run"

echo "OK: wiring asserted; workspace is cold (no node_modules, no dist)"
PROBE
```

**Step 2 — run the canonical entry point.**

```bash
bash scripts/dev.sh verify
```

**Expected**: exit code 0, having run exactly one stage — the frozen-lock install followed by the
root build.

**Step 3 — assert it really installed and really built.**

```bash
bash scripts/dev.sh exec bash -ls <<'PROBE'
set -euo pipefail
fail() { printf 'ASSERT FAILED: %s\n' "$*" >&2; exit 1; }

[ -d node_modules/.pnpm ] \
  || fail "verify did not install dependencies from a cold state"
[ "$(sha256sum pnpm-lock.yaml | cut -d' ' -f1)" = "$(cat /tmp/lock.before)" ] \
  || fail "verify rewrote pnpm-lock.yaml; the install was not frozen"

for p in core testing whatsapp slack telegram discord; do
  [ -f "packages/$p/dist/index.js" ]   || fail "verify did not build packages/$p"
  [ -f "packages/$p/dist/index.d.ts" ] || fail "verify did not emit declarations for packages/$p"
done
for a in validation-server example-client; do
  [ -f "apps/$a/dist/main.js" ] || fail "verify did not build apps/$a"
done

echo "OK: dev.sh verify installed from the frozen lock and built all eight members from a cold checkout"
PROBE
```

**Expected**: exit 0 and the `OK:` line.

This is what makes SC-012 a real proof rather than a re-run over a warm tree. Because step 1 deletes
both `node_modules` and every `dist/`, step 3 fails if installation was skipped, if the lock was not
treated as frozen, or if the build was bypassed — the three ways the verification surface could
appear green while proving nothing. An empty lint or test variable is the correct F1 state, not an
oversight; those stages belong to F2.

Because `scripts/verify.sh` short-circuits on `SDD_FULL_VERIFY_COMMAND`, the granular variables would
never execute even if set; leaving them empty keeps the configuration honest.

None of the other probes is part of `verify`. They are acceptance evidence recorded during F1
implementation; turning them into a checked-in automated suite would pull F2's test layer into F1.

---

## Scenario 13 · `P-TECHSTACK` — The tech-stack record is updated narrowly **[assertion + inspection]**

**Proves**: SC-013, and the recording half of FR-028.

```bash
bash scripts/dev.sh exec bash -ls <<'PROBE'
set -euo pipefail
fail() { printf 'ASSERT FAILED: %s\n' "$*" >&2; exit 1; }

T=Docs/Tech-Stack.md
[ -f "$T" ] || fail "missing $T"

# The choices F1 materializes must be recorded.
for s in '24.20.0' '11.24.0' '6.0.3' 'pnpm' 'ESM-only' 'tsc -b' 'project references'; do
  grep -Fq -- "$s" "$T" || fail "$T does not record '$s'"
done

# F1 must NOT perform F3's comprehensive rewrite: the placeholders it does not own must remain.
grep -Fq -- 'Phase 0 decision' "$T" \
  || fail "$T has no 'Phase 0 decision' placeholders left; F1 must not do F3's rewrite"

echo "OK: Tech-Stack records the F1 pins and format; F2/F3 placeholders remain"
PROBE
```

**Expected**: exit 0 and the `OK:` line.

**[inspection]** Read the diff to confirm the update is narrow and factual — that it touched the
runtime, package-manager, build and full-verification entries and nothing else, and that lint,
typecheck, unit-test, integration-test and E2E entries are untouched:

```bash
bash scripts/dev.sh exec bash -lc 'git diff main -- Docs/Tech-Stack.md'
```

---

## Scenario 14 · `P-WORKFLOW` — The workflow surface still passes **[assertion]**

**Proves**: the Adoption Checklist's authority-wiring item; no regression in the SpecMan layer.

```bash
bash scripts/dev.sh check
```

**Expected**: exit 0. A CODEOWNERS warning is expected and is F3's to resolve.

---

## Scenario 15 · `P-CI` — CI passes with no workflow change **[assertion]**

**Proves**: FR-031 (no parallel CI mechanism).

`.github/workflows/quality.yml` already builds the canonical image and runs `bash scripts/dev.sh
verify` inside it, so no workflow edit is part of F1.

```bash
bash scripts/dev.sh exec bash -ls <<'PROBE'
set -euo pipefail
fail() { printf 'ASSERT FAILED: %s\n' "$*" >&2; exit 1; }

# Catches anything committed on this branch.
committed="$(git diff --stat main -- .github/)"
[ -z "$committed" ] \
  || fail "F1 must not change files under .github/ (committed on branch):$(printf '\n%s' "$committed")"

# Catches modified, staged AND untracked files in the working tree.
worktree="$(git status --porcelain --untracked-files=all -- .github/)"
[ -z "$worktree" ] \
  || fail "F1 must not add or modify files under .github/ (working tree):$(printf '\n%s' "$worktree")"

echo "OK: no CI workflow change — committed, staged, modified or untracked"
PROBE
```

**Expected**: exit 0 and the `OK:` line.

The two checks are complementary and both are needed. `git diff … main` sees only what is committed on
the branch, so an uncommitted or brand-new workflow file would be invisible to it;
`git status --porcelain --untracked-files=all` sees the working tree, including a file that has never
been added. A new `.github/workflows/release.yml` — the most likely way release automation would
enter — fails the second check even before it is staged.

The remaining CI evidence is the `verify` job passing on the F1 pull request.

---

## Coverage map

Which probe proves what. Every `Proves` line above is reflected here.

| Requirement | Probe |
|---|---|
| FR-001, FR-006 | `P-MEMBERS` |
| FR-002 | `P-MEMBERS` + `P-MANIFESTS` |
| FR-003, FR-004, FR-005, FR-007, FR-012, FR-016 | `P-MANIFESTS` |
| FR-008, FR-010, FR-027 | `P-TOOLCHAIN` (versions present) + `P-TECHSTACK` (recorded) |
| FR-009 | `P-BASELINE` |
| FR-011 | **[inspection]** — read `tsconfig.base.json` against `plan.md` D5; a compiler-default audit is not usefully assertable in F1 |
| FR-013 | `P-LOAD` |
| FR-014, FR-015 | `P-BUILD` |
| FR-017, FR-019 – FR-024 | `P-EDGES` |
| FR-018 | **[inspection]** — `.gitignore` review; `P-CI`-style status checks cover the `.github/` case |
| FR-025 | `P-UNDECLARED` |
| FR-026 | `P-LOCK`, `P-DIVERGE`, `P-VERIFY` |
| FR-028 | `P-TECHSTACK` (recording) + **[inspection]** of the Dockerfile extension point |
| FR-029, FR-030, FR-031 | `P-VERIFY`, `P-CI` |
| FR-032, FR-034 | `P-MANIFESTS`, `P-ZERO` |
| FR-033 | **[inspection]** — a pre-publication requirement recorded in the plan; nothing to execute |
| FR-035 | `P-ZERO`, `P-LOAD` |
| SC-001, SC-011, SC-012 | `P-VERIFY` |
| SC-002 | `P-MEMBERS` |
| SC-003 | `P-BUILD` |
| SC-004, SC-005 | `P-EDGES`, `P-UNDECLARED` |
| SC-006 | `P-LOAD` |
| SC-007 | `P-LOCK`, `P-DIVERGE` |
| SC-008 | `P-BASELINE` |
| SC-009 | `P-ZERO`, `P-LOAD` |
| SC-010 | `P-ZERO`, `P-CI` |
| SC-013 | `P-TECHSTACK` |

---

## What this quickstart deliberately does not do

- It runs no test suite. F1 introduces no test runner; the contract-first harness is F2. The probes
  above are one-off acceptance commands, not a checked-in suite, and none is wired into
  `pnpm run verify` or `.sdd/commands.env`.
- It runs no linter or formatter. Those are F2.
- It publishes nothing and checks no registry. Registry scope ownership for `@chatter` is unverified
  and is a **pre-publication** requirement (FR-032, FR-033).
- It exercises no Chatter behaviour, because after F1 there is none.
