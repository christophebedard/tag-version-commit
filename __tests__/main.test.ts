// Copyright (c) 2020-2021 Christophe Bedard
// See LICENSE file for details.

import * as core from '@actions/core';
import {context} from '@actions/github';
import nock from 'nock';
import {run} from '../src/main';
import * as utils from '../src/utils';

beforeEach(() => {
  jest.resetModules();

  // Reset action inputs environment variables to their default value,
  // otherwise an environment variable set in a test can creep into a later test
  process.env['INPUT_VERSION_REGEX'] = '^[0-9]+\\.[0-9]+\\.[0-9]+$';
  process.env['INPUT_VERSION_ASSERTION_COMMAND'] = '';
  process.env['INPUT_VERSION_TAG_PREFIX'] = '';
  process.env['INPUT_COMMIT'] = '';
  process.env['INPUT_CHECK_ENTIRE_COMMIT_MESSAGE'] = 'false';
  process.env['INPUT_ANNOTATED'] = 'false';
  process.env['INPUT_DRY_RUN'] = 'false';
  // Set token to simplify tests
  process.env['INPUT_TOKEN'] = '12345';

  // Set environment variables for context
  process.env['GITHUB_REPOSITORY'] = 'theowner/therepo';
  context.repo.owner = 'theowner';
  context.repo.repo = 'therepo';
  process.env['GITHUB_SHA'] = '0123456789abcdef';
  context.sha = '0123456789abcdef';
});

afterEach(() => {
  if (!nock.isDone()) {
    nock.cleanAll();
    // TODO find a better way to make the test fail
    throw new Error('Not all nock interceptors were used!');
  }
});

describe('action', () => {
  it('detects a bad version regex', async () => {
    process.env['INPUT_VERSION_REGEX'] = '[0-9';
    process.env['INPUT_VERSION_TAG_PREFIX'] = '';

    const core_setFailed = jest.spyOn(core, 'setFailed');

    await run();

    // Expect the regex exception message
    expect(core_setFailed).toHaveBeenCalledWith(
      expect.stringMatching(/^Invalid regular expression/)
    );
  });

  it('does not do anything when the commit title does not match the version regex', async () => {
    nock('https://api.github.com')
      .get('/repos/theowner/therepo/git/commits/0123456789abcdef')
      .reply(200, {
        message: 'this commit title will not match'
      });

    const core_setOutput = jest.spyOn(core, 'setOutput');

    await run();

    // Outputs should be empty
    expect(core_setOutput).toHaveBeenCalledWith('tag', '');
    expect(core_setOutput).toHaveBeenCalledWith('message', '');
    expect(core_setOutput).toHaveBeenCalledWith('commit', '');
  });

  it('works correctly with the default version regex: version in a sentence', async () => {
    nock('https://api.github.com')
      .get('/repos/theowner/therepo/git/commits/0123456789abcdef')
      .reply(200, {
        message: 'this commit title contains a 8.9.1 version'
      });

    const core_setOutput = jest.spyOn(core, 'setOutput');

    await run();

    // Outputs should be empty
    expect(core_setOutput).toHaveBeenCalledWith('tag', '');
    expect(core_setOutput).toHaveBeenCalledWith('message', '');
    expect(core_setOutput).toHaveBeenCalledWith('commit', '');
  });

  it('works correctly with the default version regex: version that could match a misformed regex', async () => {
    // This would match if '.' was used instead of '\.' (or '\\.' to escape the backslash)
    nock('https://api.github.com')
      .get('/repos/theowner/therepo/git/commits/0123456789abcdef')
      .reply(200, {
        message: '8a7a6'
      });

    const core_setOutput = jest.spyOn(core, 'setOutput');

    await run();

    // Outputs should be empty
    expect(core_setOutput).toHaveBeenCalledWith('tag', '');
    expect(core_setOutput).toHaveBeenCalledWith('message', '');
    expect(core_setOutput).toHaveBeenCalledWith('commit', '');
  });

  it('creates a tag when the commit title matches the version regex', async () => {
    nock('https://api.github.com')
      .get('/repos/theowner/therepo/git/commits/0123456789abcdef')
      .reply(200, {
        message: '1.2.3'
      });
    nock('https://api.github.com')
      .post('/repos/theowner/therepo/git/refs', {ref: 'refs/tags/1.2.3', sha: '0123456789abcdef'})
      .reply(201, {});

    const core_setOutput = jest.spyOn(core, 'setOutput');

    await run();

    expect(core_setOutput).toHaveBeenCalledWith('tag', '1.2.3');
    expect(core_setOutput).toHaveBeenCalledWith('commit', '0123456789abcdef');
  });

  it('works with a non-default version regex', async () => {
    process.env['INPUT_VERSION_REGEX'] = String.raw`[0-9]+\.[0-9]+\.[a-z]+`;

    nock('https://api.github.com')
      .get('/repos/theowner/therepo/git/commits/0123456789abcdef')
      .reply(200, {
        message: '6.9.f'
      });
    nock('https://api.github.com')
      .post('/repos/theowner/therepo/git/refs', {ref: 'refs/tags/6.9.f', sha: '0123456789abcdef'})
      .reply(201, {});

    const core_setOutput = jest.spyOn(core, 'setOutput');

    await run();

    expect(core_setOutput).toHaveBeenCalledWith('tag', '6.9.f');
    expect(core_setOutput).toHaveBeenCalledWith('commit', '0123456789abcdef');
  });

  it('works with a version regex with a capture group', async () => {
    process.env['INPUT_VERSION_REGEX'] = String.raw`Version: ([0-9]+\.[0-9]+\.[a-z]+)`;

    nock('https://api.github.com')
      .get('/repos/theowner/therepo/git/commits/0123456789abcdef')
      .reply(200, {
        message: 'Version: 6.9.z'
      });
    nock('https://api.github.com')
      .post('/repos/theowner/therepo/git/refs', {ref: 'refs/tags/6.9.z', sha: '0123456789abcdef'})
      .reply(201, {});

    const core_setOutput = jest.spyOn(core, 'setOutput');

    await run();

    expect(core_setOutput).toHaveBeenCalledWith('tag', '6.9.z');
    expect(core_setOutput).toHaveBeenCalledWith('commit', '0123456789abcdef');
  });

  it('fails if there is more than one capture group', async () => {
    // 2 groups
    process.env['INPUT_VERSION_REGEX'] = String.raw`Version: ([0-9]+\.[0-9]+\.[a-z]+)-([a-z]+)`;

    const core_setFailed = jest.spyOn(core, 'setFailed');

    await run();

    // Expect the regex exception message
    expect(core_setFailed).toHaveBeenCalledWith(
      expect.stringMatching(/^More than one capture group/)
    );

    // 3 groups
    process.env[
      'INPUT_VERSION_REGEX'
    ] = String.raw`Version: ([0-9]+\.[0-9]+\.[a-z]+)-([a-z]+)-([0-9]+)`;

    core_setFailed.mockClear();

    await run();

    // Expect the regex exception message
    expect(core_setFailed).toHaveBeenCalledWith(
      expect.stringMatching(/^More than one capture group/)
    );
  });

  it('does not do anything when the commit title does not match the version regex with a capture group', async () => {
    process.env['INPUT_VERSION_REGEX'] = String.raw`Version: ([0-9]+\.[0-9]+\.[a-z]+)`;

    nock('https://api.github.com')
      .get('/repos/theowner/therepo/git/commits/0123456789abcdef')
      .reply(200, {
        message: 'Version 6.9.e'
      });

    const core_setOutput = jest.spyOn(core, 'setOutput');

    await run();

    // Outputs should be empty
    expect(core_setOutput).toHaveBeenCalledWith('tag', '');
    expect(core_setOutput).toHaveBeenCalledWith('message', '');
    expect(core_setOutput).toHaveBeenCalledWith('commit', '');
  });

  it('only checks the commit title and not the whole message', async () => {
    nock('https://api.github.com')
      .get('/repos/theowner/therepo/git/commits/0123456789abcdef')
      .reply(200, {
        message: 'the commit title with a version later in the message\n\n3.2.1'
      });

    const core_setOutput = jest.spyOn(core, 'setOutput');

    await run();

    // Outputs should be empty
    expect(core_setOutput).toHaveBeenCalledWith('tag', '');
    expect(core_setOutput).toHaveBeenCalledWith('message', '');
    expect(core_setOutput).toHaveBeenCalledWith('commit', '');
  });

  it('uses the provided commit sha if there is one', async () => {
    process.env['INPUT_COMMIT'] = 'zyx9876543210';

    nock('https://api.github.com')
      .get('/repos/theowner/therepo/git/commits/zyx9876543210')
      .reply(200, {
        message: '1.2.9'
      });
    nock('https://api.github.com')
      .post('/repos/theowner/therepo/git/refs', {ref: 'refs/tags/1.2.9', sha: 'zyx9876543210'})
      .reply(201, {});

    const core_setOutput = jest.spyOn(core, 'setOutput');

    await run();

    expect(core_setOutput).toHaveBeenCalledWith('tag', '1.2.9');
    expect(core_setOutput).toHaveBeenCalledWith('commit', 'zyx9876543210');
  });

  it('works if the version assertion command works', async () => {
    process.env['INPUT_VERSION_ASSERTION_COMMAND'] = 'true';

    nock('https://api.github.com')
      .get('/repos/theowner/therepo/git/commits/0123456789abcdef')
      .reply(200, {
        message: '3.4.3'
      });
    nock('https://api.github.com')
      .post('/repos/theowner/therepo/git/refs', {ref: 'refs/tags/3.4.3', sha: '0123456789abcdef'})
      .reply(201, {});

    const core_setOutput = jest.spyOn(core, 'setOutput');

    await run();

    expect(core_setOutput).toHaveBeenCalledWith('tag', '3.4.3');
    expect(core_setOutput).toHaveBeenCalledWith('commit', '0123456789abcdef');
  });

  it('works if the version assertion command works, replacing all instances of $version with the version', async () => {
    process.env['INPUT_VERSION_ASSERTION_COMMAND'] =
      '[ "$version" == "3.4.4" ] && [ "$version" == "3.4.4" ]';

    nock('https://api.github.com')
      .get('/repos/theowner/therepo/git/commits/0123456789abcdef')
      .reply(200, {
        message: '3.4.4'
      });
    nock('https://api.github.com')
      .post('/repos/theowner/therepo/git/refs', {ref: 'refs/tags/3.4.4', sha: '0123456789abcdef'})
      .reply(201, {});

    const core_setOutput = jest.spyOn(core, 'setOutput');

    await run();

    expect(core_setOutput).toHaveBeenCalledWith('tag', '3.4.4');
    expect(core_setOutput).toHaveBeenCalledWith('commit', '0123456789abcdef');
  });

  it('fails if the version assertion command fails', async () => {
    process.env['INPUT_VERSION_ASSERTION_COMMAND'] = 'false';

    nock('https://api.github.com')
      .get('/repos/theowner/therepo/git/commits/0123456789abcdef')
      .reply(200, {
        message: '3.4.5'
      });

    const core_setFailed = jest.spyOn(core, 'setFailed');

    await run();

    expect(core_setFailed).toHaveBeenCalledWith(expect.stringMatching(/^Version assertion failed/));
  });

  it('checks the entire commit message for a matching version if the option is enabled', async () => {
    process.env['INPUT_VERSION_REGEX'] = String.raw`Version: ([0-9]+\.[0-9]+\.[0-9]+)`;
    process.env['INPUT_CHECK_ENTIRE_COMMIT_MESSAGE'] = 'true';

    nock('https://api.github.com')
      .get('/repos/theowner/therepo/git/commits/0123456789abcdef')
      .reply(200, {
        message: 'Tag new version\n\nVersion: 1.5.2\nsome more commit body text'
      });
    nock('https://api.github.com')
      .post('/repos/theowner/therepo/git/refs', {ref: 'refs/tags/1.5.2', sha: '0123456789abcdef'})
      .reply(201, {});

    const core_setOutput = jest.spyOn(core, 'setOutput');

    await run();

    expect(core_setOutput).toHaveBeenCalledWith('tag', '1.5.2');
    expect(core_setOutput).toHaveBeenCalledWith('commit', '0123456789abcdef');
  });

  it('does not check the entire commit message for a matching version if the option is disabled', async () => {
    process.env['INPUT_VERSION_REGEX'] = String.raw`Version: ([0-9]+\.[0-9]+\.[0-9]+)`;
    process.env['INPUT_CHECK_ENTIRE_COMMIT_MESSAGE'] = 'false';

    nock('https://api.github.com')
      .get('/repos/theowner/therepo/git/commits/0123456789abcdef')
      .reply(200, {
        message: 'Tag new version\n\nVersion: 1.5.3\nsome more commit body text'
      });

    const core_setOutput = jest.spyOn(core, 'setOutput');

    await run();

    // Outputs should be empty
    expect(core_setOutput).toHaveBeenCalledWith('tag', '');
    expect(core_setOutput).toHaveBeenCalledWith('message', '');
    expect(core_setOutput).toHaveBeenCalledWith('commit', '');
  });

  it('does not do anything if there is no match when the option for checking entire commit message is enabled', async () => {
    process.env['INPUT_VERSION_REGEX'] = String.raw`Version: ([0-9]+\.[0-9]+\.[0-9]+)`;
    process.env['INPUT_CHECK_ENTIRE_COMMIT_MESSAGE'] = 'true';

    nock('https://api.github.com')
      .get('/repos/theowner/therepo/git/commits/0123456789abcdef')
      .reply(200, {
        message: 'Some commit title\n\nBlah blah\nsome more commit body text'
      });

    const core_setOutput = jest.spyOn(core, 'setOutput');

    await run();

    // Outputs should be empty
    expect(core_setOutput).toHaveBeenCalledWith('tag', '');
    expect(core_setOutput).toHaveBeenCalledWith('message', '');
    expect(core_setOutput).toHaveBeenCalledWith('commit', '');
  });

  it('creates an annotated tag if the option is enabled', async () => {
    process.env['INPUT_ANNOTATED'] = 'true';

    nock('https://api.github.com')
      .get('/repos/theowner/therepo/git/commits/0123456789abcdef')
      .reply(200, {
        message: '1.2.5\n\nthis is the commit body which should be used as the tag message'
      });
    nock('https://api.github.com')
      .post('/repos/theowner/therepo/git/tags', {
        tag: '1.2.5',
        message: 'this is the commit body which should be used as the tag message',
        object: '0123456789abcdef',
        type: 'commit'
      })
      .reply(201, {});
    nock('https://api.github.com')
      .post('/repos/theowner/therepo/git/refs', {ref: 'refs/tags/1.2.5', sha: '0123456789abcdef'})
      .reply(201, {});

    const core_setOutput = jest.spyOn(core, 'setOutput');

    await run();

    expect(core_setOutput).toHaveBeenCalledWith('tag', '1.2.5');
    expect(core_setOutput).toHaveBeenCalledWith(
      'message',
      'this is the commit body which should be used as the tag message'
    );
    expect(core_setOutput).toHaveBeenCalledWith('commit', '0123456789abcdef');
  });

  it('correctly handles creating an annotated tag with a commit that has no body', async () => {
    process.env['INPUT_ANNOTATED'] = 'true';

    nock('https://api.github.com')
      .get('/repos/theowner/therepo/git/commits/0123456789abcdef')
      .reply(200, {
        message: '9.3.2'
      });
    nock('https://api.github.com')
      .post('/repos/theowner/therepo/git/tags', {
        tag: '9.3.2',
        message: '',
        object: '0123456789abcdef',
        type: 'commit'
      })
      .reply(201, {});
    nock('https://api.github.com')
      .post('/repos/theowner/therepo/git/refs', {ref: 'refs/tags/9.3.2', sha: '0123456789abcdef'})
      .reply(201, {});

    const core_setOutput = jest.spyOn(core, 'setOutput');

    await run();

    expect(core_setOutput).toHaveBeenCalledWith('tag', '9.3.2');
    expect(core_setOutput).toHaveBeenCalledWith('message', '');
    expect(core_setOutput).toHaveBeenCalledWith('commit', '0123456789abcdef');
  });

  it('creates a tag using the prefix when the commit title matches the version regex', async () => {
    process.env['INPUT_VERSION_TAG_PREFIX'] = 'v';

    nock('https://api.github.com')
      .get('/repos/theowner/therepo/git/commits/0123456789abcdef')
      .reply(200, {
        message: '1.3.4'
      });
    nock('https://api.github.com')
      .post('/repos/theowner/therepo/git/refs', {ref: 'refs/tags/v1.3.4', sha: '0123456789abcdef'})
      .reply(201, {});

    const core_setOutput = jest.spyOn(core, 'setOutput');

    await run();

    expect(core_setOutput).toHaveBeenCalledWith('tag', 'v1.3.4');
    expect(core_setOutput).toHaveBeenCalledWith('commit', '0123456789abcdef');
  });

  it('creates a tag using the prefix when the commit title matches the version regex with a capture group', async () => {
    process.env['INPUT_VERSION_REGEX'] = String.raw`Version: ([0-9]+\.[0-9]+\.[0-9]+)`;
    process.env['INPUT_VERSION_TAG_PREFIX'] = 'v';

    nock('https://api.github.com')
      .get('/repos/theowner/therepo/git/commits/0123456789abcdef')
      .reply(200, {
        message: 'Version: 1.5.9'
      });
    nock('https://api.github.com')
      .post('/repos/theowner/therepo/git/refs', {ref: 'refs/tags/v1.5.9', sha: '0123456789abcdef'})
      .reply(201, {});

    const core_setOutput = jest.spyOn(core, 'setOutput');

    await run();

    expect(core_setOutput).toHaveBeenCalledWith('tag', 'v1.5.9');
    expect(core_setOutput).toHaveBeenCalledWith('commit', '0123456789abcdef');
  });

  it('fails if the commit data request fails', async () => {
    // Using 204 as unexpected status code
    nock('https://api.github.com')
      .get('/repos/theowner/therepo/git/commits/0123456789abcdef')
      .reply(204, {});

    const core_setFailed = jest.spyOn(core, 'setFailed');

    await run();

    expect(core_setFailed).toHaveBeenCalledWith(
      expect.stringMatching(/^Failed to get commit data/)
    );
  });

  it('fails if the tag object creation for annotated tag fails', async () => {
    process.env['INPUT_ANNOTATED'] = 'true';

    nock('https://api.github.com')
      .get('/repos/theowner/therepo/git/commits/0123456789abcdef')
      .reply(200, {
        message: '1.2.4\n\nthis is the commit body which should be used as the tag message'
      });
    // Using 204 as unexpected status code
    nock('https://api.github.com')
      .post('/repos/theowner/therepo/git/tags', {
        tag: '1.2.4',
        message: 'this is the commit body which should be used as the tag message',
        object: '0123456789abcdef',
        type: 'commit'
      })
      .reply(204, {});

    const core_setFailed = jest.spyOn(core, 'setFailed');

    await run();

    expect(core_setFailed).toHaveBeenCalledWith(
      expect.stringMatching(/^Failed to create tag object/)
    );
  });

  it('fails if the ref creation fails', async () => {
    nock('https://api.github.com')
      .get('/repos/theowner/therepo/git/commits/0123456789abcdef')
      .reply(200, {
        message: '1.3.5'
      });
    // Using 204 as unexpected status code
    nock('https://api.github.com')
      .post('/repos/theowner/therepo/git/refs', {ref: 'refs/tags/1.3.5', sha: '0123456789abcdef'})
      .reply(204, {});

    const core_setFailed = jest.spyOn(core, 'setFailed');

    await run();

    expect(core_setFailed).toHaveBeenCalledWith(expect.stringMatching(/^Failed to create tag ref/));
  });

  it('does not do any requests if dry_run is enabled', async () => {
    process.env['INPUT_DRY_RUN'] = 'true';

    nock('https://api.github.com')
      .get('/repos/theowner/therepo/git/commits/0123456789abcdef')
      .reply(200, {
        message: '5.2.1'
      });

    const core_setOutput = jest.spyOn(core, 'setOutput');

    await run();

    expect(core_setOutput).toHaveBeenCalledWith('tag', '5.2.1');
    expect(core_setOutput).toHaveBeenCalledWith('commit', '0123456789abcdef');
  });
});

describe('utils', () => {
  it('correctly counts the number of capture groups in a regex', async () => {
    expect(utils.count_capture_groups(new RegExp(''))).toBe(0);
    expect(utils.count_capture_groups(/abc/)).toBe(0);
    expect(utils.count_capture_groups(/^my s[o]+ cool regex$/)).toBe(0);
    expect(utils.count_capture_groups(/^my (s[o]+) cool regex$/)).toBe(1);
    expect(utils.count_capture_groups(/()/)).toBe(1);
    expect(utils.count_capture_groups(/Version: ([0-9]+)/)).toBe(1);
    expect(utils.count_capture_groups(/Version: ([0-9]+)-([a-z])/)).toBe(2);
    expect(utils.count_capture_groups(/Version: ([0-9]+)-([a-z]+)-rc([0-9]+)/)).toBe(3);
    expect(utils.count_capture_groups(/()()()()()/)).toBe(5);
  });
});
