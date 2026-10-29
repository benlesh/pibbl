# Continuous alpha publishing

The `Publish alpha` job in `.github/workflows/trust.yml` publishes the four
release packages after the Trust Gate succeeds on a push to `main`. It is
inactive until the repository Actions variable `CONTINUOUS_ALPHA` equals `true`.
Pull requests and manually dispatched trust runs cannot publish.

## One-time activation

1. Commit and push the workflow and release tooling changes to `benlesh/pibbl`.
2. In GitHub repository Settings → Environments, create `npm-alpha`. Restrict its
   deployment branches to `main`. Do not require reviewers for unattended alpha
   releases.
3. For each npm package (`@pibbl/core`, `@pibbl/three`, `@pibbl/text`, and `pibbl`),
   open Settings → Trusted publishing and add GitHub Actions with:
   - Organization or user: `benlesh`
   - Repository: `pibbl`
   - Workflow filename: `trust.yml`
   - Environment: `npm-alpha`
   - Allowed actions: enable direct `npm publish`. Separate dist-tag management
     is unnecessary for this job.
4. In GitHub Settings → Secrets and variables → Actions → Variables, create
   `CONTINUOUS_ALPHA` with value `true`.
5. Push a commit to `main` and inspect the Trust Gate run's Publish alpha job.
   Complete the first successful publication within npm's two-day validation
   window for a new trusted publisher configuration.

Keep npm account 2FA enabled. No npm publishing secret is required. npm may
require you to authenticate while configuring trust. See the current
[npm trusted publishing instructions](https://docs.npmjs.com/trusted-publishers/).

## Diagnose authentication without a release build

Run `gh workflow run trust.yml -f check_npm_auth=true` to check the GitHub identity
and npm token exchange for all four packages in the `npm-alpha` environment.
This diagnostic skips build/test jobs and cannot publish packages. It also compares
the installed npm CLI with the executable reached through pnpm using a dry run. It reports
registry rejection messages while redacting credentials; tokens stay in memory.
An accepted exchange does not establish a successful publication or validate a
new publisher's first-publish deadline. Normal pushes still require every trust
stage before publication.

The publishing job installs npm into an isolated runner prefix and prepends its
binaries to `GITHUB_PATH`. Both the workflow preflight and alpha publishing script
require npm 11.5.1 or newer: a successful global installation alone does not prove
that subsequent steps resolve the installed executable.

## Versions and installation

CI prepares the next patch version followed by `-alpha.RUN.ATTEMPT`, for example
`0.0.3-alpha.123.1` when the checked-in version is `0.0.2`. All four packages and
exact internal dependencies receive the same version. These edits and the
updated lockfile exist only in CI; CI does not commit or tag them.

Install with `npm install pibbl@alpha`, or use `@pibbl/core@alpha` and matching
adapter packages. This job updates only `alpha`; existing `latest` and `next`
tags remain unchanged. The existing manual publishing command retains its
previous behavior unless called with `--alpha`.

Before preparing a version, CI compares a fingerprint of committed package
inputs with the `pibblAlphaInputHash` recorded on all four npm `alpha` packages.
If their versions agree and all fingerprints match, it skips version preparation,
building, and publishing. The first alpha establishes this fingerprint.

Changes confined to `docs/`, `website/`, `playground/`, `games/`, or
`packages/scenarios/` do not publish. Everything else is conservatively included,
including package READMEs, tests, dependency manifests, lockfiles, tooling, and
workflow configuration. If package builds begin consuming an excluded directory,
update this policy and its tests. Registry errors fail the check rather than
triggering a speculative release. Different fingerprints or versions across
packages cause a new release to repair a partial publication.

Publications are serialized. A job skips its publication if a newer commit is
already on `main`. Re-running a workflow skips an already-completed unchanged release, or creates
a new attempt version if publication is still needed; this
also recovers from a partially published four-package release. Publication of
multiple npm packages is not atomic.

## Disable or graduate

Set `CONTINUOUS_ALPHA` to `false` or remove it to disable future automatic
publications. Cancel any already-running publication separately if necessary.
For stable releases, establish a deliberate tagged or approved release workflow
and configure its corresponding npm trusted publisher before using it.
