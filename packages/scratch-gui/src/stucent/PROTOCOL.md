# Bridge protocol `emu/1`

How a host page (StuCent) drives the embedded editor ("Block game studio",
compatible with Scratch 3 projects) over `window.postMessage`. Code:
`bridge.js` (transport), `mount.jsx` (handlers), `locks.js`, `edit-log.js`,
`vm-state.js`, `apply-blocks.js`. End-to-end check: `test/stucent-e2e/run.mjs`.

## Embedding

```html
<iframe sandbox="allow-scripts allow-downloads" allow="fullscreen"
        src="/emulators/scratch/index.html?host=https%3A%2F%2Fstucent.example&mode=edit&locale=ms"></iframe>
```

- **`host`** (required for the bridge): the host page's origin, exactly
  `scheme://host[:port]`. Without it the editor runs but listens to no one.
- **`mode`**: `edit` (default) | `exam` | `readonly`.
- **`locale`**: a StuCent locale (en ar de es fa fr id ja ko ms pt ru sw ta tr vi zh),
  mapped to the nearest editor language (`locale-map.js`: ms → id, pt → pt-br,
  zh → zh-cn, ta → en); anything else is English.
- **`assetHost`** (optional): a self-hosted mirror of the costume / sound /
  sprite / backdrop libraries (`<assetHost>/<md5>.<ext>`). Without it the
  libraries are hidden: their assets live on Scratch's servers.

The frame is sandboxed without `allow-same-origin`, so the editor's origin is
opaque: it has no cookies, no web storage and no access to the host. Its files
are therefore fetched cross-origin; the server must send
`Access-Control-Allow-Origin: *` for them, and should send
`Content-Security-Policy: frame-ancestors <host origin>` with `index.html`.
The page's own CSP (a meta tag) allows nothing but its own files, `data:` and
`blob:`; it needs `'unsafe-eval'` because the VM validates every project with
scratch-parser, whose schema validator compiles with `new Function()`.

Add `allow-popups allow-popups-to-escape-sandbox` if the "Source (AGPL)" link
in the menu bar should open; without it the link's address shows on hover.

## Messages

Every message is an object `{emu: "emu/1", type, ...}`.

The editor accepts a message only when `event.source === window.parent` and
`event.origin === host`, and posts only to `window.parent` with `host` as the
target origin. The host cannot name the opaque origin of the frame, so it posts
to `frame.contentWindow` with target `"*"` and must check
`event.source === frame.contentWindow` on what it receives.

A request carries an `id` (string or number). Each is answered once:
`{emu, type: "result", re: <id>, ok: true, ...data}` or
`{emu, type: "result", re: <id>, ok: false, error: "<message>"}`.
An unknown `type` is answered with `ok: false`.

### Editor → host events

| type | payload | when |
| --- | --- | --- |
| `ready` | `version`, `upstream` (scratch-editor commit), `features: string[]` | once, when the editor has shown its first project; send nothing before it |
| `changed` | `at` | 500 ms after the last change to the project (blocks, sprites, costumes, sounds, variables); not for a `load` |
| `edit` | `at`, `kind`, `target?`, `blockId?`, `opcode?`, `detail?` | each change the player makes |
| `running` | `running: boolean` | the project started / stopped |
| `fullscreen` | `on: boolean` | the stage entered / left full screen |

`at` is milliseconds since the last `load` (or `ready`). `target` is a sprite
name or `"Stage"`. `edit.kind` is one of `block.create`, `block.delete`,
`block.move` (`detail`: attach | detach | position), `block.change`
(`detail`: element[:name]), `sprite.add`, `sprite.delete`, `sprite.rename`,
`costume.add`, `costume.delete`, `costume.change`, `sound.add`,
`sound.delete`, `variable.create`, `variable.delete`, `variable.rename`
(`detail`: the name), and `locked.refused` (`detail`: what was tried).
`applyBlocks` is logged as `block.create` with `detail: "host"`.

### Host → editor requests

| type | payload | result |
| --- | --- | --- |
| `load` | `project`, `locks?`, `mode?` | `{}` |
| `setLocks` | `locks` | `{}` |
| `getProject` | — | `sb3`, `json`, `assets` |
| `getState` | — | see below |
| `applyBlocks` | `target`, `blocks`, `replace?`, `x?`, `y?` | `topId`, `undo` |
| `undo` | `token` | `{}` |
| `greenFlag` / `stop` | — | `{}` |
| `fullscreen` | `on: boolean` | `{}` |
| `setMode` | `mode` | `{}` |

**`load.project`** is one of: `.sb3` bytes (`ArrayBuffer` or a typed array);
a project.json object; `{json, assets}` where `assets` maps each md5ext
(`"<md5>.<ext>"`, as in project.json) to its bytes — an asset that is missing
shows as the editor's placeholder costume or an empty sound; or `null` for the
blank project (an empty backdrop and one sprite drawn as a ball). A load
stops the project, clears the undo tokens and replaces the locks with
`locks` (none when absent).

**`Locks`** = `{sprites: string[], scripts: [{sprite, topId}]}`. A locked
sprite cannot be deleted or renamed, and every script it has when the locks
are set is locked (new scripts may be added to it). A locked script — every
block in it — cannot be moved, deleted or edited, and blocks cannot be dropped
into it or pulled out of it. Locked scripts are dashed with a lock mark, and a
locked sprite's tile shows a lock. The VM enforces it: a refused change never
reaches the project and the workspace is reloaded from it. File > New and
File > Load are hidden while anything is locked.

**`getProject`** → `sb3` (`ArrayBuffer`, transferred), `json` (project.json)
and `assets` (md5ext → `ArrayBuffer`, transferred: every costume and sound
the project uses).

**`getState`** → `{running, timer, stage: {costume, variables, lists},
sprites: [{name, x, y, direction, costume, costumeIndex, visible, size, layer,
say, variables, lists, clones}]}`. Variables and lists are keyed by name;
`sprites` lists the original sprites; `clones` counts each one's clones; `say`
is the speech or thought bubble text or `null`.

**`applyBlocks`**: `blocks` is an sb3 `blocks` map holding exactly one
top-level script. It is added to `target` under fresh block ids (`x`, `y`
place it), or replaces the script whose top block is `replace`. A locked
script is never replaced; blocks of an extension the editor refuses are
refused. `undo` is a one-time token: `undo` removes the added script and puts
back the replaced one.

## Modes

- **edit**: the editor, with uploads (sprite, costume, backdrop, sound files,
  File > Load) and File > Save to your computer.
- **exam**: as edit, without any upload, File > Load or File > New.
- **readonly**: the stage and its controls only (for review).

Always, in every mode: no backpack, no sharing, no account, no tutorials, no
community links, no cloud variables, no analytics; only the Pen and Music
extensions (translate, text to speech, video and face sensing, speech to text
and the hardware extensions are refused and not even shipped); no cookies or
web storage; no request to any server but the editor's own.
