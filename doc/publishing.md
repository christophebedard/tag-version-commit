# Publishing

See:

* https://help.github.com/en/actions/building-actions/creating-a-javascript-action#commit-tag-and-push-your-action-to-github
* https://help.github.com/en/actions/building-actions/publishing-actions-in-github-marketplace#publishing-an-action

Steps:

* Build and pack
    ```shell
    $ npm run build
    $ npm run pack
    ```
* Commit the files generated after the above command
* Tag/release
    * New major release (e.g. `vN`)
        * Create new `vN` tag
        * [Create new release](https://github.com/christophebedard/tag-version-commit/releases) pointing at `vN` tag
    * Update current release (same major version, `vN`)
        * Update `vN` tag to point to newer commit
        * (no need to change the release, since it still points to the `vN` tag)
        * Also: consider creating a new `vN.x.y` tag and creating a new release pointing at that tag so that users can keep that exact version
