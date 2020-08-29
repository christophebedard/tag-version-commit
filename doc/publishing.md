# Publishing

See:

* https://help.github.com/en/actions/building-actions/creating-a-javascript-action#commit-tag-and-push-your-action-to-github
* https://help.github.com/en/actions/building-actions/publishing-actions-in-github-marketplace#publishing-an-action

Steps:

* Build and pack
    ```shell
    $ npm run build
    $ npm run pack
    $ npm run all  # or this
    ```
* Commit the files generated after the above command
* Tag/release
    * New major release (e.g. `vN`)
        * Create new `vN` tag.
            ```shell
            $ git tag vN
            $ git push origin master --tags
            ```
        * [Create new release](https://github.com/christophebedard/tag-version-commit/releases) pointing to `vN` tag.
    * Update current release (same major version, `vN`)
        * Update `vN` tag to point to newer commit. No need to change/modify the release on GitHub.com, since it still points to the same `vN` tag.
            ```shell
            $ git tag -f vN
            $ git push origin master --tags --force
            ```
        * Also: consider creating a new `vN.x.y` tag and creating a new release pointing to that tag so that users can keep that exact version if they want.
