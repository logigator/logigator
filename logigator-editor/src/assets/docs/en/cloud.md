# Cloud & Sharing

Your Logigator account keeps projects and components in the cloud, reachable from any device — and lets you share them with a link. Everything in the editor works without an account; signing in adds cloud storage and sharing.

![The account menu open in the top-right corner, showing the signed-in account, theme and language options, and Log Out.](images/cloud/account-menu.png)

## Signing in and your account

Open the account menu in the top-right corner. When signed out it offers **Log In**; when signed in it shows your **Account** and a **Log Out** option, alongside the **Theme** and **Language** settings (see [Settings & Appearance](docs:settings)).

Signing in gives you:

- **Cloud storage** for projects and custom components, available on every device you log in from.
- **Share links** for your cloud projects and components.

Logging out clears your cloud library from this session; your local (browser) projects stay put.

## Local vs. cloud storage

Every project and custom component lives in one of two places:

- **Local** — stored in the browser you're using. Fast and account-free, but tied to that one browser and not backed up.
- **Cloud** — stored in your account. Reachable from any device once you sign in.

The chip beside the project name shows which one the open project uses (**Local**, **Cloud**, or **Draft** if it hasn't been saved yet). See [Saving & Files](docs:saving-and-files) for the save flow.

The **File → Open** dialog keeps the two apart in separate tabs — **Local Projects** and **Cloud Projects** — plus a **From File** tab for importing a circuit file. If you're signed out, the Cloud Projects tab prompts you to log in.

![The Open Project dialog with the Cloud Projects tab selected, listing cloud projects each with rename, upload, share and delete actions.](images/cloud/open-cloud-projects.png)

## Moving work to the cloud

There are two ways to get a project into your cloud library:

1. **Save a Draft straight to the cloud** — when you first save a new project, pick **Destination: Cloud** in the save dialog.
2. **Upload an existing local project** — with a saved Local project open, choose **File → Upload to cloud**. You can also upload a project from the list in the **Open** dialog.

Uploading *moves* the project out of local storage into your cloud library. If the project uses local custom components, those are published to your cloud library alongside it — a cloud project can only contain cloud components, so each one is uploaded first and then referenced. The upload dialog lists exactly which components will be published before you confirm.

Custom components can be moved to the cloud the same way, from their action in the settings panel.

![The Upload to cloud dialog showing the visibility toggle and a list of local components that will be published alongside the project.](images/cloud/upload-to-cloud.png)

## Sharing a project

Once a project is in the cloud, **File → Share** opens the share dialog. (Sharing is only available for cloud projects; upload a local project first.)

- **Share link** — anyone with the link can open your project **read-only** and **clone it into their own library** to build on. Use **Copy link** to grab it.
- **Public** — a public project is also published on your profile and discoverable by everyone. A private project is reachable **only** through its share link.
- **Regenerate link** — creates a fresh link and permanently invalidates the old one; anyone still using the old link loses access.

Cloud custom components can be shared the same way from the settings panel.

![The Share project dialog showing the share link with a copy button, the public/private toggle, and the regenerate link option.](images/cloud/share-dialog.png)

### What the recipient sees

Someone opening your share link gets a **read-only** copy — the chip reads **Shared** and they can't save changes over yours or export it to a file. To make it their own, they **clone** it into their library, which gives them a full, editable copy they can save and edit freely. Their clone is independent; later edits on either side don't affect the other.

## Cookie & consent settings

When Logigator is served with its consent banner, you can revisit your cookie and consent preferences at any time from **Help → Cookie Settings**. (This entry only appears where the consent banner is available.)

## See also

- [Saving & Files](docs:saving-and-files) — saving locally, `.lgix` files and image export
- [Custom Components](docs:custom-components) — the reusable parts that travel with a shared project
- [Settings & Appearance](docs:settings) — theme, language and account settings
