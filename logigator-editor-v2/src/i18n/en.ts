import type { WorkMode } from '../app/work-mode/work-mode.enum';
import type { ShortcutActionEnum } from '../app/shortcuts/shortcut-action.enum';
import type { ComponentCategory } from '../app/components/component-category.enum';

const en = {
  common: {
    save: 'Save',
    cancel: 'Cancel'
  },
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
    copyFailed: 'Could not copy to clipboard.'
  },
  settings: {
    options: {
      fpsCounter: 'FPS Counter',
      showGrid: 'Show Grid',
      showMinimap: 'Show Minimap'
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
          'A NOT gate is a digital logic gate that implements logical negation. It behaves according to the truth table shown at right. A HIGH output (1) results if the inputs are not equal. If the input is LOW (0), then the output will be HIGH (1).'
      },
      AND: {
        name: 'AND Gate',
        description:
          'A AND gate is a digital logic gate that implements logical conjunction. It behaves according to the truth table shown at right. A HIGH output (1) results only if both the inputs to the AND gate are HIGH (1). If neither or only one input to the AND gate is HIGH, a LOW output results.'
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
          'A read-only memory (ROM) is a type of non-volatile memory used in computers and other electronic devices. Data stored in ROM cannot be electronically modified after the manufacture of the memory device.',
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
          'Random access memory. On the rising edge of CLK it reads the addressed word onto the outputs — or, while WE is HIGH, stores the word on the data inputs at the current address instead.',
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
          placeholder: 'Enter text...',
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
          'A momentary push button. While the simulation is running, clicking it emits a single pulse on its output.'
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
    search: 'Search..'
  },
  tabBar: {
    mainProject: 'Main project',
    close: 'Close'
  },
  portsPanel: {
    title: 'Ports',
    badge: 'component',
    inputs: 'Inputs',
    outputs: 'Outputs',
    noInputs: 'No input plugs',
    noOutputs: 'No output plugs'
  },
  statusBar: {
    modes: {
      pan: 'Panning',
      drawWire: 'Placing Wires',
      connWire: 'Connecting Wires',
      sel: 'Selecting Elements',
      selExact: 'Selecting Elements (Cut Wires at Selection)',
      erase: 'Erasing Elements',
      placeComp: 'Placing Components: {{componentName}}',
      negPort: 'Negating Ports',
      simulation: 'Simulating'
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
            label: 'Upload to cloud'
          },
          exportFile: {
            label: 'Export to file'
          },
          generateImage: {
            label: 'Generate image'
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
        label: 'Help'
      }
    },
    discardChanges: {
      header: 'Discard changes?',
      message:
        'The current project has unsaved changes that will be lost. Create a new project anyway?',
      accept: 'Discard',
      reject: 'Cancel'
    }
  },
  openProjectDialog: {
    title: 'Open Project',
    localProjects: 'Local Projects',
    serverProjects: 'Server Projects',
    fromFile: 'From File',
    notLoggedIn: 'Log in to see your server projects',
    close: 'Close',
    loading: 'Loading...',
    uploadPrompt: 'Open a circuit file saved on your device.',
    chooseFile: 'Choose File',
    deleteProject: 'Delete Project',
    renameProject: 'Rename Project',
    uploadProject: 'Upload to cloud',
    cancelRename: 'Cancel',
    deleteConfirmMessage:
      'Are you sure you want to delete "{{name}}"? This cannot be undone.',
    deleteAccept: 'Delete',
    deleteReject: 'Cancel',
    searchPlaceholder: 'Search projects...',
    searchButton: 'Search',
    noSearchResults: 'No projects found',
    errors: {
      listLocal: 'Could not load your local projects.',
      openLocal: 'Could not open the local project.',
      deleteLocal: 'Could not delete the local project.',
      renameLocal: 'Could not rename the local project.',
      listServer: 'Could not load your server projects.',
      openServer: 'Could not open the server project.',
      deleteServer: 'Could not delete the server project.',
      renameServer: 'Could not rename the server project.',
      importFailed: 'Could not import the file: {{detail}}',
      readFailed: 'Could not read the selected file.'
    }
  },
  saveProjectDialog: {
    name: 'Name',
    destination: 'Destination',
    destinationServer: 'Server',
    destinationBrowser: 'Browser',
    notLoggedIn: 'You must be logged in to save projects to the server.',
    public: 'Public',
    publicInfo:
      'Public projects are published on your profile and accessible to everyone via a share link. Private projects are only visible to you.',
    browserWarning:
      'Browser projects are not persisted across devices and may be lost.'
  },
  newComponentDialog: {
    name: 'Name',
    symbol: 'Symbol',
    description: 'Description',
    store: 'Store',
    storeServer: 'Account',
    storeBrowser: 'Browser',
    notLoggedIn: 'You must be logged in to save components to your account.',
    public: 'Public',
    publicInfo:
      'Public components are published on your profile and accessible to everyone via a share link. Private components are only visible to you.',
    browserWarning:
      'Browser components are not persisted across devices and may be lost.',
    create: 'Create'
  },
  uploadComponent: {
    button: 'Upload to cloud',
    signInTooltip: 'Sign in to upload to the cloud'
  },
  uploadDialog: {
    header: 'Upload to cloud',
    introProject:
      '“{{name}}” is moved out of browser storage and stored on your account, so you can reach it from any device.',
    introComponent:
      '“{{name}}” is moved out of your local library and stored on your account, so you can use it from any device.',
    introDraft:
      '“{{name}}” embeds these local components. They will be uploaded to your cloud library alongside it.',
    depsTitle: 'These local components will also be published',
    depsHint:
      'A cloud project can only contain cloud components, so each of these is uploaded to your cloud library first and then referenced.',
    unresolvableWarning:
      '{{count}} embedded component(s) can no longer be published (their library entry is gone) and will remain plain embedded copies.',
    public: 'Public',
    publicInfoProject:
      'Public projects are published on your profile and accessible to everyone via a share link. Private projects are only visible to you.',
    publicInfoComponent:
      'Public components are published on your profile and accessible to everyone via a share link. Private components are only visible to you.',
    notLoggedIn: 'You must be logged in to upload to your account.',
    cancel: 'Cancel',
    upload: 'Upload',
    analyzeFailed: 'Could not read the circuit to prepare the upload.',
    dependencyFailed:
      'Could not upload component “{{name}}”. Nothing further was uploaded — try again.',
    uploadFailed: 'Could not upload “{{name}}” to the cloud.'
  },
  closeTab: {
    header: 'Unsaved changes',
    message: '“{{name}}” has unsaved changes. Save them before closing?',
    promotionWarning:
      'Saving will also publish {{count}} local component(s) to your cloud library.',
    save: 'Save',
    discard: 'Discard',
    cancel: 'Cancel'
  },
  sourceIndicator: {
    cloudTitle: 'Saved in your cloud account',
    localTitle: 'Saved in this browser only',
    draftTitle: 'Not saved yet — save it to the cloud or this browser',
    shareTitle: 'Opened from a share link — read-only'
  },
  toolBar: {
    save: 'Save',
    open: 'Open',
    newComp: 'New Component',
    copy: 'Copy',
    cut: 'Cut',
    paste: 'Paste',
    delete: 'Delete',
    undo: 'Undo',
    redo: 'Redo',
    zoomOut: 'Zoom out',
    zoomIn: 'Zoom in',
    pan: 'Pan',
    parts: 'Parts',
    placeComponent: 'Placing component',
    more: 'More tools',
    placeWires: 'Place wires',
    connWires: 'Connect wires',
    select: 'Select',
    selExact: 'Select exact',
    eraser: 'Eraser',
    text: 'Text',
    negate: 'Negate ports',
    startSim: 'Start simulation',
    exitSim: 'Exit simulation',
    play: 'Run',
    pause: 'Pause',
    step: 'Step',
    stopSim: 'Stop',
    targetSpeed: 'Target speed',
    targetUnit: 'Target speed unit',
    targetMode: 'Limit to target speed',
    syncToFrame: 'Sync to frame',
    measuredHz: '{{hz}}Hz',
    ticks: '{{ticks}} ticks'
  },
  mobile: {
    menu: 'Menu',
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
      'Something went wrong. Some actions may not have completed — see the browser console for details.'
  },
  clipboard: {
    pastePartial:
      'Some elements could not be pasted — their component type is no longer available.'
  },
  persistence: {
    legacyProjectWarning:
      'This project was made with the old editor. Saving here converts it to the new format — reopening it in the old editor afterwards may drop or misrender custom components.',
    projectSaved: 'Project saved.',
    projectSavedBrowser: 'Project saved to browser storage.',
    componentSaved: 'Component saved.',
    componentSavedBrowser: 'Component saved to browser storage.',
    componentUploaded: 'Component uploaded to your cloud library.',
    projectUploaded: 'Project uploaded to your cloud account.',
    projectCreated: 'Project created.',
    projectExported: 'Project exported to file.',
    exportFailed: 'Could not export the project to a file.',
    browserSaveFailed: 'Could not save the project to browser storage.',
    browserComponentSaveFailed:
      'Could not save the component to browser storage.',
    saveFailed: 'Could not save: {{detail}}',
    saveFailedGeneric: 'Could not save the project.',
    createFailed: 'Could not create the project: {{detail}}',
    versionMismatch:
      'This project changed elsewhere — reload before saving again.',
    loadFailed: 'Could not load the project.',
    componentLoadFailed: 'Could not load the component.',
    shareLoadFailed: 'Could not load the shared project.',
    shareAuthRequired: 'Sign in to add this shared project to your account.',
    dumpElementCountChanged:
      'Project Dump element count changed on load — ids and action history were not restored.',
    skippedCustomOne:
      'A custom component could not be loaded — its definition is missing — and was skipped.',
    skippedCustomMany:
      '{{count}} custom components could not be loaded — their definitions are missing — and were skipped.'
  },
  editor: {
    rendererInitFailed:
      'Could not start the graphics renderer. Your browser or GPU may be unsupported.',
    fontLoadFailed: 'Editor fonts failed to load — some labels may look wrong.',
    eraseRestoreFailed: 'Some erased components could not be restored.'
  },
  simulation: {
    workerMessageUnreadable:
      'The simulation worker sent an unreadable message. Simulation stopped.'
  },
  watch: {
    rendererFailed:
      'Could not open the watch view — the renderer failed to start.',
    noInnerCircuit: 'This component has no inner circuit to inspect.'
  },
  componentActions: {
    edit: 'Edit component',
    restore: 'Restore & edit',
    restoreTooltip:
      "This component's library master is gone, but its circuit is embedded. Restore it to your browser library to edit it.",
    restored: 'Component restored to your browser library.',
    restoreFailed: 'Could not restore this component.',
    signInToEdit: 'Sign in to edit',
    signInTooltip:
      'This component lives in your cloud library. Sign in to load and edit it.'
  },
  library: {
    loadFailed: 'Some saved components could not be loaded.'
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
      zoomIn: 'Zoom In',
      zoomOut: 'Zoom Out',
      zoom100: 'Zoom 100%',
      toolPan: 'Pan',
      toolWireDrawing: 'Place Wires',
      toolWireConnection: 'Connect Wires',
      toolSelect: 'Select',
      toolSelectExact: 'Select Exact',
      toolErase: 'Erase',
      toolComponentPlacement: 'Place Component',
      toolPlaceText: 'Place Text',
      toolPortNegation: 'Negate Ports',
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
      recordPrompt: 'Press keys…'
    },
    toast: {
      reassignedFrom: 'Shortcut unassigned from "{{action}}"',
      loadFailed:
        'Could not load configured shortcuts, falling back to defaults.'
    }
  }
};

export default en;
