/* eslint-disable */

module.exports = {
	extends: 'eslint:recommended',
	parserOptions: {
		sourceType: 'script',
		ecmaVersion: 2020
	},
	env: {
		browser: true,
		es6: true
	},
	globals: {
		Bem: 'readonly',
		setBurgerMenuState: 'readonly',
		debounceFunction: "readonly",
		openDynamicPopup: 'readonly'
	},
	rules: {
		'semi': [ 'error', 'always' ],
		'no-unused-vars': [ 'warn', { 'vars': 'local' } ],
		'no-shadow': ['error', { 'hoist': 'functions' }],
		'no-use-before-define': ['error', { 'functions': false, 'classes': false }],
		'no-var': [ 'error' ],
		'quotes': ['error', 'single'],
		'no-unneeded-ternary': 'warn',
		'no-redeclare': ['error', { 'builtinGlobals': false }]
	}
}
