#!/usr/bin/env bash
set -euo pipefail

workspace_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
billing_app_dir="$workspace_root/artifacts/billing-app"
trace_dir="$billing_app_dir/test-results/print-preview"
report_dir="$billing_app_dir/playwright-report"
evidence_root="${RELEASE_EVIDENCE_DIR:-$workspace_root/release-evidence}"
retention_days="${RELEASE_EVIDENCE_RETENTION_DAYS:-14}"
run_id="${RELEASE_RUN_ID:-${GITHUB_RUN_ID:-${CI_PIPELINE_ID:-$(date -u +%Y%m%dT%H%M%SZ)}}}"
run_id="$(printf '%s' "$run_id" | tr -c 'A-Za-z0-9._-' '-')"

if [[ ! "$retention_days" =~ ^[0-9]+$ ]] || (( retention_days < 1 )); then
  echo "RELEASE_EVIDENCE_RETENTION_DAYS must be a positive integer" >&2
  exit 1
fi

retain_browser_evidence() {
  local failed_at="$1"
  local run_dir="$evidence_root/$run_id"
  local archive_path="$evidence_root/$run_id.tar.gz"

  rm -rf "$run_dir" "$archive_path"
  mkdir -p "$run_dir"

  if [[ -d "$trace_dir" ]]; then
    cp -R "$trace_dir" "$run_dir/test-results"
  else
    mkdir -p "$run_dir/test-results"
    printf '%s\n' "No Playwright trace directory was produced." > "$run_dir/test-results/README.txt"
  fi

  if [[ -d "$report_dir" ]]; then
    cp -R "$report_dir" "$run_dir/playwright-report"
  else
    mkdir -p "$run_dir/playwright-report"
    printf '%s\n' "No Playwright HTML report was produced." > "$run_dir/playwright-report/README.txt"
  fi

  cat > "$run_dir/README.md" <<EOF
# Mobilinq receipt print release evidence

- Run: \`$run_id\`
- Failed at: \`$failed_at\`
- Retention: keep this evidence for at least $retention_days days, according to the release validation environment's artifact policy.

## Evidence

- [Playwright HTML report](playwright-report/index.html)
- [Failed traces and attachments](test-results/)

The HTML report and traces are diagnostic artifacts only. They may contain
test-fixture data and must remain in the release validation environment's
protected artifact storage.
EOF

  tar -czf "$archive_path" -C "$evidence_root" "$run_id"

  local evidence_path
  evidence_path="$(cd "$run_dir" && pwd)"
  echo "Receipt browser evidence retained for at least $retention_days days."
  if [[ -n "${RELEASE_EVIDENCE_URL:-}" ]]; then
    echo "Evidence URL: ${RELEASE_EVIDENCE_URL%/}/$run_id/"
  else
    echo "Evidence directory: $evidence_path"
    echo "Evidence archive: $(cd "$evidence_root" && pwd)/$run_id.tar.gz"
  fi
}

required=(DATABASE_URL SESSION_SECRET)
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required release variable: $name" >&2
    exit 1
  fi
done

# A failed run is the only run that should leave browser evidence behind.
# Clearing these paths first prevents a successful run from exposing an older
# report, and ensures a later failure contains only the current run's files.
rm -rf "$evidence_root" "$trace_dir" "$report_dir"

pnpm --filter @workspace/api-spec run codegen
pnpm run typecheck
pnpm --filter @workspace/api-server run build

if pnpm --filter @workspace/billing-app run test:browser:release; then
  :
else
  browser_status=$?
  if ! retain_browser_evidence "receipt browser matrix"; then
    echo "Warning: receipt browser evidence could not be retained." >&2
  fi
  exit "$browser_status"
fi

echo "Release checks passed. Production deployment still requires operator approval and a reviewed backup."
