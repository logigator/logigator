#!/usr/bin/env bash
# Asks the running production stack for a page from each application and
# checks the headers the edge and the applications answer with.
#
#   bash .github/scripts/smoke-test.sh
#
# Every request goes through the edge on 443, as a browser's would. The API is
# ready once it has migrated, seeded the examples and reached Postgres and
# Redis, which is the slowest part of the stack to come up.
set -euo pipefail

site=https://logigator.test

fetch() {
  curl --silent --show-error --fail --insecure \
    --resolve logigator.test:443:127.0.0.1 "$@"
}
headers_of() {
  curl --silent --show-error --insecure \
    --resolve logigator.test:443:127.0.0.1 \
    --dump-header - --output /dev/null "$1" | tr -d '\r'
}
fail() {
  echo "::error::$1"
  exit 1
}
expect_page() {
  local body
  body=$(fetch "$1")
  if [[ $body != *"$2"* ]]; then
    fail "$1 does not contain $2"
  fi
}
expect_header() {
  if ! headers_of "$1" | grep --quiet --ignore-case --extended-regexp "^$2"; then
    fail "$1 does not answer $2"
  fi
}

fetch --retry 90 --retry-delay 2 --retry-all-errors \
  --output /dev/null "$site/api/health/ready"

# Rendered on the server, through the API.
expect_page "$site/en" 'ng-server-context="ssr"'
# The origin the site derives from the forwarded host and scheme.
expect_page "$site/robots.txt" "Sitemap: $site/sitemap.xml"
# The editor's shell, at its address and at one of its routes.
expect_page "$site/editor" '<base href="/editor/">'
expect_page "$site/editor/project/smoke-test" '<base href="/editor/">'

# The security headers, on every surface. A missing file is asked for under
# `/files`, which answers its headers on a 404 as well.
for path in /en /editor /api/meta /files/smoke-test.webp; do
  expect_header "$site$path" 'X-Content-Type-Options: nosniff$'
  expect_header "$site$path" 'Referrer-Policy: strict-origin-when-cross-origin$'
  expect_header "$site$path" 'X-Frame-Options: SAMEORIGIN$'
  if headers_of "$site$path" | grep --quiet --ignore-case '^X-Powered-By:'; then
    fail "$site$path names its framework"
  fi
done
expect_header "$site/api/meta" "Content-Security-Policy: default-src 'none'; frame-ancestors 'none'$"
expect_header "$site/files/smoke-test.webp" "Content-Security-Policy: default-src 'none'; sandbox$"
expect_header "$site/editor" "Content-Security-Policy-Report-Only: .*frame-ancestors 'self'"
expect_header "$site/en" "Content-Security-Policy-Report-Only: .*'nonce-"

# Both policies report to the API, which takes a report and answers nothing.
for path in /en /editor; do
  expect_header "$site$path" "Content-Security-Policy-Report-Only: .*report-uri /api/csp-report; report-to csp"
  expect_header "$site$path" "Reporting-Endpoints: csp=\"$site/api/csp-report\"$"
done
status=$(fetch --output /dev/null --write-out '%{http_code}' \
  --header 'Content-Type: application/csp-report' \
  --data '{"csp-report":{"effective-directive":"img-src","blocked-uri":"data"}}' \
  "$site/api/csp-report" || true)
if [[ $status != 204 ]]; then
  fail "a CSP report is answered $status"
fi

# A file that exists is held a year by a browser and a day by the edge, which
# is how long a deleted one stays served. A seeded example's preview is one.
listing=$(fetch "$site/api/community/projects")
if [[ ! $listing =~ (/files/preview/[^\"]+\.webp) ]]; then
  fail 'the community listing names no preview'
fi
preview=${BASH_REMATCH[1]}
expect_header "$site$preview" 'CDN-Cache-Control: public, max-age=86400$'
expect_header "$site$preview" 'Cache-Control: public, max-age=31536000, immutable$'
if headers_of "$site/files/smoke-test.webp" | grep --quiet --ignore-case '^CDN-Cache-Control:'; then
  fail 'a missing file under /files is held at the edge'
fi
