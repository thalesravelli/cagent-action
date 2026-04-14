import * as core from '@actions/core';
import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';

export async function generateAppToken(): Promise<void> {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

  if (!appId || !privateKey) {
    core.info('GitHub App credentials not available, skipping token generation');
    return;
  }

  try {
    const appOctokit = new Octokit({
      authStrategy: createAppAuth,
      auth: { appId, privateKey },
    });

    const [owner] = (process.env.GITHUB_REPOSITORY ?? '').split('/');

    // Try org installation, fall back to user installation
    let installationId: number;
    try {
      const { data } = await appOctokit.apps.getOrgInstallation({ org: owner });
      installationId = data.id;
    } catch {
      const { data } = await appOctokit.apps.getUserInstallation({
        username: owner,
      });
      installationId = data.id;
    }

    const auth = createAppAuth({ appId, privateKey });
    // GitHub excludes `workflows` from installation tokens by default, even
    // when the App has that permission. Passing `permissions` explicitly fixes
    // this, but also scopes the token DOWN to only what's listed — so we
    // request every permission the App has to avoid accidentally dropping any.
    //
    // Keep this in sync with the App's settings:
    // https://github.com/organizations/docker/settings/apps/<app>/permissions
    const { token } = await auth({
      type: 'installation',
      installationId,
      permissions: {
        // Repository permissions
        actions: 'write',
        checks: 'write',
        contents: 'write',
        issues: 'write',
        pull_requests: 'write',
        statuses: 'write',
        variables: 'read',
        workflows: 'write',
        // Organization permissions
        members: 'read',
      },
    });

    core.setSecret(token);
    core.exportVariable('GITHUB_APP_TOKEN', token);
  } catch (err) {
    core.warning(`Failed to generate GitHub App token: ${err}`);
  }
}
