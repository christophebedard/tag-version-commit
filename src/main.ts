import * as core from '@actions/core';
// import { context, GitHub } from '@actions/github';

async function run(): Promise<void> {
  try {
    core.info('Running action/tag-version-commit');
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
