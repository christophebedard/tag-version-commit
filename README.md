# tag-version-commit GitHub Action

[![GitHub Workflow Status](https://img.shields.io/github/workflow/status/christophebedard/tag-version-commit/test?label=test&logo=github)](https://github.com/christophebedard/tag-version-commit/actions)

GitHub action for tagging commits whose title matches a version regex.

Some projects maintain a version number somewhere in a file, e.g. `__version__ = '1.2.3'` for a Python project.
When maintainers want to bump the version, they update that number, commit the change, and tag that commit.
This action automates the tag creation.

When the commit that triggers a workflow has a title that matches a version regex (e.g. `1.2.3`), this action creates a tag (e.g. `1.2.3`) pointing to that commit.

Currently, it does not support checking any commit other than the last commit that was pushed.
It also does not make sure that the tag does not exist before creating it, in which case it will simply fail.

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
    - uses: actions/checkout@v1
    - uses: christophebedard/tag-version-commit@v1
      with:
        token: ${{ secrets.GITHUB_TOKEN }}
```

## Inputs

|Name|Description|Required|Default|
|:---|:----------|:------:|:-----:|
|`token`|GitHub token, required for permission to create a tag|yes||
|`version_regex`|the version regex to use for detecting version in commit messages|no|`'[0-9]+.[0-9]+.[0-9]+'`|
|`version_tag_prefix`|a prefix to prepend to the detected version number to create the tag (e.g. "v")|no|`''`|
|`dry_run`|do everything except actually create the tag|no|`false`|

## Outputs

|Name|Description|Default<sup>1</sup>|
|:---|:----------|:-----:|
|`tag`|the tag that has been created, if any|`''`|
|`commit`|the commit that was tagged, if any|`''`|

&nbsp;&nbsp;&nbsp;&nbsp;1&nbsp;&nbsp;&nbsp;&nbsp; if no tag has been created
