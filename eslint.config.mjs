import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // L'apostrophe est retirée de la liste : en français elle apparaît dans
      // presque chaque phrase (« l'association », « n'est »), ce qui produisait
      // 291 erreurs sans le moindre effet à l'exécution et noyait les vraies.
      // Les caractères réellement ambigus en JSX restent surveillés.
      "react/no-unescaped-entities": ["error", { forbid: [">", "}", "\""] }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
