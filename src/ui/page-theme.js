import { applyCssTheme, defaultTheme, getTheme, listThemes } from "./theme.js";

const THEME_STORAGE_KEY = "medo-theme";
const OLD_THEME_STORAGE_KEY = "todo-theme";

export function initThemeSelector(select) {
  const requestedTheme = new URLSearchParams(window.location.search).get("theme");
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY) || localStorage.getItem(OLD_THEME_STORAGE_KEY);
  const initialTheme = getTheme(requestedTheme || storedTheme || defaultTheme.id);
  const availableThemes = listThemes();

  availableThemes.forEach(theme => {
    const option = document.createElement("option");
    option.value = theme.id;
    option.textContent = theme.name;
    select.append(option);
  });

  function apply(theme) {
    applyCssTheme(theme);
    document.documentElement.dataset.theme = theme.id;
    document.documentElement.dataset.tone = theme.tone;
    select.value = theme.id;
  }

  apply(initialTheme);

  select.addEventListener("change", () => {
    const theme = getTheme(select.value);
    localStorage.setItem(THEME_STORAGE_KEY, theme.id);
    apply(theme);
  });
}
