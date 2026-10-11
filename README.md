# stucent-scratch-editor: a modified Scratch editor for StuCent

**This is a modified version of [scratch-editor](https://github.com/scratchfoundation/scratch-editor)**, made for
StuCent's "Block game studio" questions. It is compatible with Scratch 3 projects. It is not affiliated with, or
endorsed by, the Scratch Foundation; the Scratch name, logo and characters are the Scratch Foundation's trademarks
(see [TRADEMARK](TRADEMARK)) and this build does not use them as its name or look.

- **Licence:** GNU Affero General Public License v3.0 ([LICENSE](LICENSE)), like the original. The modified source
  that StuCent serves to its users is published here.
- **Source:** <https://github.com/hafezparast/stucent-scratch-editor>, branch `stucent/main`.
- **Based on:** scratchfoundation/scratch-editor `develop` at commit
  `697d53d72c7dd102357aaac15a4d9ffd4e60738e`.

### What is changed

The changes live in `packages/scratch-gui/src/stucent/` (with its tests in `packages/scratch-gui/test/unit/stucent/`
and `packages/scratch-gui/test/stucent-e2e/`), plus small hooks in a few GUI components and a `stucent` build in
`packages/scratch-gui/webpack.config.js`:

- **A postMessage bridge** (protocol `emu/1`, active only with `?host=<origin>`): the host page loads a starter
  project, locks sprites and scripts, reads the project (.sb3, project.json and assets) and the running state,
  receives a log of the player's edits, adds or replaces scripts (with undo), starts and stops the project and
  toggles full screen. See [packages/scratch-gui/src/stucent/PROTOCOL.md](packages/scratch-gui/src/stucent/PROTOCOL.md).
- **Privacy:** no request to any server but its own: no Scratch servers, no analytics, no cloud variables, no
  backpack or sharing, no extensions that call online services or hardware (only Pen and Music), no cookies or web
  storage. Runs in a sandboxed iframe.
- **Exam mode:** no file uploads, no loading or replacing the project.
- **Branding:** a plain "Block game studio" label instead of the Scratch logo, a blank project with a ball sprite
  instead of the Scratch Cat, no tutorials or community links; a "Source (AGPL)" link in the menu bar.

### Build

```sh
npm ci
npm run build --workspace=packages/task-herder
NODE_ENV=production npm run build --workspace=packages/scratch-storage
NODE_ENV=production npm run build --workspace=packages/scratch-svg-renderer
NODE_ENV=production npm run build --workspace=packages/scratch-render
NODE_ENV=production npm run build --workspace=packages/scratch-vm
NODE_ENV=production npm run build --workspace=packages/scratch-paint
npm run build:stucent --workspace=packages/scratch-gui   # → packages/scratch-gui/build-stucent/
node packages/scratch-gui/test/stucent-e2e/run.mjs       # end-to-end check of the bridge
```

`build-stucent/` is a static site: serve it at any path (StuCent uses `/emulators/scratch/`) with
`Access-Control-Allow-Origin: *` and `Content-Security-Policy: frame-ancestors <your origin>`. Releases on this
repository carry it as a tarball.

---

# scratch-editor: The Scratch Editor Monorepo

If you'd like to use Scratch, please visit the [Scratch website](https://scratch.mit.edu/). You can build your own
Scratch project by pressing "Create" on that website or by visiting <https://scratch.mit.edu/projects/editor/>.

This is a source code repository for the packages that make up the Scratch editor and a few additional support
packages. Use this if you'd like to learn about how the Scratch editor works or to contribute to its development.

## What's in this repository?

The `packages` directory in this repository contains:

- `scratch-gui` provides the buttons, menus, and other elements that you interact with when creating and editing a
  project. It's also the "glue" that brings most of the other modules together at runtime.
- `scratch-media-lib-scripts` builds (or rebuilds) media libraries for the editor.
- `scratch-paint` provides a way to draw vector (SVG) or bitmap (PNG) images for costumes and backdrops.
- `scratch-render` draws backdrops, sprites, and clones on the stage.
- `scratch-storage` helps load project assets like images and sounds. It also provides `ScratchFetch`, a customized
  wrapper around `fetch`.
- `scratch-svg-renderer` processes SVG (vector) images for use with Scratch projects.
- `scratch-vm` is the virtual machine that runs Scratch projects.
- `task-herder` manages queues of tasks with throttling and concurrency limits.

_Please add to this list as more packages are migrated to the monorepo._

Each package has its own `README.md` file with more information about that package.

## Monorepo migration

### What's going on?

We're migrating the Scratch editor packages into this monorepo. This will allow us to manage all the packages that
make up the Scratch editor in one place, making  it easier to manage dependencies and make changes that affect
multiple packages.

### Why are there only a few packages in this repo?

We're migrating packages in stages. The current plan, which is subject to change, has us migrating repositories in
four batches. We plan to complete the migration within 2025.

### What will happen to the existing repositories?

The existing repositories will be archived and made read-only. Those repositories contain valuable work and
information, including but not limited to issues and pull requests. We plan to keep that information available for
reference, and to selectively migrate it to this new repository.

## Thank you

Scratch would not be what it is today without help from the global community of Scratchers and open-source
contributors. Thank you for your contributions and support. _[Scratch on!](https://scratch.mit.edu/projects/65347738/fullscreen/)_

## Donate

We provide [Scratch](https://scratch.mit.edu) free of charge, and want to keep it that way! Please consider making a
[donation](https://www.scratchfoundation.org/donate) to support our continued engineering, design, community, and
resource development efforts. Donations of any size are appreciated. Thank you!
