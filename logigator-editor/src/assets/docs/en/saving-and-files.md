# Saving & Files

Where your work lives: in your browser, in your account, or in a file on your device. This page covers saving in the browser, exporting to a file, and generating an image of your circuit.

![The editor with the project name and its source chip highlighted at the top, and the status bar at the bottom showing the saved / unsaved indicator.](images/saving-and-files/save-overview.png)

## Saving your project

Save with **File → Save** or `Ctrl+S`. The button also sits in the toolbar.

A project that has never been saved is a **Draft** — the chip beside the project name says so. The first time you save a Draft, Logigator asks for two things:

- **Name** — what to call the project.
- **Destination** — **Local** (stored in this browser) or **Cloud** (stored in your Logigator account, if you are signed in).

After that first save, **Save** writes straight back to wherever the project lives — no more prompts. See [Cloud & Sharing](docs:cloud) for what signing in and the Cloud destination add.

### Knowing where a project is stored

The chip next to the project name always shows the project's home:

| Chip       | Meaning                                           |
| ---------- | ------------------------------------------------- |
| **Draft**  | Never saved yet — save it to store it.            |
| **Local**  | Saved in this browser only.                       |
| **Cloud**  | Saved in your account, reachable from any device. |
| **Shared** | Opened read-only from someone's share link.       |

### The saved / unsaved indicator

The **status bar** at the bottom of the editor shows **Saved** when everything is written, and **Unsaved changes** the moment you make an edit. Use it as a quick check before you close the tab.

### A note on local projects

Local projects live only in the browser you saved them in. As the save dialog warns:

> Local projects are not persisted across devices and may be lost.

If a project matters, save it to the **Cloud** (see [Cloud & Sharing](docs:cloud)) or **export it to a file** so you have a copy you control.

### Opening old projects

If you open a circuit made with the older Logigator editor, saving it here converts it to the new format. Reopening it in the old editor afterwards may drop or misrender custom components, so keep the original if you still need it.

## Circuit files (`.lgix`)

You can also keep a circuit as a file on your own device.

- **Export** — **File → Export to file** downloads the open project as a `.lgix` file.
- **Import** — **File → Open → From File**, then **Choose File**, loads a `.lgix` file back into the editor as a new local project.

A file is only ever an export or an import — it is not a place your project "lives" the way Local and Cloud storage are. Exporting doesn't change where your project is saved.

### What's in a `.lgix` file

A `.lgix` file is a compressed, self-contained snapshot of your circuit. It bundles the board itself **and** a frozen copy of every [custom component](docs:custom-components) the circuit uses, so it opens correctly on any machine even if that machine has never seen those components.

The file is compressed but not encrypted or locked — treat it as a convenient package, not a secure or tamper-proof one. Logigator can also import the older editor's exported `.json` circuit files.

> Read-only projects opened from a share link cannot be exported to a file. Clone the shared project into your own library first — see [Cloud & Sharing](docs:cloud).

![The Open Project dialog with its three tabs — Local Projects, Cloud Projects and From File — with the From File tab showing the Choose File button.](images/saving-and-files/open-from-file.png)

## Generating an image

To export a picture of your circuit, choose **File → Generate image**. The dialog lets you set:

- **Format** — **PNG**, **JPEG** or **WebP**.
- **Resolution** — the output size; very large sizes are automatically reduced to fit your device's limits.
- **Background** — the current theme color and the grid.
- **Quality** — the compression quality (shown for JPEG and WebP; PNG is lossless).

The dialog previews the final pixel dimensions before you export.

![The Export image dialog showing the format selector, resolution, background and quality controls, with a preview of the output dimensions.](images/saving-and-files/generate-image.png)

## See also

- [Cloud & Sharing](docs:cloud) — signing in, cloud storage, uploading and share links
- [Custom Components](docs:custom-components) — the reusable parts a file carries with it
- [Keyboard Shortcuts](docs:shortcuts) — change the `Ctrl+S` binding and others
