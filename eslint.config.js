import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
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
    files: ['client/**/*.{tsx,jsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      ...reactHooks.configs.recommended.rules,
    },
  },

  {
    ignores: ['**/dist/**', '**/build/**', '**/node_modules/**', '**/coverage/**'],
  },
];
