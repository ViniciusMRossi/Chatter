#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "Not inside a Git repository." >&2; exit 2; }
cd "$ROOT"

echo "==> Spec Kit"; specify version

echo "==> Required bundled extensions"
for ext in git agent-context assess bug; do
  [[ -f ".specify/extensions/$ext/extension.yml" ]] || { echo "missing: $ext" >&2; exit 1; }
  echo "ok: $ext"
done

echo "==> AGENTS.md single source"
[[ -f AGENTS.md ]] || { echo "AGENTS.md missing" >&2; exit 1; }
CFG=.specify/extensions/agent-context/agent-context-config.yml
[[ -f "$CFG" ]] || { echo "$CFG missing" >&2; exit 1; }
grep -Fxq 'context_file: AGENTS.md' "$CFG" || { echo "agent-context does not target AGENTS.md" >&2; exit 1; }
grep -Fxq 'context_files: []' "$CFG" || { echo "agent-context must not manage multiple policy files" >&2; exit 1; }
grep -Fq '<!-- SPECKIT START -->' AGENTS.md || { echo "AGENTS.md missing Spec Kit managed-section marker" >&2; exit 1; }
grep -Fq '<!-- SPECKIT END -->' AGENTS.md || { echo "AGENTS.md missing Spec Kit managed-section marker" >&2; exit 1; }
for shim in CLAUDE.md GEMINI.md .github/copilot-instructions.md; do
  [[ -f "$shim" ]] || { echo "missing native shim: $shim" >&2; exit 1; }
  grep -Fq 'AGENTS.md' "$shim" || { echo "$shim does not point to AGENTS.md" >&2; exit 1; }
done

echo "==> Default integration command surface"
INTEGRATION="$(awk -F= '$1=="SDD_INTEGRATION"{print $2}' .sdd/tool-versions.env 2>/dev/null || true)"
if [[ "$INTEGRATION" == "claude" ]]; then
  required=(speckit-constitution speckit-specify speckit-clarify speckit-plan speckit-tasks speckit-analyze speckit-checklist speckit-implement speckit-converge speckit-taskstoissues speckit-git-feature speckit-assess-intake speckit-bug-assess speckit-bug-fix speckit-bug-test)
  for skill in "${required[@]}"; do [[ -f ".claude/skills/$skill/SKILL.md" ]] || { echo "missing Claude skill: $skill" >&2; exit 1; }; done
else
  echo "warning: integration '$INTEGRATION' needs a manual command-surface check."
fi

echo "==> Repository policy files"
[[ -f .gitattributes ]] || { echo ".gitattributes missing" >&2; exit 1; }
[[ -f .gitignore ]] || { echo ".gitignore missing" >&2; exit 1; }
[[ -f .github/PULL_REQUEST_TEMPLATE.md ]] || { echo "PR template missing" >&2; exit 1; }
[[ -f .github/CODEOWNERS ]] || { echo "CODEOWNERS missing" >&2; exit 1; }
if ! grep -Eq '^[[:space:]]*[^#[:space:]].*@[A-Za-z0-9_.-]+' .github/CODEOWNERS; then
  echo "warning: CODEOWNERS has no active owner yet; configure before enabling Code Owner branch protection."
fi

echo "==> Container marker"
[[ -f /.dockerenv ]] || echo "warning: workflow-check is not running inside Docker"

echo "==> Git status"; git status --short
