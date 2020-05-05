import {context} from '@actions/github';
import nock from 'nock';
import {run} from '../src/main';

beforeEach(() => {
  jest.resetModules();

  // Reset action inputs environment variables to their default value,
  // otherwise an environment variable set in a test can creep into a later test
  process.env['INPUT_VERSION_REGEX'] = '[0-9]+.[0-9]+.[0-9]+';
  process.env['INPUT_VERSION_TAG_PREFIX'] = '';
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

describe('action', () => {
  it('detects a bad version regex', async () => {
    process.env['INPUT_VERSION_REGEX'] = '[0-9';
    process.env['INPUT_VERSION_TAG_PREFIX'] = '';

    const stdout_write = jest.spyOn(process.stdout, 'write');

    await run();

    // Expect the regex exception message
    expect(stdout_write).toHaveBeenCalledWith(
      expect.stringContaining('Invalid regular expression')
    );
  });

  it('does not do anything when the commit title does not match the version regex', async () => {
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

  it('creates a tag when the commit title matches the version regex', async () => {
    nock('https://api.github.com')
      .get('/repos/theowner/therepo/git/commits/0123456789abcdef')
      .reply(200, {
        message: '1.2.3'
      });
    nock('https://api.github.com')
      .post('/repos/theowner/therepo/git/refs')
      .reply(201, {});

    const stdout_write = jest.spyOn(process.stdout, 'write');

    await run();

    expect(stdout_write).toHaveBeenCalledWith(expect.stringContaining('name=tag::1.2.3'));
    expect(stdout_write).toHaveBeenCalledWith(
      expect.stringContaining('name=commit::0123456789abcdef')
    );
  });

  it('only checks the commit title and not the whole message', async () => {
    process.env['INPUT_TOKEN'] = '12345';
    process.env['INPUT_VERSION_REGEX'] = '[0-9]+.[0-9]+.[0-9]+';
    process.env['INPUT_VERSION_TAG_PREFIX'] = '';

    nock('https://api.github.com')
      .get('/repos/theowner/therepo/git/commits/0123456789abcdef')
      .reply(200, {
        message: 'the commit title with a version later in the message\n\n1.2.3'
      });

    const stdout_write = jest.spyOn(process.stdout, 'write');

    await run();

    // Outputs should be empty
    expect(stdout_write).toHaveBeenCalledWith(expect.stringMatching(/^.*name=tag::[\n]*$/));
    expect(stdout_write).toHaveBeenCalledWith(expect.stringMatching(/^.*name=commit::[\n]*$/));
  });

  it('creates a tag using the prefix when the commit title matches the version regex', async () => {
    process.env['INPUT_VERSION_TAG_PREFIX'] = 'v';

    nock('https://api.github.com')
      .get('/repos/theowner/therepo/git/commits/0123456789abcdef')
      .reply(200, {
        message: '1.2.3'
      });
    nock('https://api.github.com')
      .post('/repos/theowner/therepo/git/refs')
      .reply(201, {});

    const stdout_write = jest.spyOn(process.stdout, 'write');

    await run();

    expect(stdout_write).toHaveBeenCalledWith(expect.stringContaining('name=tag::v1.2.3'));
    expect(stdout_write).toHaveBeenCalledWith(
      expect.stringContaining('name=commit::0123456789abcdef')
    );
  });

  it('does not do any requests if dry_run is enabled', async () => {
    process.env['INPUT_DRY_RUN'] = 'true';

    nock('https://api.github.com')
      .get('/repos/theowner/therepo/git/commits/0123456789abcdef')
      .reply(200, {
        message: '1.2.3'
      });

    const stdout_write = jest.spyOn(process.stdout, 'write');

    await run();

    expect(stdout_write).toHaveBeenCalledWith(expect.stringContaining('name=tag::1.2.3'));
    expect(stdout_write).toHaveBeenCalledWith(
      expect.stringContaining('name=commit::0123456789abcdef')
    );
  });
});
