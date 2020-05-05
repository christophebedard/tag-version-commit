import * as core from '@actions/core';
import {context, GitHub} from '@actions/github';

export async function run(): Promise<void> {
  try {
    // Inputs
    const token = core.getInput('token');
    const version_regex = core.getInput('version_regex');
    const version_tag_prefix = core.getInput('version_tag_prefix');
    const annotated = core.getInput('annotated') === 'true';
    const dry_run = core.getInput('dry_run') === 'true';

    // Validate regex (will throw if invalid)
    const regex = new RegExp(version_regex);

    // Get data from context
    const repo_owner = context.repo.owner;
    const repo_name = context.repo.repo;
    const commit_sha = context.sha;

    const octokit = new GitHub(token);

    // Get message of last commit
    const commit = await octokit.git.getCommit({
      owner: repo_owner,
      repo: repo_name,
      commit_sha
    });
    if (200 !== commit.status) {
      core.setFailed(`Failed to get commit data (status=${commit.status})`);
      return;
    }

    // Check if its title matches the version regex
    const commit_message = commit.data.message.split('\n');
    const commit_title = commit_message[0];
    const version_regex_match = regex.test(commit_title);
    if (!version_regex_match) {
      core.info(`Commit title does not match version regex '${version_regex}': '${commit_title}'`);
      core.setOutput('tag', '');
      core.setOutput('message', '');
      core.setOutput('commit', '');
      return;
    }

    let tag_message = '';
    if (annotated) {
      // Use the commit body, i.e. lines after the commit title while
      // skipping the 2nd line of the commit message, since it should be
      // an empty line separating the commit title and the commit body
      tag_message = commit_message.slice(2).join('\n');
    }

    // Create tag
    const tag_name = version_tag_prefix + commit_title;
    core.debug(
      `Creating tag '${tag_name}' on commit ${commit_sha}${
        annotated ? ` with message: '${tag_message}'` : ''
      }`
    );

    if (!dry_run) {
      // Let the GitHub API return an error if they already exist
      if (annotated) {
        const tag_response = await octokit.git.createTag({
          owner: repo_owner,
          repo: repo_name,
          tag: tag_name,
          message: tag_message,
          object: commit_sha,
          type: 'commit'
        });
        if (201 !== tag_response.status) {
          core.setFailed(`Failed to create tag object (status=${tag_response.status})`);
          return;
        }
      }
      const ref_response = await octokit.git.createRef({
        owner: repo_owner,
        repo: repo_name,
        ref: `refs/tags/${tag_name}`,
        sha: commit_sha
      });
      if (201 !== ref_response.status) {
        core.setFailed(`Failed to create tag ref (status=${ref_response.status})`);
        return;
      }
    }

    core.info(
      `Created tag '${tag_name}' on commit ${commit_sha}${
        annotated
          ? ` with ${
              tag_message.length === 0
                ? 'empty message'
                : `message:\n\t${tag_message.replace('\n', '\n\t')}`
            }`
          : ''
      }`
    );
    core.setOutput('tag', tag_name);
    core.setOutput('message', tag_message);
    core.setOutput('commit', commit_sha);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
