import reactPlugin from '@eslint-react/eslint-plugin';
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  // base JS
  js.configs.recommended,

  // TypeScript
  ...tseslint.configs.recommended,

  // GLOBAL RULES
  {
    files: ['**/*.{ts,js,tsx,jsx}'],
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
    },
  },

  // SERVER
  {
    files: ['server/**/*.{ts,js}'],
    languageOptions: {
      parser: tseslint.parser,
    },
  },

  // CLIENT (React)
  {
    files: ['client/**/*.{tsx,jsx,ts}'],
    ...reactPlugin.configs['recommended-typescript'],
    languageOptions: {
      parser: tseslint.parser,
    },
  },
  {
    files: ['client/**/*.{tsx,jsx}'],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },

  // SCRIPTS NODE (docs/)
  {
    files: ['docs/**/*.mjs'],
    languageOptions: {
      globals: globals.node,
    },
  },

  {
    ignores: ['**/dist/**', '**/build/**', '**/node_modules/**', '**/coverage/**'],
  },
];
