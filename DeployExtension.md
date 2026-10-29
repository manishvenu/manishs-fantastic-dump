# How to deploy extension

Releases are uploaded by hand through the Marketplace website. No Azure DevOps organization, personal access token, or Azure subscription is needed.

1. Add an entry for the new version to `CHANGELOG.md`.
2. Bump the version (use `minor` or `major` instead of `patch` as appropriate):
   ```bash
   npm version patch --no-git-tag-version
   ```
3. Build the package (compiles TypeScript, then writes `manishsfantasticdump-<version>.vsix`):
   ```bash
   npm install
   npm run package
   ```
4. Optional: test it locally with `code --install-extension manishsfantasticdump-<version>.vsix`.
5. Go to https://marketplace.visualstudio.com/manage and sign in with the Microsoft account that owns the `ManishVenumuddula` publisher.
6. Next to **Manish's Fantastic Dump**, click **⋯** → **Update** and upload the `.vsix`.
7. Wait a few minutes for verification, then commit `package.json`, `package-lock.json`, and `CHANGELOG.md`. The `.vsix` is git-ignored.

## Why not `vsce publish`?

`vsce publish` needs a personal access token from Azure DevOps, which now requires an Azure subscription to create an organization. The manual upload avoids all of that.
