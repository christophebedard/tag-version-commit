# tag-version-commit GitHub Action

[![GitHub Action](https://img.shields.io/badge/action-tag--version--commit-blue?logo=github)](https://github.com/marketplace/actions/tag-version-commit)
[![GitHub release (latest by date)](https://img.shields.io/github/v/release/christophebedard/tag-version-commit?color=blue)](https://github.com/christophebedard/tag-version-commit/releases)
[![GitHub Workflow Status](https://github.com/christophebedard/tag-version-commit/workflows/test/badge.svg?branch=master)](https://github.com/christophebedard/tag-version-commit/actions)
[![codecov](https://codecov.io/gh/christophebedard/tag-version-commit/branch/master/graph/badge.svg)](https://codecov.io/gh/christophebedard/tag-version-commit)

GitHub action for tagging commits whose title matches a version regex.

Some projects maintain a version number somewhere in a file, e.g. `__version__ = '1.2.3'` for a Python project.
When maintainers want to bump the version, they update that number, commit the change, and tag that commit.
This action automates the tag creation.

When the commit that triggers a workflow has a title that matches a version regex (e.g. `1.2.3`), this action creates a lightweight tag (e.g. `1.2.3`) pointing to that commit.
It is also possible to create an annotated tag using the commit body as the message.
See [inputs](#inputs) for more details.

Currently, it does not support checking any commit other than the last commit that was pushed.
It also does not make sure that the tag does not exist before creating it, in which case the API request will simply fail and so will the action.

## Usage

See [`action.yml`](./action.yml).

### Basic

```yaml
- uses: christophebedard/tag-version-commit@v1
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
```

### Typical

Only consider commits pushed to `master` or `releases/*`.

```yaml
name: 'tag'
on:
  push:
    branches:
      - master
      - 'releases/*'
jobs:
  tag:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    - uses: christophebedard/tag-version-commit@v1
      with:
        token: ${{ secrets.GITHUB_TOKEN }}
```

### Advanced

#### Use a capture group

Use a capture group to allow including something other than the version itself in the commit title, e.g. `Version: 1.2.3`.
This would create a `1.2.3` tag.

```yaml
name: 'tag'
on:
  push:
    branches:
      - master
      - 'releases/*'
jobs:
  tag:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    - uses: christophebedard/tag-version-commit@v1
      with:
        token: ${{ secrets.GITHUB_TOKEN }}
        version_regex: 'Version: ([0-9]+\.[0-9]+\.[0-9]+)'
```

#### Compare matched version with content of file(s)

Compare the new version against the one declared in a `package.json` file.
The action will fail and no tag will be created if the assertion command fails.

```yaml
name: 'tag'
on:
  push:
    branches:
      - master
      - 'releases/*'
jobs:
  tag:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    - uses: christophebedard/tag-version-commit@v1
      with:
        token: ${{ secrets.GITHUB_TOKEN }}
        version_assertion_command: 'grep -q "\"version\": \"$version\"" package.json'
```

#### Use a version tag prefix

Use a prefix for the version tag, e.g. `v`.
This would create a `v1.2.3` tag for a commit titled `1.2.3`.

```yaml
name: 'tag'
on:
  push:
    branches:
      - master
      - 'releases/*'
jobs:
  tag:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    - uses: christophebedard/tag-version-commit@v1
      with:
        token: ${{ secrets.GITHUB_TOKEN }}
        version_tag_prefix: 'v'
```

## Inputs

|Name|Description|Required|Default|
|:---|:----------|:------:|:-----:|
|`token`<sup>1</sup>|GitHub token, required for permission to create a tag|yes||
|`version_regex`|the version regex to use for detecting version in commit messages; can contain a capture group<sup>2</sup>|no|`'^[0-9]+\.[0-9]+\.[0-9]+$'`|
|`version_assertion_command`<sup>3</sup>|a command to run to validate the version, e.g. compare against a version file|no|`''`|
|`version_tag_prefix`|a prefix to prepend to the detected version number to create the tag (e.g. "v")|no|`''`|
|`annotated`|whether to create an annotated tag, using the commit body as the message|no|`false`|
|`dry_run`|do everything except actually create the tag|no|`false`|

&nbsp;&nbsp;&nbsp;&nbsp;1&nbsp;&nbsp;&nbsp;&nbsp; if you want the tag creation/push to trigger an [`on.push.tags` workflow](https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions#onpushpull_requestbranchestags), create a [personal access token](https://github.com/settings/tokens) (with "repo" scope), add it as a [secret](https://help.github.com/en/actions/configuring-and-managing-workflows/creating-and-storing-encrypted-secrets), and use it here instead of the provided `GITHUB_TOKEN`, which will not trigger an `on.push.tag` workflow

&nbsp;&nbsp;&nbsp;&nbsp;2&nbsp;&nbsp;&nbsp;&nbsp; if there are multiple capture groups, only the captured match for the last group will be used

&nbsp;&nbsp;&nbsp;&nbsp;3&nbsp;&nbsp;&nbsp;&nbsp; use `$version` in the command and it will be replaced by the new version, without the prefix

## Outputs

|Name|Description|Default<sup>1</sup>|
|:---|:----------|:-----:|
|`tag`|the tag that has been created|`''`|
|`message`|the message of the annotated tag (if `annotated`) that has been created|`''`|
|`commit`|the commit that was tagged|`''`|

&nbsp;&nbsp;&nbsp;&nbsp;1&nbsp;&nbsp;&nbsp;&nbsp; if no tag has been created (unless `dry_run` is enabled)

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md).
