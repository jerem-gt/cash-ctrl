import js from '@eslint/js';
import reactPlugin from '@eslint-react/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import sonarjs from 'eslint-plugin-sonarjs';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  // base JS
  js.configs.recommended,

  // TypeScript (avec type-checking)
  ...tseslint.configs.recommendedTypeChecked,

  // Activer le type-checking pour les fichiers TS
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.config.ts', '*/*.config.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Désactiver les règles typées pour les fichiers JS (postcss, scripts…)
  {
    files: ['**/*.{js,mjs,cjs}'],
    ...tseslint.configs.disableTypeChecked,
  },

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

  // SonarJS
  {
    files: ['**/*.{ts,js,tsx,jsx}'],
    ...sonarjs.configs.recommended,
  },

  // SERVER
  {
    files: ['server/**/*.{ts,js}'],
    languageOptions: {
      globals: globals.node,
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
      'no-console': 'warn',
    },
  },

  // Fichiers de test — assouplissements ciblés
  {
    files: ['**/*.test.{ts,tsx,js}', '**/*.spec.{ts,tsx,js}'],
    rules: {
      'sonarjs/slow-regex': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/unbound-method': 'off',
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
