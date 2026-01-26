# GitHub Actions Workflows

This directory contains all CI/CD workflows for the Enterprise Microservices Learning Project.

## Workflow Overview

### Core Workflows

1. **`ci.yml`** - Main continuous integration pipeline
   - Runs on: PRs and pushes to main/develop
   - Jobs: Lint, Test, Build, Security Scan, Change Detection

2. **`security.yml`** - Comprehensive security scanning
   - Runs on: PRs, daily schedule, manual trigger
   - Jobs: Dependency scan, CodeQL, Container scan, Secret scan, License check

3. **`docker-build.yml`** - Container image builds
   - Runs on: Push to main/develop (if services changed), manual trigger
   - Jobs: Build and push Docker images, Scan images

### Deployment Workflows

4. **`deploy-staging.yml`** - Staging environment deployment
   - Runs on: Push to develop branch
   - Jobs: Pre-deployment checks, Deploy, Smoke tests

5. **`deploy-production.yml`** - Production environment deployment
   - Runs on: Version tags (v*.*.*), manual trigger
   - Jobs: Validation, Integration tests, Deploy (with approval), Verification, Rollback

### Quality & Testing Workflows

6. **`code-quality.yml`** - Code quality analysis
   - Runs on: PRs and pushes to main/develop
   - Jobs: SonarCloud scan, Coverage check

7. **`performance-test.yml`** - Performance and load testing
   - Runs on: PRs to main, manual trigger
   - Jobs: Load testing, Performance reporting

### Maintenance Workflows

8. **`dependency-update.yml`** - Dependency management
   - Runs on: Weekly schedule (Monday 2 AM UTC), manual trigger
   - Jobs: Check for outdated packages, Generate reports

### Reusable Workflows

9. **`reusable-build-service.yml`** - Reusable service build workflow
   - Called by: Other workflows
   - Purpose: Standardized service build and test process

## Workflow Dependencies

```
ci.yml
  ├── lint
  ├── test (depends on: lint)
  ├── build (depends on: lint)
  ├── security-scan (depends on: lint)
  └── detect-changes

security.yml
  ├── dependency-scan
  ├── codeql-analysis
  ├── container-scan (depends on: dependency-scan)
  ├── secret-scan
  └── license-check

docker-build.yml
  ├── build-and-push
  └── scan-images (depends on: build-and-push)

deploy-staging.yml
  ├── pre-deployment
  ├── deploy (depends on: pre-deployment)
  └── smoke-tests (depends on: deploy)

deploy-production.yml
  ├── pre-deployment
  ├── integration-tests (depends on: pre-deployment)
  ├── deploy (depends on: pre-deployment, integration-tests)
  ├── post-deployment (depends on: deploy)
  └── rollback (depends on: deploy, post-deployment, runs on failure)
```

## Configuration

### Required Secrets

Configure in GitHub Settings → Secrets → Actions:

- `GITHUB_TOKEN` - Auto-provided by GitHub
- `SONAR_TOKEN` - For SonarCloud analysis (optional)
- `DOCKER_REGISTRY_TOKEN` - For external container registries (if used)

### Required Environments

Configure in GitHub Settings → Environments:

- **staging** - Staging deployment environment
- **production** - Production deployment environment (requires approval)

### Branch Protection

Recommended branch protection rules:

- **main**: Require PR reviews, require status checks, require up-to-date branches
- **develop**: Require status checks

## Usage

### Viewing Workflow Runs

```bash
# List all workflows
gh workflow list

# View recent runs
gh run list

# View specific run
gh run view <run-id>

# Watch a running workflow
gh run watch <run-id>
```

### Triggering Workflows Manually

```bash
# Trigger production deployment
gh workflow run deploy-production.yml -f version=v1.2.3

# Trigger security scan
gh workflow run security.yml

# Trigger performance tests
gh workflow run performance-test.yml
```

### Debugging Failed Workflows

1. Click on the failed workflow run
2. Click on the failed job
3. Review logs for error messages
4. Check if secrets/environments are configured
5. Verify branch protection rules

## Best Practices

1. **Always test locally** before pushing
2. **Review workflow changes** in PRs
3. **Monitor workflow runs** for failures
4. **Keep workflows updated** with latest actions
5. **Use matrix builds** for parallelization
6. **Enable caching** for faster builds
7. **Set timeouts** to prevent hanging jobs
8. **Use environment protection** for production

## Troubleshooting

See [CI/CD Guide](../docs/CI_CD_GUIDE.md#troubleshooting) for common issues and solutions.

## Contributing

When adding new workflows:

1. Follow existing naming conventions
2. Add appropriate triggers
3. Set reasonable timeouts
4. Include error handling
5. Document in this README
6. Update main CI/CD documentation

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [CI/CD Guide](../docs/CI_CD_GUIDE.md)
- [Quick Reference](../docs/CI_CD_QUICK_REFERENCE.md)
