import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import globals from "globals";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // no-undef sur les fichiers JavaScript uniquement.
    //
    // Ajouté après une panne de production : un appel à useLayoutEffect avait
    // survécu à la relecture, à ESLint et au build parce que l'import ne
    // l'accompagnait pas. Next ne vérifie pas les types des .jsx et la
    // configuration Next laisse no-undef éteint, si bien qu'un identifiant
    // inexistant se compilait sans un mot pour finir en ReferenceError chez le
    // visiteur, la page entière remplacée par la frontière d'erreur.
    //
    // Volontairement hors des .ts et .tsx : TypeScript fait déjà ce travail, et
    // no-undef y produit de faux positifs sur les noms de types.
    files: ["**/*.{js,jsx,mjs,cjs}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        React: "readonly",
        // Chargé par balise script depuis Google Maps, jamais importé.
        google: "readonly",
      },
    },
    rules: {
      "no-undef": "error",
    },
  },
]);

export default eslintConfig;
