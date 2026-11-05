# Node.js and GitHub Actions

Before updating this repository's Node.js requirements or merging a PR that does so, check the currently supported JavaScript action runtimes in [GitHub's metadata syntax reference](https://docs.github.com/en/actions/reference/workflows-and-actions/metadata-syntax#runs-for-javascript-actions). Do not raise the required Node.js major beyond a supported action runtime. Recheck the documentation at the time of the change; supported versions can change.

The Node.js version used to build and test the project is distinct from the runtime in `action.yml` under `runs.using`. Keep the action compatible with its configured runtime, and verify the generated bundle and action on that runtime before merging a Node.js update. Installing a different Node.js version in a workflow does not change the runtime used to execute a JavaScript action.
