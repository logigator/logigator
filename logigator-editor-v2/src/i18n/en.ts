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
    clearConfirm: 'Clear all memory contents?'
  },
  settings: {
    options: {
      fpsCounter: 'FPS Counter',
      showGrid: 'Show Grid'
    }
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
      LEVER: {
        name: 'Lever',
        description:
          'A latching switch. While the simulation is running, clicking it toggles its output between on and off.'
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
    cancelRename: 'Cancel',
    deleteConfirmMessage:
      'Are you sure you want to delete "{{name}}"? This cannot be undone.',
    deleteAccept: 'Delete',
    deleteReject: 'Cancel',
    searchPlaceholder: 'Search projects...',
    searchButton: 'Search',
    noSearchResults: 'No projects found'
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
    signInTooltip: 'Sign in to upload to the cloud',
    dialogHeader: 'Upload to cloud',
    intro:
      '“{{name}}” is moved out of your local library and stored on your account.',
    depsTitle:
      'It embeds these local components as copies, which stay in your local library:',
    public: 'Public',
    publicInfo:
      'Public components are published on your profile and accessible to everyone via a share link. Private components are only visible to you.',
    notLoggedIn: 'You must be logged in to upload components to your account.',
    cancel: 'Cancel',
    upload: 'Upload',
    uploadWithDeps: 'Upload with dependencies',
    withDepsConfirm:
      'This also uploads {{count}} local component(s) to your account with the same visibility. They become separate cloud components. Continue?',
    withDepsAccept: 'Upload all',
    withDepsReject: 'Cancel',
    signInRequired: 'Sign in to upload components to the cloud',
    success: 'Component uploaded to the cloud',
    failure: 'Failed to upload component',
    partialFailure:
      'Component uploaded, but {{failed}} of {{total}} dependencies failed'
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
    debug: 'Debug'
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
