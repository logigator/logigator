import type { WorkMode } from '../app/work-mode/work-mode.enum';
import type { ShortcutActionEnum } from '../app/shortcuts/shortcut-action.enum';
import type { ComponentCategory } from '@logigator/core';
import { consentEn } from '@logigator/core/consent-text/en';

const en = {
  common: {
    save: 'Save',
    cancel: 'Cancel',
    untitled: 'Untitled',
    close: 'Close',
    back: 'Back',
    dismiss: 'Dismiss',
    firstPage: 'First page',
    previousPage: 'Previous page',
    nextPage: 'Next page',
    lastPage: 'Last page',
    formatting: 'Formatting',
    heading1: 'Heading 1',
    heading2: 'Heading 2',
    heading3: 'Heading 3',
    bold: 'Bold',
    italic: 'Italic',
    code: 'Code',
    link: 'Link',
    bulletedList: 'Bulleted list',
    numberedList: 'Numbered list',
    quote: 'Quote',
    codeBlock: 'Code block',
    divider: 'Divider',
    table: 'Table',
    linkTools: 'Link',
    linkText: 'link',
    linkUrl: 'Link address',
    removeLink: 'Remove link',
    tableTools: 'Table',
    insertRowAbove: 'Insert row above',
    insertRowBelow: 'Insert row below',
    insertColumnBefore: 'Insert column before',
    insertColumnAfter: 'Insert column after',
    deleteRow: 'Delete row',
    deleteColumn: 'Delete column',
    deleteTable: 'Delete table',
    alignLeft: 'Align left',
    alignCenter: 'Align center',
    alignRight: 'Align right',
    viewMode: 'View',
    richText: 'Rich text',
    markdownSource: 'Markdown',
    moved: 'Moved to position {{position}} of {{total}}'
  },
  user: {
    loadFailed: 'Could not load your account. Please log in again.'
  },
  userSettings: {
    notSignedIn: 'Not signed in',
    theme: 'Theme',
    language: 'Language',
    editorSettings: 'Editor Settings',
    account: 'Account',
    logOut: 'Log Out',
    logIn: 'Log In',
    signUp: 'Sign Up'
  },
  theming: {
    light: 'Light',
    dark: 'Dark'
  },
  // Written once in @logigator/core: one decision covers the whole origin,
  // so the site and the editor ask it in the same words.
  consent: consentEn,
  hexEditor: {
    wordView: 'Words',
    byteView: 'Bytes',
    hex: 'Hex',
    decimal: 'Decimal',
    octal: 'Octal',
    binary: 'Binary',
    address: 'Addr',
    goto: 'Go to address',
    gotoPlaceholder: 'Address…',
    activeAddress: 'Address',
    value: 'Value',
    noActiveCell: 'No cell selected',
    clear: 'Clear',
    copy: 'Copy',
    follow: 'Follow',
    clearConfirm: 'Clear all memory contents?',
    copyFailed: 'Could not copy to clipboard.',
    viewLabel: 'Cell grouping',
    radixLabel: 'Number base'
  },
  settings: {
    options: {
      fpsCounter: 'FPS Counter',
      showGrid: 'Show Grid',
      autoStartSimulation: 'Auto-start simulation',
      dragSelectionInPanMode: 'Drag selection in Pan mode'
    }
  },
  minimap: {
    expand: 'Show minimap',
    collapse: 'Hide minimap'
  },
  components: {
    category: {
      hidden: 'Hidden',
      basic: 'Basic',
      advanced: 'Advanced',
      io: 'Inputs / Outputs',
      port: 'Ports',
      user: 'User Components'
    } satisfies Record<ComponentCategory, string>,
    def: {
      NOT: {
        name: 'NOT Gate',
        description:
          'A NOT gate is a digital logic gate that implements logical negation. A HIGH input (1) gives a LOW output (0), and a LOW input (0) gives a HIGH output (1).'
      },
      AND: {
        name: 'AND Gate',
        description:
          'An AND gate is a digital logic gate that implements logical conjunction. A HIGH output (1) results only if every input to the AND gate is HIGH (1). If any input is LOW (0), a LOW output results.'
      },
      OR: {
        name: 'OR Gate',
        description:
          'An OR gate is a digital logic gate that implements logical disjunction. A HIGH output (1) results if at least one input to the OR gate is HIGH (1). Only if every input is LOW (0), a LOW output results.'
      },
      XOR: {
        name: 'XOR Gate',
        description:
          'An XOR gate is a digital logic gate that implements exclusive disjunction. A HIGH output (1) results if an odd number of inputs to the XOR gate are HIGH (1).'
      },
      DELAY: {
        name: 'Delay',
        description:
          'A buffer that passes its input through unchanged, adding one simulation tick of delay to the signal.'
      },
      CLOCK: {
        name: 'Clock',
        description:
          'Periodically emits a one-tick pulse on its output. The delay between pulses is configurable; driving the STP input HIGH pauses the clock.',
        options: {
          speed: 'Delay'
        }
      },
      TUNNEL: {
        name: 'Tunnel',
        description:
          'Works like a wire, but wireless: all tunnels carrying the same label are electrically connected.'
      },
      HALF_ADDER: {
        name: 'Half Adder',
        description:
          'Adds up two 1-bit numbers. S carries the sum bit and C the carry bit.'
      },
      FULL_ADDER: {
        name: 'Full Adder',
        description:
          'Adds up three 1-bit numbers (two summands and a carry-in). S carries the sum bit and C the carry bit.'
      },
      ROM: {
        name: 'ROM',
        description:
          'Read-only memory. The outputs carry the word stored at the address on the A inputs. Its contents are set with “Edit contents” and cannot change while the simulation runs.',
        options: {
          wordSize: 'Word Size',
          addressSize: 'Address Size',
          data: 'Edit contents',
          dataEditorTitle: 'Edit ROM contents'
        }
      },
      D_FF: {
        name: 'D Flip-Flop',
        description:
          'Holds one bit of state. The state on D is saved on the rising edge of CLK; Q carries the state and !Q its inverse.'
      },
      JK_FF: {
        name: 'JK Flip-Flop',
        description:
          'Holds one bit of state. On the rising edge of CLK, a HIGH J sets and a HIGH K resets the state; both HIGH toggle it. Q carries the state and !Q its inverse.'
      },
      SR_FF: {
        name: 'SR Flip-Flop',
        description:
          'Holds one bit of state. On the rising edge of CLK, a HIGH S sets and a HIGH R resets the state. Q carries the state and !Q its inverse.'
      },
      RNG: {
        name: 'Random Number Generator',
        description:
          'Generates random data on its outputs on every rising edge of CLK.'
      },
      RAM: {
        name: 'RAM',
        description:
          'Random access memory. On the rising edge of CLK it reads the addressed word onto the outputs. While WE is HIGH, it stores the word on the data inputs at that address instead.',
        options: {
          wordSize: 'Word Size',
          addressSize: 'Address Size'
        }
      },
      DECODER: {
        name: 'Decoder',
        description:
          '1-of-n binary decoder. Drives exactly the one output whose index equals the binary value on the inputs.'
      },
      ENCODER: {
        name: 'Encoder',
        description:
          '2^n-to-n binary encoder. Outputs the binary index of the highest powered input.'
      },
      MUX: {
        name: 'Multiplexer',
        description:
          'Routes the data input addressed by the select lines to the single output.',
        options: {
          selectLines: 'Select lines'
        }
      },
      DEMUX: {
        name: 'Demultiplexer',
        description:
          'Routes the data input I to the output addressed by the select lines.',
        options: {
          selectLines: 'Select lines'
        }
      },
      TEXT: {
        name: 'Text',
        description:
          "A text annotation placed on the canvas. The dot marks the label's anchor point.",
        options: {
          text: 'Edit text',
          placeholder: 'Enter text…',
          fontSize: 'Font size'
        }
      },
      INPUT: {
        name: 'Input',
        description:
          "An input plug. Defines one of a custom component's input ports; its label names the port and its order determines the port position."
      },
      OUTPUT: {
        name: 'Output',
        description:
          "An output plug. Defines one of a custom component's output ports; its label names the port and its order determines the port position."
      },
      BUTTON: {
        name: 'Button',
        description:
          'A push button. While the simulation is running, its output is on for as long as it is held down.'
      },
      PULSE_BUTTON: {
        name: 'Pulse button',
        description:
          'A pulse button. While the simulation is running, clicking it emits a single one-tick pulse on its output.'
      },
      SWITCH: {
        name: 'Switch',
        description:
          'A latching switch. While the simulation is running, clicking it toggles its output between on and off.'
      },
      LED: {
        name: 'LED',
        description:
          'Lights up while the wire connected to its input is powered.'
      },
      SEGMENT_DISPLAY: {
        name: 'Segment Display',
        description:
          'Displays the binary value on its inputs (input 0 is the least significant bit) as a number in the configured base.',
        options: {
          base: 'Base'
        }
      },
      LED_MATRIX: {
        name: 'LED Matrix',
        description:
          'A square grid of LEDs that displays an image. On the rising edge of CLK, the data inputs are latched into the row addressed by the address inputs.',
        options: {
          size: 'Width/Height'
        }
      }
    },
    options: {
      direction: 'Direction',
      inputs: 'Inputs',
      outputs: 'Outputs',
      label: 'Label',
      index: 'Index'
    }
  },
  sideBar: {
    title: 'Components',
    search: 'Search…',
    outdatedInstances:
      '{{count}} placed instance(s) of this component are out of date'
  },
  board: {
    panel: 'Circuit board'
  },
  tabBar: {
    mainProject: 'Main project',
    close: 'Close',
    landmark: 'Open projects'
  },
  portsPanel: {
    title: 'Ports',
    badge: 'component',
    inputs: 'Inputs',
    outputs: 'Outputs',
    noInputs: 'No input plugs',
    noOutputs: 'No output plugs',
    inputName: 'Input {{index}}',
    outputName: 'Output {{index}}',
    nameLabel: '{{name}} name, port {{position}}'
  },
  statusBar: {
    modes: {
      pan: 'Pan: drag to move the board · scroll or pinch to zoom',
      wireTool:
        'Wire tool: drag to draw · tap a port to negate · tap a junction to connect/disconnect · tap to select · {{additiveKey}} to add or remove',
      sel: 'Select: drag a box to select · drag the selection to move · hold {{scissorKey}} to cut wires',
      selExact: 'Cut wires: drag a box to select · wires are cut at its edge',
      erase: 'Eraser: click or drag across elements to delete them',
      placeComp: 'Placing {{componentName}}: drag to position · Esc to cancel',
      simulation: 'Simulating: click switches, press buttons · drag to pan'
    } satisfies Record<WorkMode, string>,
    saved: 'Saved',
    unsaved: 'Unsaved changes',
    selected: 'Selected'
  },
  titleBar: {
    menuBar: {
      file: {
        label: 'File',
        items: {
          newProject: {
            label: 'New Project'
          },
          newComponent: {
            label: 'New Component'
          },
          open: {
            label: 'Open'
          },
          save: {
            label: 'Save'
          },
          uploadCloud: {
            label: 'Upload to Cloud'
          },
          share: {
            label: 'Share'
          },
          cloneShare: {
            label: 'Clone to My Projects'
          },
          cloneShareComponent: {
            label: 'Clone to My Components'
          },
          exportFile: {
            label: 'Export to File'
          },
          generateImage: {
            label: 'Generate Image'
          }
        }
      },
      edit: {
        label: 'Edit',
        items: {
          undo: {
            label: 'Undo'
          },
          redo: {
            label: 'Redo'
          },
          cut: {
            label: 'Cut'
          },
          copy: {
            label: 'Copy'
          },
          paste: {
            label: 'Paste'
          },
          delete: {
            label: 'Delete'
          },
          repairWires: {
            label: 'Repair Wires'
          }
        }
      },
      view: {
        label: 'View',
        items: {
          zoomIn: {
            label: 'Zoom In'
          },
          zoomOut: {
            label: 'Zoom Out'
          },
          zoom100: {
            label: 'Zoom 100%'
          }
        }
      },
      help: {
        label: 'Help',
        items: {
          documentation: {
            label: 'Documentation'
          },
          changelog: {
            label: "What's New"
          },
          cookieSettings: {
            label: 'Cookie Settings'
          },
          about: {
            label: 'About'
          }
        }
      }
    },
    rename: {
      label: 'Rename project',
      cancel: 'Cancel',
      error: 'Could not rename the project.'
    },
    fork: {
      label: 'Fork',
      title: 'Forked from {{lineage}}',
      lineageEntry: '{{name}} by {{author}}'
    }
  },
  discardChanges: {
    header: 'Discard changes?',
    message:
      'The current project has unsaved changes that will be lost. Continue anyway?',
    accept: 'Discard',
    reject: 'Cancel'
  },
  changelogDialog: {
    header: "What's New",
    loading: 'Loading changelog…',
    loadError: 'The changelog could not be loaded.',
    close: 'Close'
  },
  documentation: {
    header: 'Documentation',
    loading: 'Loading page…',
    loadError: 'This page could not be loaded.',
    back: 'All topics',
    learnMore: 'Learn more',
    search: {
      label: 'Search the documentation',
      placeholder: 'Search…',
      loading: 'Loading the documentation…',
      empty: 'Nothing matches “{{query}}”.'
    },
    sections: {
      basics: 'Basics',
      building: 'Building circuits',
      simulation: 'Simulation',
      projects: 'Projects and cloud'
    },
    pages: {
      gettingStarted: 'Getting started',
      boardAndTools: 'Board and tools',
      phonesAndTablets: 'Phones and tablets',
      shortcuts: 'Keyboard shortcuts',
      settings: 'Settings',
      componentsAndOptions: 'Components and options',
      wiresAndConnections: 'Wires and connections',
      customComponents: 'Custom components',
      simulation: 'Simulation',
      inspection: 'Inspection and watches',
      savingAndFiles: 'Saving and files',
      cloud: 'Cloud and sharing'
    }
  },
  aboutDialog: {
    header: 'About Logigator',
    tagline: 'A free, open-source logic circuit editor and simulator.',
    version: 'Version',
    commit: 'Commit',
    buildDate: 'Build date',
    license: 'License',
    licenseName: 'GNU AGPL v3',
    copyright: '© 2019–{{year}} Logigator',
    repository: 'Repository',
    privacyPolicy: 'Privacy Policy',
    imprint: 'Imprint',
    close: 'Close'
  },
  openProjectDialog: {
    title: 'Open Project',
    localProjects: 'Local Projects',
    cloudProjects: 'Cloud Projects',
    fromFile: 'From File',
    notLoggedIn: 'Log in to see your cloud projects',
    close: 'Close',
    loading: 'Loading…',
    uploadPrompt: 'Open a circuit file saved on your device.',
    chooseFile: 'Choose File',
    deleteProject: 'Delete Project',
    renameProject: 'Rename Project',
    uploadProject: 'Upload to cloud',
    shareProject: 'Share',
    cancelRename: 'Cancel',
    deleteConfirmMessage:
      'Are you sure you want to delete “{{name}}”? This cannot be undone.',
    deleteAccept: 'Delete',
    deleteReject: 'Cancel',
    searchPlaceholder: 'Search projects…',
    searchButton: 'Search',
    noSearchResults: 'No projects found',
    lastEdited: 'Last edited',
    errors: {
      listLocal: 'Could not load your local projects.',
      openLocal: 'Could not open the local project.',
      deleteLocal: 'Could not delete the local project.',
      renameLocal: 'Could not rename the local project.',
      listCloud: 'Could not load your cloud projects.',
      openCloud: 'Could not open the cloud project.',
      deleteCloud: 'Could not delete the cloud project.',
      renameCloud: 'Could not rename the cloud project.',
      importFailed: 'Could not import the file: {{detail}}',
      readFailed: 'Could not read the selected file.'
    }
  },
  saveProjectDialog: {
    name: 'Name',
    destination: 'Destination',
    destinationCloud: 'Cloud',
    destinationLocal: 'Local',
    notLoggedIn: 'You must be logged in to save projects to the cloud.',
    visibilityLabel: 'Who can open it',
    localWarning:
      "A local project exists only in this browser. Clearing the browser's site data deletes it."
  },
  newComponentDialog: {
    name: 'Name',
    symbol: 'Symbol',
    description: 'Description',
    store: 'Store',
    storeCloud: 'Cloud',
    storeLocal: 'Local',
    notLoggedIn: 'You must be logged in to save components to the cloud.',
    visibilityLabel: 'Who can open it',
    localWarning:
      "A local component exists only in this browser. Clearing the browser's site data deletes it.",
    create: 'Create'
  },
  uploadComponent: {
    button: 'Upload to cloud',
    signInTooltip: 'Sign in to upload to the cloud'
  },
  // The three states a document's link can be in. The share dialog's picker and
  // the three dialogs that create a cloud document all name them, so their
  // words belong under none of those. Each state's `hint` says what it means
  // for whoever holds the link, which is what the picker shows under the state
  // it is on.
  visibility: {
    private: {
      label: 'Only you',
      hint: 'Only you can open it, even with the link.'
    },
    unlisted: {
      label: 'Anyone with the link',
      hint: 'Whoever holds the link can open it read-only. It stays out of the community listings and out of search engines.'
    },
    public: {
      label: 'Everyone',
      hint: 'Listed in the community, open to everyone, and indexed by search engines.'
    }
  },
  shareDialog: {
    /** Sent with the link by a share sheet, and the embed's alt text. */
    caption: '“{{name}}” on Logigator',
    header: 'Share project',
    headerComponent: 'Share component',
    intro: 'Choose who can open “{{name}}”.',
    visibilityLabel: 'Who can open it',
    linkLabel: 'Share link',
    noLink:
      'Only you can open the document while it is private. The link stays the same: pick “Anyone with the link” to hand it out again or to regenerate it.',
    viewPublicPage: 'View the community page',
    copy: 'Copy link',
    linkCopied: 'Share link copied to clipboard.',
    copyFailed: 'Could not copy the link to the clipboard.',
    regenerate: 'Regenerate link',
    regenerateWarning:
      'The old link stops working immediately, for everyone who has it. Your circuit itself is unchanged.',
    linkPublished:
      'The link was not replaced: this document is published, and its link is the address of its page.',
    linkRegenerated: 'A new share link was generated.',
    regenerateFailed: 'Could not regenerate the share link.',
    visibilityUpdated: 'Visibility updated.',
    visibilityFailed: 'Could not update the visibility.',
    share: 'Share',
    embed: 'Embed',
    embedHide: 'Hide embed',
    embedCopy: 'Copy code',
    embedCopied: 'Embed code copied to clipboard.',
    embedCopyFailed: 'Could not copy the embed code to the clipboard.',
    embedHint: 'Paste this into a forum post, a wiki page or a lesson.',
    formatLabel: 'Format',
    formatMarkdown: 'Markdown',
    formatHtml: 'HTML',
    formatBbcode: 'BBCode',
    close: 'Close'
  },
  shareComponent: {
    button: 'Share'
  },
  deleteComponent: {
    button: 'Delete',
    confirmMessageLocal:
      'Delete “{{name}}” from your library? This is permanent. Any placed instances stay as embedded copies you can restore later.',
    confirmMessageCloud:
      'Delete “{{name}}” from your cloud library? This is permanent and its share link stops working. Any placed instances stay as embedded copies you can restore later.',
    confirmAccept: 'Delete',
    confirmReject: 'Cancel',
    deleted: '“{{name}}” was deleted from your library.',
    deleteFailed: 'Could not delete the component.'
  },
  uploadDialog: {
    header: 'Upload to cloud',
    introProject:
      '“{{name}}” is moved out of local storage and stored in your cloud library, so you can reach it from any device.',
    introComponent:
      '“{{name}}” is moved out of your local library and stored in your cloud library, so you can use it from any device.',
    introDraft:
      '“{{name}}” embeds these local components. They will be uploaded to your cloud library alongside it.',
    depsTitle: 'These local components will also be uploaded',
    depsHint:
      'A cloud project can only contain cloud components, so each of these is uploaded to your cloud library first and then referenced.',
    unresolvableWarning:
      '{{count}} embedded component(s) can no longer be uploaded because their library entry is gone. They stay embedded copies.',
    visibilityLabel: 'Who can open it',
    notLoggedIn: 'You must be logged in to upload to the cloud.',
    cancel: 'Cancel',
    upload: 'Upload',
    analyzeFailed: 'Could not read the circuit to prepare the upload.',
    dependencyFailed:
      'Could not upload component “{{name}}”. The upload stopped there, so try again.',
    uploadFailed: 'Could not upload “{{name}}” to the cloud.'
  },
  closeTab: {
    header: 'Unsaved changes',
    message: '“{{name}}” has unsaved changes. Save them before closing?',
    promotionWarning:
      'Saving also uploads {{count}} local component(s) to your cloud library.',
    save: 'Save',
    discard: 'Discard',
    cancel: 'Cancel'
  },
  sourceIndicator: {
    cloudTitle: 'Saved in your cloud library',
    localTitle: 'Saved in this browser only',
    draftTitle: 'Not saved yet. Save it to the cloud or in this browser.',
    shareTitle: 'Opened from a share link (read-only)',
    label: {
      server: 'Cloud',
      browser: 'Local',
      draft: 'Draft',
      share: 'Shared',
      embedded: 'Embedded'
    },
    title: {
      server: 'Saved in your cloud library',
      browser: 'Saved in this browser only',
      draft: 'Not saved yet',
      share: 'Opened from a share link',
      embedded: 'Embedded copy: its library component no longer exists'
    }
  },
  toolBar: {
    save: 'Save',
    open: 'Open',
    newComp: 'New Component',
    copy: 'Copy',
    cut: 'Cut',
    paste: 'Paste',
    delete: 'Delete',
    rotateCw: 'Rotate clockwise',
    rotateCcw: 'Rotate counter-clockwise',
    undo: 'Undo',
    redo: 'Redo',
    zoomOut: 'Zoom out',
    zoomIn: 'Zoom in',
    pan: 'Pan',
    parts: 'Parts',
    placeComponent: 'Placing component',

    wireTool: 'Wire Tool',
    select: 'Select',
    selExact: 'Cut wires at selection edge (hold to activate)',
    selExactShort: 'Cut wires',
    eraser: 'Eraser',
    text: 'Text',
    startSim: 'Start simulation',
    exitSim: 'Exit simulation',
    play: 'Run',
    pause: 'Pause',
    step: 'Step',
    stopSim: 'Stop',
    speed: 'Simulation speed',
    speedFrame: 'Every frame',
    speedFrameHint: 'One tick per screen refresh, so every change is drawn.',
    speedFixed: 'Fixed speed',
    speedFixedHint: 'Ticks at the rate you choose.',
    speedMax: 'As fast as possible',
    speedMaxShort: 'Max speed',
    speedMaxHint: 'No limit. The screen shows only some of the ticks.',
    speedRate: 'Ticks per second',
    speedRateHint: 'For example 0.5 · 20 · 2.5k · 1M',
    speedBehind:
      'Slower than the fixed speed: the circuit is too large to keep up.',
    clocks: 'Clocks at this speed',
    clockDelay: 'Clock, delay {{delay}}',
    clocksMore: '+{{count}} more',
    ticks: '{{ticks}} ticks'
  },
  mobile: {
    account: 'Account',
    palette: 'Components',
    settings: 'Settings',
    ports: 'Ports'
  },
  logging: {
    error: 'Error',
    warn: 'Warning',
    success: 'Success',
    info: 'Info',
    debug: 'Debug',
    unexpectedError:
      'Something went wrong, and some actions may not have finished. The browser console has the details.'
  },
  clipboard: {
    clear: 'Clear clipboard',
    pastePartial:
      'Some elements were not pasted because their component type no longer exists.',
    pastePlugsSkipped:
      'Input and output plugs were not pasted. They only work inside a custom component.'
  },
  wireRepair: {
    repaired:
      'Repaired {{count}} wire issue(s). Please check that your circuit still works as expected before saving.',
    loadDetected:
      'This circuit has {{count}} wire issue(s), such as overlapping wires. A wire with an issue can be connected differently from how it looks.',
    repairAction: 'Repair wires',
    leftSimulation: 'Simulation stopped so the wires could be repaired.',
    clean: 'No wire issues found.'
  },
  bugReport: {
    title: 'Report a problem',
    badgeTooltip: 'Report a bug',
    intro:
      'Describe what you were doing when the bug happened. Steps we can follow to make it happen again help the most.',
    errorIntro:
      'An unexpected error occurred. Tell us what you were doing so we can track it down.',
    errorDetails: 'Error details',
    placeholder: 'What happened?',
    dataNotice:
      'Your current project, browser details and recent activity are attached to help us reproduce the issue.',
    send: 'Send report',
    cancel: 'Cancel',
    sent: 'Thanks, your report was sent.',
    failed: 'Could not send the report. Please try again.'
  },
  persistence: {
    projectSaved: 'Project saved.',
    projectSavedLocal: 'Project saved to local storage.',
    componentSaved: 'Component saved.',
    componentSavedLocal: 'Component saved to local storage.',
    componentUploaded: 'Component uploaded to your cloud library.',
    projectUploaded: 'Project uploaded to your cloud library.',
    projectCreated: 'Project created.',
    projectExported: 'Project exported to file.',
    exportFailed: 'Could not export the project to a file.',
    localSaveFailed: 'Could not save the project to local storage.',
    localComponentSaveFailed: 'Could not save the component to local storage.',
    saveFailed: 'Could not save: {{detail}}',
    saveFailedGeneric: 'Could not save the project.',
    createFailed: 'Could not create the project: {{detail}}',
    saveTooLarge:
      'This circuit is too large to save to the cloud. Remove some components and try again.',
    versionMismatch:
      'This project was changed somewhere else. Reload it before saving again.',
    loadFailed: 'Could not load the project.',
    componentLoadFailed: 'Could not load the component.',
    shareLoadFailed: 'Could not load the shared circuit.',
    shareAuthRequired:
      'Sign in to add this shared circuit to your cloud library.',
    shareCloned: 'Shared circuit cloned to your cloud library.',
    shareCloneFailed: 'Could not clone the shared circuit.',
    dumpElementCountChanged:
      'Project Dump element count changed on load — ids and action history were not restored.',
    skippedCustomOne:
      'A custom component was skipped because its definition is missing.',
    skippedCustomMany:
      '{{count}} custom components were skipped because their definitions are missing.'
  },
  browserSupport: {
    unsupported:
      'This browser is not supported, so parts of the editor may not work. If you run into problems, try updating it.'
  },
  editor: {
    rendererInitFailed:
      'Could not start the graphics renderer. Your browser or GPU may be unsupported.',
    fontLoadFailed:
      'The editor fonts did not load, so some labels may look wrong.',
    eraseRestoreFailed: 'Some erased components could not be restored.',
    circularDependency:
      'Cannot place this component here. It would create a circular dependency.'
  },
  simulation: {
    workerMessageUnreadable:
      'The simulation worker sent an unreadable message. Simulation stopped.',
    engineInitFailed:
      'Could not start the simulation engine. Your browser may not support WebAssembly.',
    workerCrashed: 'The simulation stopped unexpectedly.',
    unsupportedComponent:
      'Component “{{symbol}}” is not supported by the simulator.',
    recursiveComponent:
      'Custom component “{{name}}” places itself inside its own circuit.',
    componentNoCircuit:
      'Custom component “{{name}}” has no circuit to simulate.',
    plugMismatch:
      'Custom component “{{name}}” declares {{declaredInputs}}/{{declaredOutputs}} ports but its circuit has {{actualInputs}}/{{actualOutputs}} plugs.'
  },
  watch: {
    rendererFailed:
      'Could not open the watch view because the renderer did not start.',
    noInnerCircuit: 'This component has no inner circuit to inspect.',
    circuitMismatch:
      'The inner circuit does not match the compiled simulation. Restart the simulation to inspect it.'
  },
  componentActions: {
    edit: 'Edit circuit',
    update: 'Update to latest',
    updateAll: 'Update all instances ({{count}})',
    createFailed: 'Could not create the component.',
    openFailed: 'Could not open the component.',
    cloudLoadFailed: 'Could not load the component from the cloud.',
    view: 'View inside',
    viewTooltip:
      'Open this component read-only. It belongs to the shared circuit, so nothing is added to your library. Clone the share to keep a copy.',
    restore: 'Restore & edit',
    restoreTooltip:
      "This component's library entry is gone, but its circuit is embedded in the project. Restore it to your local library to edit it.",
    restored: 'Component restored to your local library.',
    restoreFailed: 'Could not restore this component.',
    signInToEdit: 'Sign in to edit',
    signInTooltip:
      'This component lives in your cloud library. Sign in to load and edit it.'
  },
  editComponentDetails: {
    button: 'Edit details',
    header: 'Edit component details',
    name: 'Name',
    symbol: 'Symbol',
    description: 'Description',
    frozenInstancesHint:
      'Placed instances keep their current details. Use “Update to latest” on a selected instance to apply the new ones.',
    save: 'Save',
    saved: 'Component details updated.',
    saveFailed: 'Could not update the component details.'
  },
  library: {
    loadFailed: 'Some saved components could not be loaded.'
  },
  logoutDialog: {
    header: 'Unsaved changes',
    message:
      'These cloud documents have unsaved changes. Save them before logging out?',
    promotionWarning:
      'Saving also uploads {{count}} local component(s) to your cloud library.',
    save: 'Save & Log Out',
    discard: 'Log Out without Saving',
    cancel: 'Cancel',
    edited: 'Edited {{relative}}'
  },
  session: {
    loggedOut: 'Logged out.',
    logoutFailed: 'Logging out failed. Please try again.',
    saveLoggedOut: 'You are signed out. Log in again to save to the cloud.',
    saveForeign:
      '“{{name}}” belongs to a different account and cannot be saved.'
  },
  routing: {
    notFound: 'That link could not be opened.'
  },
  imageExport: {
    title: 'Export image',
    project: 'Project',
    format: 'Format',
    resolution: 'Resolution',
    background: 'Background',
    backgroundHint: 'Theme color and grid',
    quality: 'Quality',
    dimensions: '{{width}} × {{height}} px',
    clampedHint: '(reduced to fit device limits)',
    export: 'Export',
    cancel: 'Cancel',
    success: 'Image exported.',
    error: {
      unavailable: 'The editor is not ready yet. Try again in a moment.',
      failed: 'Image export failed.'
    },
    warn: {
      clamped:
        'Resolution reduced to fit device limits; exported at {{width}} × {{height}} px.'
    }
  },
  shortcuts: {
    title: 'Keyboard Shortcuts',
    actions: {
      save: 'Save',
      open: 'Open',
      newComponent: 'New Component',
      undo: 'Undo',
      redo: 'Redo',
      copy: 'Copy',
      cut: 'Cut',
      paste: 'Paste',
      delete: 'Delete',
      rotateSelection: 'Rotate Clockwise',
      rotateSelectionCcw: 'Rotate Counter-Clockwise',
      moveSelectionUp: 'Move Selection Up',
      moveSelectionDown: 'Move Selection Down',
      moveSelectionLeft: 'Move Selection Left',
      moveSelectionRight: 'Move Selection Right',
      zoomIn: 'Zoom In',
      zoomOut: 'Zoom Out',
      zoom100: 'Zoom 100%',
      toolPan: 'Pan',
      toolWire: 'Wire Tool',
      toolSelect: 'Select',
      selectScissor: 'Cut Wires at Selection Edge (hold)',
      selectAdditive: 'Add to or Remove from Selection (hold)',
      toolErase: 'Erase',
      toolPlaceText: 'Place Text',
      toggleSimulation: 'Start/Stop Simulation',
      cancel: 'Cancel'
    } satisfies Record<ShortcutActionEnum, string>,
    groups: {
      fileOps: 'File',
      editOps: 'Edit',
      viewOps: 'View',
      tools: 'Tools',
      interaction: 'Interaction'
    },
    manager: {
      resetAll: 'Reset All',
      reset: 'Reset',
      unassign: 'Unassign',
      edit: 'Edit Shortcut',
      cancelRecording: 'Cancel Recording',
      recordPrompt: 'Press keys…'
    },
    toast: {
      reassignedFrom: 'Shortcut unassigned from “{{action}}”',
      loadFailed: 'Could not load your shortcuts, so the defaults are used.'
    }
  },
  onboarding: {
    settings: {
      showTips: 'Show onboarding tips'
    },
    menu: {
      showTipsAgain: 'Show Tips Again'
    },
    nudge: {
      text: 'New here? Build your first circuit in a quick tutorial.',
      start: 'Start tutorial',
      dismiss: 'Dismiss'
    },
    toast: {
      tipsReset: 'Onboarding tips are back on.'
    },
    bubble: {
      next: 'Next',
      finish: 'Finish',
      skip: 'Skip tutorial',
      turnOff: 'Turn off all tips'
    },
    hints: {
      dismiss: 'Dismiss',
      wireTapActions:
        'Drag to draw wires. <strong>Tap a port</strong> to add or remove a negation bubble, or tap a crossing to connect or split wires.',
      scissorSelectDesktop:
        '<strong>Cut wires</strong> cuts every wire at the edge of the selection box. Hold <strong>Alt</strong> while dragging a box to turn it on.',
      scissorSelectCompact:
        '<strong>Cut wires</strong> cuts every wire at the edge of the selection box.',
      eraser: 'Drag across anything to delete it.',
      simControls:
        'Editing is locked while the simulation runs. These buttons pause it, step it and set its speed. Switches and buttons on the board still respond.',
      selectionActions:
        'Rotate the selection with these buttons or with <strong>R</strong> and <strong>Shift+R</strong>. The arrow keys move it.',
      pastePlacementDesktop:
        'Pasted items float over the board until you drop them. Drag them to a free spot and release, or press Esc to cancel.',
      pastePlacementCompact:
        'Pasted items float over the board until you drop them. Drag them to a free spot and lift your finger, or tap elsewhere to cancel.',
      portsPanelDesktop:
        "This component's plugs live here: place <strong>Input</strong> and <strong>Output</strong> from this panel, then drag the rows to set the port order and type to name them.",
      portsPanelCompact:
        "This component's plugs live here: place <strong>Input</strong> and <strong>Output</strong> from this panel, then drag the rows to set the port order and type to name them.",
      panZoomCompact:
        'Drag with two fingers to pan, pinch to zoom. One finger pans only in pan mode.'
    },
    tutorials: {
      gettingStarted: {
        steps: {
          welcome: {
            title: 'Welcome to Logigator',
            text: "Let's build a working circuit in about a minute. You can skip anytime."
          },
          moveAround: {
            title: 'Move around',
            textDesktop:
              'Scroll to zoom, drag with the right or middle button to pan.',
            textCompact: 'Pinch to zoom, drag with two fingers to pan.'
          },
          placeAnd: {
            title: 'Place an AND gate',
            textDesktop:
              'Find <strong>AND</strong> in the component list on the left, then click the canvas to drop it.',
            textCompact:
              'Tap <strong>+</strong> to open your building blocks, pick <strong>AND</strong>, then tap the canvas to drop it.',
            nudge:
              'That is not an AND gate. Pick <strong>AND</strong> for this step. The eraser removes the other part.'
          },
          addSwitches: {
            title: 'Add two switches',
            textDesktop:
              'Now place two <strong>switch</strong> inputs to the left of the gate. ({{placed}} of {{total}} placed)',
            textCompact:
              'Tap <strong>+</strong>, pick a <strong>switch</strong>, then tap the canvas to the left of the gate. Place two. ({{placed}} of {{total}} placed)'
          },
          addLed: {
            title: 'Add an LED',
            textDesktop:
              "Place an <strong>LED</strong> to the right of the gate. It shows the gate's output.",
            textCompact:
              "Tap <strong>+</strong>, pick the <strong>LED</strong>, then tap to the right of the gate. It shows the gate's output."
          },
          wireUp: {
            title: 'Wire it up',
            text: "Switch to the <strong>wire tool</strong> and drag from each switch to the gate's inputs, then from the gate's output to the LED."
          },
          startSim: {
            title: 'Start the simulation',
            text: 'Press <strong>Start</strong> to run your circuit. Editing is locked while it runs.'
          },
          flipSwitch: {
            title: 'Flip a switch',
            textDesktop:
              'Click a switch to toggle it. Turn <strong>both</strong> on and watch the LED light up.',
            textCompact:
              'Tap a switch to toggle it. Turn <strong>both</strong> on and watch the LED light up.'
          },
          complete: {
            title: 'Your circuit works',
            textDesktop:
              'The LED is on only while both switches are on: an AND gate outputs HIGH only when every input is HIGH.<br><br>To take this tutorial again, choose “Show Tips Again” in the <strong>Help</strong> menu. The documentation is in the same menu.',
            textCompact:
              'The LED is on only while both switches are on: an AND gate outputs HIGH only when every input is HIGH.<br><br>To take this tutorial again, choose “Show Tips Again” in the <strong>menu</strong>. The documentation is in the same menu.'
          }
        }
      }
    }
  }
  // `as const` keeps every message a literal type, which is what lets
  // `TranslateArgs` read a key's `{{placeholder}}` names. The other locales are
  // annotated with the leaf-widened `TranslationSchema`, so only English needs it.
} as const;

export default en;
