import * as core from '@actions/core';
import {context, GitHub} from '@actions/github';

export async function run(): Promise<void> {
  try {
    // Inputs
    const token = core.getInput('token');
    const version_regex = core.getInput('version_regex');
    const version_tag_prefix = core.getInput('version_tag_prefix');
    const dry_run = core.getInput('dry_run');

    // Validate regex (will throw if invalid)
    const regex = new RegExp(version_regex);

    // Get data from context
    const repo_owner = context.repo.owner;
    const repo_name = context.repo.repo;
    const commit_sha = context.sha;

    const octokit = new GitHub(token);

    // Get title of last commit
    const commit = await octokit.git.getCommit({
      owner: repo_owner,
      repo: repo_name,
      commit_sha
    });
    if (200 !== commit.status) {
      core.setFailed(`Failed to get commit data (status=${commit.status})`);
      return;
    }

    // Check if it matches the version regex
    const commit_title = commit.data.message.split('\n')[0];
    const version_regex_match = regex.test(commit_title);
    if (!version_regex_match) {
      core.info(`Commit title does not match version regex '${version_regex}': ${commit_title}`);
      core.setOutput('tag', '');
      core.setOutput('commit', '');
      return;
    }

    // Create tag
    const tag_name = version_tag_prefix + commit_title;
    core.debug(`Creating tag '${tag_name}' on commit ${commit_sha}`);

    if (!dry_run) {
      // Let the GitHub API return an error if it already exists
      const tag_response = await octokit.git.createRef({
        owner: repo_owner,
        repo: repo_name,
        ref: `refs/tags/${tag_name}`,
        sha: commit_sha
      });
      if (201 !== tag_response.status) {
        core.setFailed(`Failed to create tag (status=${tag_response.status})`);
        return;
      }
    }

    core.info(`Created tag '${tag_name}' on commit ${commit_sha}`);
    core.setOutput('tag', tag_name);
    core.setOutput('commit', commit_sha);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
