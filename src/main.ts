// Copyright (c) 2020-2021 Christophe Bedard
// See LICENSE file for details.

import {getInput, setFailed, info, setOutput, debug} from '@actions/core';
import {exec} from '@actions/exec';
import {context, getOctokit} from '@actions/github';
import {count_capture_groups} from './utils';

async function run_throws(): Promise<void> {
  // Inputs
  const token = getInput('token');
  const version_regex = getInput('version_regex');
  const version_assertion_command = getInput('version_assertion_command');
  const version_tag_prefix = getInput('version_tag_prefix');
  const input_commit = getInput('commit');
  const check_entire_commit_message = getInput('check_entire_commit_message') === 'true';
  const annotated = getInput('annotated') === 'true';
  const dry_run = getInput('dry_run') === 'true';

  // Validate regex (will throw if invalid)
  const regex = new RegExp(version_regex);
  debug(`Regex: ${regex.source}`);

  // Make sure there is at most one capture group
  const num_capture_groups = count_capture_groups(regex);
  if (1 < num_capture_groups) {
    setFailed(`More than one capture group: ${num_capture_groups} > 1`);
    return;
  }

  // Get data from context
  const repo_owner = context.repo.owner;
  const repo_name = context.repo.repo;
  let commit_sha = input_commit.length === 0 ? context.sha : input_commit;
  debug(`Using commit: ${commit_sha}`);

  const octokit = getOctokit(token);

  // Get message of last commit
  const commit = await octokit.rest.git.getCommit({
    owner: repo_owner,
    repo: repo_name,
    commit_sha
  });
  if (200 !== commit.status) {
    setFailed(`Failed to get commit data (status=${commit.status})`);
    return;
  }

  // Check if the commit matches the version regex
  const commit_message = commit.data.message;
  const commit_message_array = commit_message.split('\n');
  const commit_title = commit_message_array[0];
  // Check either commit title or the whole commit message depending on the option
  const commit_text_to_check = check_entire_commit_message ? commit_message : commit_title;
  debug(`Checking commit text: ${commit_text_to_check}`);
  const version_regex_match = regex.exec(commit_text_to_check);
  if (!version_regex_match) {
    info(
      `Commit ${
        check_entire_commit_message ? 'message' : 'title'
      } does not match version regex '${version_regex}': '${commit_text_to_check}'`
    );
    setOutput('tag', '');
    setOutput('message', '');
    setOutput('commit', '');
    return;
  }
  // Without any capture group, there is only one element, but if there is a
  // capture group, the captured group match will be the second/last element;
  // if there are multiple capture groups, just use the last one for now
  const version = version_regex_match[version_regex_match.length - 1];

  // Run version assertion command if one was provided
  if (version_assertion_command.length > 0) {
    const command_with_version = version_assertion_command.replace(/\$version/g, version);
    debug(`Running version assertion command: ${command_with_version}`);
    const return_code = await exec('bash', ['-c', command_with_version], {
      ignoreReturnCode: true
    });
    debug(`Result of version assertion command: ${return_code}`);
    if (return_code !== 0) {
      setFailed(`Version assertion failed. Double check the version: ${version}`);
      return;
    }
  }

  let tag_message = '';
  if (annotated) {
    // Use the commit body, i.e. lines after the commit title while
    // skipping the 2nd line of the commit message, since it should be
    // an empty line separating the commit title and the commit body
    tag_message = commit_message_array.slice(2).join('\n');
  }

  // Create tag
  const tag_name = version_tag_prefix + version;
  debug(
    `Creating tag '${tag_name}' on commit ${commit_sha}${
      annotated ? ` with message: '${tag_message}'` : ''
    }`
  );

  if (!dry_run) {
    // Let the GitHub API return an error if they already exist
    if (annotated) {
      const tag_response = await octokit.rest.git.createTag({
        owner: repo_owner,
        repo: repo_name,
        tag: tag_name,
        message: tag_message,
        object: commit_sha,
        type: 'commit'
      });
      if (201 !== tag_response.status) {
        setFailed(`Failed to create tag object (status=${tag_response.status})`);
        return;
      }
    }
    const ref_response = await octokit.rest.git.createRef({
      owner: repo_owner,
      repo: repo_name,
      ref: `refs/tags/${tag_name}`,
      sha: commit_sha
    });
    if (201 !== ref_response.status) {
      setFailed(`Failed to create tag ref (status=${ref_response.status})`);
      return;
    }
  }

  info(
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
  setOutput('tag', tag_name);
  setOutput('message', tag_message);
  setOutput('commit', commit_sha);
}

export async function run(): Promise<void> {
  try {
    await run_throws();
  } catch (error) {
    setFailed(error.message);
  }
}

run();
