import * as core from '@actions/core';
import {context} from '@actions/github';
import nock from 'nock';
import {run} from '../src/main';

beforeEach(() => {
  jest.resetModules();

  // Reset action inputs environment variables to their default value,
  // otherwise an environment variable set in a test can creep into a later test
  process.env['INPUT_VERSION_REGEX'] = '^[0-9]+\\.[0-9]+\\.[0-9]+$';
  process.env['INPUT_VERSION_TAG_PREFIX'] = '';
  process.env['INPUT_VERSION_ASSERTION_COMMAND'] = '';
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
    const stdout_write = jest.spyOn(process.stdout, 'write');

    await run();

    // Expect the regex exception message
    expect(core_setFailed).toHaveBeenCalled();
    expect(stdout_write).toHaveBeenCalledWith(
      expect.stringContaining('Invalid regular expression')
    );
  });

  it('does not do anything when the commit title does not match the version regex (1)', async () => {
    nock('https://api.github.com')
      .get('/repos/theowner/therepo/git/commits/0123456789abcdef')
      .reply(200, {
        message: 'this commit title will not match'
      });

    const stdout_write = jest.spyOn(process.stdout, 'write');

    await run();

    // Outputs should be empty
    expect(stdout_write).toHaveBeenCalledWith(expect.stringMatching(/^.*name=tag::[\n]*$/));
    expect(stdout_write).toHaveBeenCalledWith(expect.stringMatching(/^.*name=commit::[\n]*$/));
  });

  it('works correctly with the default version regex: version in a sentence', async () => {
    nock('https://api.github.com')
      .get('/repos/theowner/therepo/git/commits/0123456789abcdef')
      .reply(200, {
        message: 'this commit title contains a 8.9.1 version'
      });

    const stdout_write = jest.spyOn(process.stdout, 'write');

    await run();

    // Outputs should be empty
    expect(stdout_write).toHaveBeenCalledWith(expect.stringMatching(/^.*name=tag::[\n]*$/));
    expect(stdout_write).toHaveBeenCalledWith(expect.stringMatching(/^.*name=commit::[\n]*$/));
  });

  it('works correctly with the default version regex: version that could match a misformed regex', async () => {
    // This would match if '.' was used instead of '\.' (or '\\.' to escape the backslash)
    nock('https://api.github.com')
      .get('/repos/theowner/therepo/git/commits/0123456789abcdef')
      .reply(200, {
        message: '8a7a6'
      });

    const stdout_write = jest.spyOn(process.stdout, 'write');

    await run();

    // Outputs should be empty
    expect(stdout_write).toHaveBeenCalledWith(expect.stringMatching(/^.*name=tag::[\n]*$/));
    expect(stdout_write).toHaveBeenCalledWith(expect.stringMatching(/^.*name=commit::[\n]*$/));
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

    const stdout_write = jest.spyOn(process.stdout, 'write');

    await run();

    expect(stdout_write).toHaveBeenCalledWith(expect.stringContaining('name=tag::1.2.3'));
    expect(stdout_write).toHaveBeenCalledWith(
      expect.stringContaining('name=commit::0123456789abcdef')
    );
  });

  it('works with a non-default version regex', async () => {
    process.env['INPUT_VERSION_REGEX'] = '[0-9]+.[0-9]+.[a-z]+';

    nock('https://api.github.com')
      .get('/repos/theowner/therepo/git/commits/0123456789abcdef')
      .reply(200, {
        message: '6.9.f'
      });
    nock('https://api.github.com')
      .post('/repos/theowner/therepo/git/refs', {ref: 'refs/tags/6.9.f', sha: '0123456789abcdef'})
      .reply(201, {});

    const stdout_write = jest.spyOn(process.stdout, 'write');

    await run();

    expect(stdout_write).toHaveBeenCalledWith(expect.stringContaining('name=tag::6.9.f'));
    expect(stdout_write).toHaveBeenCalledWith(
      expect.stringContaining('name=commit::0123456789abcdef')
    );
  });

  it('only checks the commit title and not the whole message', async () => {
    nock('https://api.github.com')
      .get('/repos/theowner/therepo/git/commits/0123456789abcdef')
      .reply(200, {
        message: 'the commit title with a version later in the message\n\n3.2.1'
      });

    const stdout_write = jest.spyOn(process.stdout, 'write');

    await run();

    // Outputs should be empty
    expect(stdout_write).toHaveBeenCalledWith(expect.stringMatching(/^.*name=tag::[\n]*$/));
    expect(stdout_write).toHaveBeenCalledWith(expect.stringMatching(/^.*name=commit::[\n]*$/));
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

    const stdout_write = jest.spyOn(process.stdout, 'write');

    await run();

    expect(stdout_write).toHaveBeenCalledWith(expect.stringContaining('name=tag::3.4.3'));
    expect(stdout_write).toHaveBeenCalledWith(
      expect.stringContaining('name=commit::0123456789abcdef')
    );
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

    const stdout_write = jest.spyOn(process.stdout, 'write');

    await run();

    expect(stdout_write).toHaveBeenCalledWith(expect.stringContaining('name=tag::3.4.4'));
    expect(stdout_write).toHaveBeenCalledWith(
      expect.stringContaining('name=commit::0123456789abcdef')
    );
  });

  it('fails if the version assertion command fails', async () => {
    process.env['INPUT_VERSION_ASSERTION_COMMAND'] = 'false';

    nock('https://api.github.com')
      .get('/repos/theowner/therepo/git/commits/0123456789abcdef')
      .reply(200, {
        message: '3.4.5'
      });

    const stdout_write = jest.spyOn(process.stdout, 'write');

    await run();

    expect(stdout_write).toHaveBeenCalledWith(
      expect.stringContaining('::error::Version assertion failed')
    );
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

    const stdout_write = jest.spyOn(process.stdout, 'write');

    await run();

    expect(stdout_write).toHaveBeenCalledWith(expect.stringContaining('name=tag::1.2.5'));
    expect(stdout_write).toHaveBeenCalledWith(
      expect.stringContaining(
        'name=message::this is the commit body which should be used as the tag message'
      )
    );
    expect(stdout_write).toHaveBeenCalledWith(
      expect.stringContaining('name=commit::0123456789abcdef')
    );
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

    const stdout_write = jest.spyOn(process.stdout, 'write');

    await run();

    expect(stdout_write).toHaveBeenCalledWith(expect.stringContaining('name=tag::9.3.2'));
    expect(stdout_write).toHaveBeenCalledWith(expect.stringMatching(/^.*name=message::[\n]*$/));
    expect(stdout_write).toHaveBeenCalledWith(
      expect.stringContaining('name=commit::0123456789abcdef')
    );
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

    const stdout_write = jest.spyOn(process.stdout, 'write');

    await run();

    expect(stdout_write).toHaveBeenCalledWith(expect.stringContaining('name=tag::v1.3.4'));
    expect(stdout_write).toHaveBeenCalledWith(
      expect.stringContaining('name=commit::0123456789abcdef')
    );
  });

  it('does not do any requests if dry_run is enabled', async () => {
    process.env['INPUT_DRY_RUN'] = 'true';

    nock('https://api.github.com')
      .get('/repos/theowner/therepo/git/commits/0123456789abcdef')
      .reply(200, {
        message: '5.2.1'
      });

    const stdout_write = jest.spyOn(process.stdout, 'write');

    await run();

    expect(stdout_write).toHaveBeenCalledWith(expect.stringContaining('name=tag::5.2.1'));
    expect(stdout_write).toHaveBeenCalledWith(
      expect.stringContaining('name=commit::0123456789abcdef')
    );
  });
});
