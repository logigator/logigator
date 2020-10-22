import {EditorActionConfig} from './editor-action-config';
import {EditorAction} from './editor-action';

export const editorActionDefaultConfig: EditorActionConfig[] = [
	{
		action: EditorAction.COPY,
		usableIn: 'editor',
		internal: false,
		shortcut: {
			key_code: 'C',
			ctrl: true
		},
		name: 'EDITOR_ACTIONS.COPY',
		stringName: 'COPY'
	},
	{
		action: EditorAction.PASTE,
		usableIn: 'editor',
		internal: false,
		shortcut: {
			key_code: 'P',
			ctrl: true
		},
		name: 'EDITOR_ACTIONS.PASTE',
		stringName: 'PASTE'
	},
	{
		action: EditorAction.CUT,
		usableIn: 'editor',
		internal: false,
		shortcut: {
			key_code: 'X',
			ctrl: true
		},
		name: 'EDITOR_ACTIONS.CUT',
		stringName: 'CUT'
	},
	{
		action: EditorAction.DELETE,
		usableIn: 'editor',
		internal: false,
		shortcut: {
			key_code: 'Delete'
		},
		name: 'EDITOR_ACTIONS.DELETE',
		stringName: 'DELETE'
	},
	{
		action: EditorAction.UNDO,
		usableIn: 'editor',
		internal: false,
		shortcut: {
			key_code: 'Z',
			ctrl: true
		},
		name: 'EDITOR_ACTIONS.UNDO',
		stringName: 'UNDO'
	},
	{
		action: EditorAction.REDO,
		usableIn: 'editor',
		internal: false,
		shortcut: {
			key_code: 'Y',
			ctrl: true,
		},
		name: 'EDITOR_ACTIONS.REDO',
		stringName: 'REDO'
	},
	{
		action: EditorAction.ZOOM_100,
		usableIn: 'both',
		internal: false,
		shortcut: {
			key_code: '0',
			ctrl: true,
		},
		name: 'EDITOR_ACTIONS.ZOOM_100',
		stringName: 'ZOOM_100'
	},
	{
		action: EditorAction.ZOOM_IN,
		usableIn: 'both',
		internal: false,
		name: 'EDITOR_ACTIONS.ZOOM_IN',
		stringName: 'ZOOM_IN'
	},
	{
		action: EditorAction.ZOOM_OUT,
		usableIn: 'both',
		internal: false,
		name: 'EDITOR_ACTIONS.ZOOM_OUT',
		stringName: 'ZOOM_OUT'
	},
	{
		action: EditorAction.FULLSCREEN,
		usableIn: 'both',
		internal: false,
		shortcut: {
			key_code: 'F',
			ctrl: true,
			shift: true
		},
		name: 'EDITOR_ACTIONS.FULLSCREEN',
		stringName: 'FULLSCREEN'
	},
	{
		action: EditorAction.SWITCH_MODE_CONN_WIRE,
		usableIn: 'editor',
		internal: false,
		shortcut: {
			key_code: 'C'
		},
		name: 'EDITOR_ACTIONS.SWITCH_MODE_CONN_WIRE',
		stringName: 'SWITCH_MODE_CONN_WIRE'
	},
	{
		action: EditorAction.SWITCH_MODE_WIRE,
		usableIn: 'editor',
		internal: false,
		shortcut: {
			key_code: 'W'
		},
		name: 'EDITOR_ACTIONS.SWITCH_MODE_WIRE',
		stringName: 'SWITCH_MODE_WIRE'
	},
	{
		action: EditorAction.SWITCH_MODE_SELECT,
		usableIn: 'editor',
		internal: false,
		shortcut: {
			key_code: 'S'
		},
		name: 'EDITOR_ACTIONS.SWITCH_MODE_SELECT',
		stringName: 'SWITCH_MODE_SELECT'
	},
	{
		action: EditorAction.SWITCH_MODE_ERASER,
		usableIn: 'editor',
		internal: false,
		shortcut: {
			key_code: 'E'
		},
		name: 'EDITOR_ACTIONS.SWITCH_MODE_ERASER',
		stringName: 'SWITCH_MODE_ERASER'
	},
	{
		action: EditorAction.SWITCH_MODE_CUT_SELECT,
		usableIn: 'editor',
		internal: false,
		shortcut: {
			key_code: 'S',
			shift: true
		},
		name: 'EDITOR_ACTIONS.SWITCH_MODE_CUT_SELECT',
		stringName: 'SWITCH_MODE_CUT_SELECT'
	},
	{
		action: EditorAction.SWITCH_MODE_TEXT,
		usableIn: 'editor',
		internal: false,
		shortcut: {
			key_code: 'T'
		},
		name: 'EDITOR_ACTIONS.SWITCH_MODE_TEXT',
		stringName: 'SWITCH_MODE_TEXT'
	},
	{
		action: EditorAction.NEW_COMP,
		usableIn: 'editor',
		internal: false,
		shortcut: {
			key_code: 'N',
			alt: true
		},
		name: 'EDITOR_ACTIONS.NEW_COMP',
		stringName: 'NEW_COMP'
	},
	{
		action: EditorAction.NEW_PROJ,
		usableIn: 'editor',
		internal: false,
		shortcut: {
			key_code: 'N',
			alt: true,
			ctrl: true
		},
		name: 'EDITOR_ACTIONS.NEW_PROJ',
		stringName: 'NEW_PROJ'
	},
	{
		action: EditorAction.OPEN_PROJ,
		usableIn: 'editor',
		internal: false,
		shortcut: {
			key_code: 'O',
			ctrl: true
		},
		name: 'EDITOR_ACTIONS.OPEN_PROJ',
		stringName: 'OPEN_PROJ'
	},
	{
		action: EditorAction.SAVE,
		usableIn: 'editor',
		internal: false,
		shortcut: {
			key_code: 'S',
			ctrl: true
		},
		name: 'EDITOR_ACTIONS.SAVE',
		stringName: 'SAVE'
	},
	{
		action: EditorAction.ENTER_SIM,
		usableIn: 'editor',
		internal: false,
		shortcut: {
			key_code: 'ENTER'
		},
		name: 'EDITOR_ACTIONS.ENTER_SIM',
		stringName: 'ENTER_SIM'
	},
	{
		action: EditorAction.LEAVE_SIM,
		usableIn: 'simulation',
		internal: false,
		shortcut: {
			key_code: 'ESCAPE'
		},
		name: 'EDITOR_ACTIONS.LEAVE_SIM',
		stringName: 'LEAVE_SIM'
	},
	{
		action: EditorAction.SWITCH_MODE_COMPONENT,
		usableIn: 'editor',
		internal: true,
		stringName: 'LEAVE_SIM'
	},
];
