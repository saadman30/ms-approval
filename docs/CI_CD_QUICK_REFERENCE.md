# CI/CD Quick Reference

## Workflow Triggers

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | PR, Push to main/develop | Quality checks, tests, builds |
| `security.yml` | PR, Daily schedule, Manual | Security scanning |
| `docker-build.yml` | Push to main/develop, Manual | Build and push container images |
| `deploy-staging.yml` | Push to develop | Deploy to staging environment |
| `deploy-production.yml` | Tag push (v*.*.*), Manual | Deploy to production (with approval) |
| `code-quality.yml` | PR, Push | Code quality analysis |
| `performance-test.yml` | PR, Manual | Load and performance testing |
| `dependency-update.yml` | Weekly schedule, Manual | Check for dependency updates |

## Common Commands

### Check CI Status
```bash
# View workflow runs
gh workflow list
gh run list

# View specific workflow
gh run view <run-id>
gh run watch <run-id>
```

### Trigger Workflows Manually
```bash
# Trigger deployment
gh workflow run deploy-production.yml -f version=v1.2.3

# Trigger security scan
gh workflow run security.yml
```

### View Logs
```bash
# View logs for latest run
gh run view --log

# View logs for specific job
gh run view <run-id> --log
```

## Workflow Status Badges

Add to your README.md:
```markdown
![CI](https://github.com/OWNER/REPO/workflows/Continuous%20Integration/badge.svg)
![Security](https://github.com/OWNER/REPO/workflows/Security%20Scanning/badge.svg)
![Docker Build](https://github.com/OWNER/REPO/workflows/Docker%20Build%20%26%20Push/badge.svg)
```

## Troubleshooting

### Pipeline Failing?

1. **Check logs**: Click on failed job → View logs
2. **Run locally**: Reproduce the error locally
3. **Check dependencies**: Ensure all dependencies are in package.json
4. **Verify secrets**: Check if required secrets are set

### Build Too Slow?

1. **Enable caching**: Already enabled, but verify it's working
2. **Use matrix builds**: Already using, but check if all services need building
3. **Skip unchanged services**: Change detection is enabled

### Deployment Not Working?

1. **Check environment**: Verify environment exists in GitHub settings
2. **Check permissions**: Ensure you have deployment permissions
3. **Check approvals**: Production requires manual approval
4. **Check branch**: Verify branch matches deployment rules

## Environment Variables

### Required Secrets (GitHub Settings → Secrets)

| Secret | Purpose | Where Used |
|--------|---------|------------|
| `GITHUB_TOKEN` | GitHub API access | Auto-provided |
| `SONAR_TOKEN` | SonarCloud analysis | code-quality.yml (optional) |
| `DOCKER_REGISTRY_TOKEN` | Container registry | docker-build.yml (if using external registry) |

### Environment-Specific

- **Staging**: Uses `develop` branch images
- **Production**: Uses version tags (e.g., `v1.2.3`)

## Service Matrix

All services are built/tested in parallel:

- identity-service
- organization-service
- workflow-service
- billing-service
- notification-service
- audit-service
- analytics-service
- gateway

## Deployment Flow

```
Code Push
  ↓
CI Checks (lint, test, build)
  ↓
Security Scan
  ↓
Docker Build
  ↓
Staging Deploy (develop branch)
  ↓
Production Deploy (tag, with approval)
```

## Best Practices Checklist

- [ ] All tests pass before merging
- [ ] Security scans show no critical issues
- [ ] Docker images build successfully
- [ ] Staging deployment verified
- [ ] Production deployment approved
- [ ] Post-deployment smoke tests pass
- [ ] Monitoring shows healthy metrics

## Useful Links

- [Full CI/CD Guide](./CI_CD_GUIDE.md)
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
