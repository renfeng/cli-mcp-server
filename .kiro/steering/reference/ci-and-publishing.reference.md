---
inclusion: manual
---

# CI, Publishing, and Repository Mirroring

## Repository Setup

- Origin: GitLab — `git@gitlab.com:renfeng.cn/terminal.git`
- Mirror: GitHub — `git@github.com:renfeng/terminal.git`
- Branch protection: `main` is protected on GitLab (Maintainers only, no force push)
- All changes go through merge requests on GitLab

### Why GitLab as Origin

GitLab provides branch protection on the free tier for public repos. GitHub requires a paid plan for branch protection on public repos. Since the ai-code-review project already uses GitLab as origin with the same pattern, this keeps the workflow consistent.

### GitHub Mirror

The `mirror-github` CI job pushes `main` to GitHub after every merge. This keeps the GitHub repo in sync for discoverability (npm links to GitHub, MCP server registries index GitHub).

The mirror job uses a deploy key (`GITHUB_DEPLOY_KEY` CI variable) with write access to the GitHub repo.

## CI Pipeline (.gitlab-ci.yml)

### Stages

| Job | Stage | Trigger | Purpose |
|-----|-------|---------|---------|
| `validate` | validate | MR + source changes | Type-check and test |
| `pipeline-guard` | validate | MR (always) | Prevent empty pipelines |
| `build` | build | main + source changes | Compile TypeScript |
| `publish-npm` | publish | main + source changes | Publish to npm |
| `mirror-github` | mirror | main (always) | Push to GitHub mirror |

### Source Change Filter

Build and publish skip when only non-source files change:
- `src/**/*`, `package.json`, `package-lock.json`, `tsconfig.json`

### npm Publish Idempotency

The publish job checks `npm view` before publishing. If the version already exists, it exits cleanly.

## npm Token

The `NPM_TOKEN` CI variable is a project-level variable on GitLab. It's an npm access token scoped to the `@renfeng` npm scope.

### Reusing the ai-code-review Token

The same npm token used for `@renfeng/ai-code-review` works for `@renfeng/cli-mcp-server` — both are under the `@renfeng` scope. The token is not transferable via API (GitLab masks it).

To set it up on the new project:

1. Copy the `NPM_TOKEN` value from your npm account or password manager
2. Add it as a CI variable on GitLab:
   ```
   Settings → CI/CD → Variables → Add variable
   Key: NPM_TOKEN
   Value: <your npm token>
   Type: Variable
   Protected: No (so MR pipelines can validate)
   Masked: Yes
   ```

### GitHub Deploy Key

For the mirror job, a deploy key with write access is needed on the GitHub repo:

1. Generate a key pair: `ssh-keygen -t ed25519 -C "gitlab-mirror" -f gitlab-mirror-key`
2. Add the public key to GitHub: `github.com/renfeng/terminal/settings/keys` (allow write access)
3. Add the private key as a CI variable on GitLab:
   ```
   Key: GITHUB_DEPLOY_KEY
   Value: <private key content>
   Type: Variable
   Protected: No
   Masked: No (SSH keys can't be masked due to multiline)
   ```

## Publishing Workflow

1. Bump version in `package.json` on a feature branch
2. Create MR targeting `main` on GitLab
3. MR pipeline runs `validate` (type-check + tests)
4. Merge the MR (fast-forward)
5. Main pipeline: `build` → `publish-npm` → `mirror-github`
6. npm package is published, GitHub mirror is updated

### Verifying

```bash
# Check pipeline
glab ci status --branch main

# Check npm
npm view @renfeng/cli-mcp-server version

# Check GitHub mirror
gh repo view renfeng/terminal --web
```

## Local Development

```bash
# Build
npm run build

# Test
npm test

# Test the MCP server locally (ctrl+C to stop)
CLI_TOOLS=echo,cat node dist/index.js
```

## Remote Configuration

| Variable | Where | Purpose |
|----------|-------|---------|
| `NPM_TOKEN` | GitLab CI variable | npm publish auth |
| `GITHUB_DEPLOY_KEY` | GitLab CI variable | SSH key for GitHub mirror push |
| Deploy key (public) | GitHub repo settings | Authorize GitLab to push |
