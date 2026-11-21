import { defineConfig, globalIgnores } from "eslint/config";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import github from "eslint-plugin-github";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";

export default defineConfig([globalIgnores(["**/dist/", "**/lib/", "**/node_modules/"]), {
    extends: [github.getFlatConfigs().recommended],
    files: ["**/*.ts"],

    plugins: {
        "@typescript-eslint": typescriptEslint,
    },

    ignores: [
        "dist/",
        "lib/",
        "node_modules/",
    ],

    languageOptions: {
        globals: {
            ...globals.node,
        },

        parser: tsParser,
        ecmaVersion: 9,
        sourceType: "module",

        parserOptions: {
            project: "./tsconfig.json",
        },
    },

    rules: {
        camelcase: "off",
        semi: "off",
        "i18n-text/no-en": "off",
    },
}]);
