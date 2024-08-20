import type { WorkMode } from '../app/work-mode/work-mode.enum';

const en = {
	components: {
		category: {
			basic: 'Basic',
			advanced: 'Advanced'
		},
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
					'A read-only memory (ROM) is a type of non-volatile memory used in computers and other electronic devices. Data stored in ROM cannot be electronically modified after the manufacture of the memory device.'
			}
		}
	},
	sideBar: {
		search: 'Search..'
	},
	statusBar: {
		modes: {
			drawWire: 'Placing Wires',
			connWire: 'Connecting Wires',
			sel: 'Selecting Elements',
			selExact: 'Selecting Elements (Cut Wires at Selection)',
			erase: 'Erasing Elements',
			text: 'Adding Text',
			placeComp: 'Placing Components: {{componentName}}'
		} as Record<WorkMode, string>,
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
				label: 'View'
			},
			help: {
				label: 'Help'
			}
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
		undo: 'Undo',
		redo: 'Redo',
		zoomOut: 'Zoom out',
		zoomIn: 'Zoom in',
		placeWires: 'Place wires',
		connWires: 'Connect wires',
		select: 'Select',
		selExact: 'Select exact',
		eraser: 'Eraser',
		text: 'Text'
	}
};

export default en;
