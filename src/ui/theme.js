export const themes = {
  vscodeDark: {
    id: "vscodeDark",
    name: "VS Code Dark+",
    description: "深灰编辑器底色，青蓝与暖橙点缀，整体清晰利落。",
    css: {
      "--bg": "#1e1e1e",
      "--panel": "#252526",
      "--panel-2": "#2d2d30",
      "--line": "#3e3e42",
      "--text": "#d4d4d4",
      "--muted": "#9cdcfe",
      "--accent": "#4ec9b0",
      "--danger": "#f44747",
      "--gold": "#dcdcaa",
      "--shadow": "rgba(0, 0, 0, .38)",
      "--board-shell": "#181818",
      "--key-bg": "#1b1b1b",
      "--touch-bg": "#2d2d30",
      "--overlay-bg": "rgba(30, 30, 30, .82)",
      "--grid-a": "rgba(86, 156, 214, .055)",
      "--grid-b": "rgba(212, 212, 212, .028)",
      "--glow-a": "rgba(78, 201, 176, .20)",
      "--glow-b": "rgba(206, 145, 120, .16)"
    },
    colors: {
      I: "#9cdcfe",
      O: "#dcdcaa",
      T: "#c586c0",
      S: "#4ec9b0",
      Z: "#f44747",
      J: "#569cd6",
      L: "#ce9178"
    },
    boardBackground: "#1b1b1b",
    previewBackground: "#1e1e1e",
    gridColor: "rgba(212,212,212,.06)",
    ghostAlpha: 0.22
  },
  githubDark: {
    id: "githubDark",
    name: "GitHub Dark",
    description: "冷黑蓝灰底色，边界清楚，蓝色强调干净醒目。",
    css: {
      "--bg": "#0d1117",
      "--panel": "#161b22",
      "--panel-2": "#21262d",
      "--line": "#30363d",
      "--text": "#e6edf3",
      "--muted": "#8b949e",
      "--accent": "#2f81f7",
      "--danger": "#f85149",
      "--gold": "#d29922",
      "--shadow": "rgba(1, 4, 9, .45)",
      "--board-shell": "#010409",
      "--key-bg": "#0d1117",
      "--touch-bg": "#21262d",
      "--overlay-bg": "rgba(13, 17, 23, .84)",
      "--grid-a": "rgba(47, 129, 247, .055)",
      "--grid-b": "rgba(230, 237, 243, .026)",
      "--glow-a": "rgba(47, 129, 247, .20)",
      "--glow-b": "rgba(210, 153, 34, .15)"
    },
    colors: {
      I: "#79c0ff",
      O: "#d29922",
      T: "#bc8cff",
      S: "#3fb950",
      Z: "#f85149",
      J: "#58a6ff",
      L: "#ffa657"
    },
    boardBackground: "#010409",
    previewBackground: "#0d1117",
    gridColor: "rgba(139,148,158,.08)",
    ghostAlpha: 0.24
  },
  oneDark: {
    id: "oneDark",
    name: "One Dark Pro",
    description: "灰蓝暗底配柔和色块，整体平衡、沉稳、耐看。",
    css: {
      "--bg": "#282c34",
      "--panel": "#21252b",
      "--panel-2": "#2c313a",
      "--line": "#3b4048",
      "--text": "#abb2bf",
      "--muted": "#7f848e",
      "--accent": "#98c379",
      "--danger": "#e06c75",
      "--gold": "#e5c07b",
      "--shadow": "rgba(0, 0, 0, .34)",
      "--board-shell": "#1f2329",
      "--key-bg": "#1b1f27",
      "--touch-bg": "#353b45",
      "--overlay-bg": "rgba(33, 37, 43, .84)",
      "--grid-a": "rgba(97, 175, 239, .05)",
      "--grid-b": "rgba(171, 178, 191, .026)",
      "--glow-a": "rgba(152, 195, 121, .18)",
      "--glow-b": "rgba(224, 108, 117, .14)"
    },
    colors: {
      I: "#56b6c2",
      O: "#e5c07b",
      T: "#c678dd",
      S: "#98c379",
      Z: "#e06c75",
      J: "#61afef",
      L: "#d19a66"
    },
    boardBackground: "#1f2329",
    previewBackground: "#21252b",
    gridColor: "rgba(171,178,191,.07)",
    ghostAlpha: 0.24
  },
  dracula: {
    id: "dracula",
    name: "Dracula",
    description: "紫黑底色搭配高饱和霓虹色，明亮、鲜明、带一点戏剧感。",
    css: {
      "--bg": "#282a36",
      "--panel": "#343746",
      "--panel-2": "#3b3f51",
      "--line": "#51576d",
      "--text": "#f8f8f2",
      "--muted": "#bd93f9",
      "--accent": "#50fa7b",
      "--danger": "#ff5555",
      "--gold": "#f1fa8c",
      "--shadow": "rgba(0, 0, 0, .36)",
      "--board-shell": "#1f2029",
      "--key-bg": "#20222c",
      "--touch-bg": "#44475a",
      "--overlay-bg": "rgba(40, 42, 54, .84)",
      "--grid-a": "rgba(189, 147, 249, .055)",
      "--grid-b": "rgba(248, 248, 242, .026)",
      "--glow-a": "rgba(80, 250, 123, .18)",
      "--glow-b": "rgba(255, 121, 198, .16)"
    },
    colors: {
      I: "#8be9fd",
      O: "#f1fa8c",
      T: "#bd93f9",
      S: "#50fa7b",
      Z: "#ff5555",
      J: "#6272a4",
      L: "#ffb86c"
    },
    boardBackground: "#20222c",
    previewBackground: "#282a36",
    gridColor: "rgba(248,248,242,.065)",
    ghostAlpha: 0.24
  },
  monokai: {
    id: "monokai",
    name: "Monokai",
    description: "暖黑底色，黄绿、玫红与橙色形成强烈复古对比。",
    css: {
      "--bg": "#272822",
      "--panel": "#303127",
      "--panel-2": "#3a3b30",
      "--line": "#565743",
      "--text": "#f8f8f2",
      "--muted": "#a6e22e",
      "--accent": "#a6e22e",
      "--danger": "#f92672",
      "--gold": "#e6db74",
      "--shadow": "rgba(0, 0, 0, .36)",
      "--board-shell": "#1f201b",
      "--key-bg": "#20211c",
      "--touch-bg": "#3e3d32",
      "--overlay-bg": "rgba(39, 40, 34, .84)",
      "--grid-a": "rgba(166, 226, 46, .048)",
      "--grid-b": "rgba(248, 248, 242, .026)",
      "--glow-a": "rgba(166, 226, 46, .18)",
      "--glow-b": "rgba(249, 38, 114, .16)"
    },
    colors: {
      I: "#66d9ef",
      O: "#e6db74",
      T: "#ae81ff",
      S: "#a6e22e",
      Z: "#f92672",
      J: "#75715e",
      L: "#fd971f"
    },
    boardBackground: "#20211c",
    previewBackground: "#272822",
    gridColor: "rgba(248,248,242,.06)",
    ghostAlpha: 0.23
  },
  solarizedDark: {
    id: "solarizedDark",
    name: "Solarized Dark",
    description: "蓝绿色暗底，低对比色阶，整体安静、克制、带复古终端感。",
    css: {
      "--bg": "#002b36",
      "--panel": "#073642",
      "--panel-2": "#0b3d49",
      "--line": "#28545e",
      "--text": "#eee8d5",
      "--muted": "#93a1a1",
      "--accent": "#2aa198",
      "--danger": "#dc322f",
      "--gold": "#b58900",
      "--shadow": "rgba(0, 20, 26, .42)",
      "--board-shell": "#00212a",
      "--key-bg": "#002b36",
      "--touch-bg": "#164450",
      "--overlay-bg": "rgba(0, 43, 54, .84)",
      "--grid-a": "rgba(42, 161, 152, .048)",
      "--grid-b": "rgba(238, 232, 213, .026)",
      "--glow-a": "rgba(42, 161, 152, .18)",
      "--glow-b": "rgba(181, 137, 0, .14)"
    },
    colors: {
      I: "#2aa198",
      O: "#b58900",
      T: "#6c71c4",
      S: "#859900",
      Z: "#dc322f",
      J: "#268bd2",
      L: "#cb4b16"
    },
    boardBackground: "#00212a",
    previewBackground: "#002b36",
    gridColor: "rgba(147,161,161,.075)",
    ghostAlpha: 0.25
  },
  nord: {
    id: "nord",
    name: "Nord / Arctic",
    description: "冷蓝灰底色，低饱和冰原色块，清冷、安静、秩序感强。",
    css: {
      "--bg": "#2E3440", "--panel": "#3B4252", "--panel-2": "#434C5E", "--line": "#4C566A",
      "--text": "#ECEFF4", "--muted": "#88C0D0", "--accent": "#88C0D0", "--danger": "#BF616A",
      "--gold": "#EBCB8B", "--shadow": "rgba(20, 24, 31, .38)", "--board-shell": "#252B35",
      "--key-bg": "#2B313D", "--touch-bg": "#434C5E", "--overlay-bg": "rgba(46, 52, 64, .84)",
      "--grid-a": "rgba(136, 192, 208, .045)", "--grid-b": "rgba(236, 239, 244, .026)",
      "--glow-a": "rgba(136, 192, 208, .18)", "--glow-b": "rgba(180, 142, 173, .13)"
    },
    colors: { I: "#8FBCBB", O: "#EBCB8B", T: "#B48EAD", S: "#A3BE8C", Z: "#BF616A", J: "#81A1C1", L: "#D08770" },
    boardBackground: "#252B35",
    previewBackground: "#2B313D",
    gridColor: "rgba(236,239,244,.06)",
    ghostAlpha: 0.24
  },
  gruvboxDark: {
    id: "gruvboxDark",
    name: "Gruvbox Dark",
    description: "暖棕黑底色，黄、绿、橙低亮铺开，带老终端的复古温度。",
    css: {
      "--bg": "#282828", "--panel": "#3C3836", "--panel-2": "#423D3A", "--line": "#504945",
      "--text": "#EBDBB2", "--muted": "#B8BB26", "--accent": "#B8BB26", "--danger": "#FB4934",
      "--gold": "#FABD2F", "--shadow": "rgba(0, 0, 0, .36)", "--board-shell": "#202020",
      "--key-bg": "#1D2021", "--touch-bg": "#504945", "--overlay-bg": "rgba(40, 40, 40, .84)",
      "--grid-a": "rgba(184, 187, 38, .045)", "--grid-b": "rgba(235, 219, 178, .024)",
      "--glow-a": "rgba(184, 187, 38, .16)", "--glow-b": "rgba(254, 128, 25, .13)"
    },
    colors: { I: "#83A598", O: "#FABD2F", T: "#D3869B", S: "#B8BB26", Z: "#FB4934", J: "#458588", L: "#FE8019" },
    boardBackground: "#202020",
    previewBackground: "#1D2021",
    gridColor: "rgba(235,219,178,.055)",
    ghostAlpha: 0.23
  },
  catppuccinMocha: {
    id: "catppuccinMocha",
    name: "Catppuccin Mocha",
    description: "深摩卡底色，粉紫与奶油色轻柔点亮，现代、柔和、带甜感。",
    css: {
      "--bg": "#1E1E2E", "--panel": "#313244", "--panel-2": "#363A4F", "--line": "#45475A",
      "--text": "#CDD6F4", "--muted": "#89B4FA", "--accent": "#89B4FA", "--danger": "#F38BA8",
      "--gold": "#F9E2AF", "--shadow": "rgba(0, 0, 0, .34)", "--board-shell": "#181825",
      "--key-bg": "#181825", "--touch-bg": "#45475A", "--overlay-bg": "rgba(30, 30, 46, .84)",
      "--grid-a": "rgba(137, 180, 250, .048)", "--grid-b": "rgba(205, 214, 244, .024)",
      "--glow-a": "rgba(137, 180, 250, .17)", "--glow-b": "rgba(203, 166, 247, .13)"
    },
    colors: { I: "#89DCEB", O: "#F9E2AF", T: "#CBA6F7", S: "#A6E3A1", Z: "#F38BA8", J: "#89B4FA", L: "#FAB387" },
    boardBackground: "#181825",
    previewBackground: "#1E1E2E",
    gridColor: "rgba(205,214,244,.06)",
    ghostAlpha: 0.24
  },
  tokyoNight: {
    id: "tokyoNight",
    name: "Tokyo Night",
    description: "夜色蓝紫底，霓虹蓝与粉紫低亮闪动，像城市夜景。",
    css: {
      "--bg": "#1A1B26", "--panel": "#24283B", "--panel-2": "#2F354D", "--line": "#414868",
      "--text": "#C0CAF5", "--muted": "#7AA2F7", "--accent": "#7AA2F7", "--danger": "#F7768E",
      "--gold": "#E0AF68", "--shadow": "rgba(0, 0, 0, .36)", "--board-shell": "#16161E",
      "--key-bg": "#16161E", "--touch-bg": "#414868", "--overlay-bg": "rgba(26, 27, 38, .84)",
      "--grid-a": "rgba(122, 162, 247, .048)", "--grid-b": "rgba(192, 202, 245, .024)",
      "--glow-a": "rgba(122, 162, 247, .18)", "--glow-b": "rgba(187, 154, 247, .13)"
    },
    colors: { I: "#7DCFFF", O: "#E0AF68", T: "#BB9AF7", S: "#9ECE6A", Z: "#F7768E", J: "#7AA2F7", L: "#FF9E64" },
    boardBackground: "#16161E",
    previewBackground: "#1A1B26",
    gridColor: "rgba(192,202,245,.06)",
    ghostAlpha: 0.24
  },
  everforestDark: {
    id: "everforestDark",
    name: "Everforest Dark",
    description: "深森林灰绿底，苔藓绿与木质暖色交错，自然、温润。",
    css: {
      "--bg": "#2D353B", "--panel": "#343F44", "--panel-2": "#3D484D", "--line": "#475258",
      "--text": "#D3C6AA", "--muted": "#A7C080", "--accent": "#A7C080", "--danger": "#E67E80",
      "--gold": "#DBBC7F", "--shadow": "rgba(0, 0, 0, .34)", "--board-shell": "#252E33",
      "--key-bg": "#252E33", "--touch-bg": "#475258", "--overlay-bg": "rgba(45, 53, 59, .84)",
      "--grid-a": "rgba(167, 192, 128, .045)", "--grid-b": "rgba(211, 198, 170, .024)",
      "--glow-a": "rgba(167, 192, 128, .16)", "--glow-b": "rgba(230, 152, 117, .13)"
    },
    colors: { I: "#7FBBB3", O: "#DBBC7F", T: "#D699B6", S: "#A7C080", Z: "#E67E80", J: "#7FBBB3", L: "#E69875" },
    boardBackground: "#252E33",
    previewBackground: "#2D353B",
    gridColor: "rgba(211,198,170,.055)",
    ghostAlpha: 0.24
  },
  materialOcean: {
    id: "materialOcean",
    name: "Material Ocean",
    description: "深海蓝黑底色，青蓝高光清透，整体冷静、现代。",
    css: {
      "--bg": "#0F111A", "--panel": "#1A1C25", "--panel-2": "#202331", "--line": "#2B2D3A",
      "--text": "#A6ACCD", "--muted": "#89DDFF", "--accent": "#89DDFF", "--danger": "#F07178",
      "--gold": "#FFCB6B", "--shadow": "rgba(0, 0, 0, .42)", "--board-shell": "#090B10",
      "--key-bg": "#090B10", "--touch-bg": "#2B2D3A", "--overlay-bg": "rgba(15, 17, 26, .84)",
      "--grid-a": "rgba(137, 221, 255, .045)", "--grid-b": "rgba(166, 172, 205, .024)",
      "--glow-a": "rgba(137, 221, 255, .16)", "--glow-b": "rgba(199, 146, 234, .12)"
    },
    colors: { I: "#89DDFF", O: "#FFCB6B", T: "#C792EA", S: "#C3E88D", Z: "#F07178", J: "#82AAFF", L: "#F78C6C" },
    boardBackground: "#090B10",
    previewBackground: "#0F111A",
    gridColor: "rgba(166,172,205,.055)",
    ghostAlpha: 0.24
  },
  mistMonoDark: {
    id: "mistMonoDark",
    name: "Mist Mono Dark",
    description: "雾灰暗底，紫、蓝、灰绿在同一冷色带里缓慢过渡。",
    css: {
      "--bg": "#20272B", "--panel": "#2B3337", "--panel-2": "#333D42", "--line": "#3D4A50",
      "--text": "#DFE7E8", "--muted": "#8FB6C0", "--accent": "#9B7AC0", "--danger": "#A77BC4",
      "--gold": "#83AEB6", "--shadow": "rgba(0, 0, 0, .36)", "--board-shell": "#171D21",
      "--key-bg": "#171D21", "--touch-bg": "#3D4A50", "--overlay-bg": "rgba(32, 39, 43, .84)",
      "--grid-a": "rgba(143, 182, 192, .045)", "--grid-b": "rgba(223, 231, 232, .022)",
      "--glow-a": "rgba(155, 122, 192, .16)", "--glow-b": "rgba(108, 155, 175, .13)"
    },
    colors: { I: "#A77BC4", O: "#8580C2", T: "#63789D", S: "#6C9BAF", Z: "#83AEB6", J: "#738786", L: "#8A95B8" },
    boardBackground: "#171D21",
    previewBackground: "#20272B",
    gridColor: "rgba(223,231,232,.052)",
    ghostAlpha: 0.25
  },
  washiPastel: {
    id: "washiPastel",
    name: "Washi Pastel",
    description: "和纸般的浅暖底色，低饱和粉彩色块柔和分明。",
    css: {
      "--bg": "#EDEAE3", "--panel": "#F6F3EC", "--panel-2": "#EFEAE0", "--line": "#D8D1C5",
      "--text": "#4C4A45", "--muted": "#8BA0A1", "--accent": "#A7B493", "--danger": "#C78AA1",
      "--gold": "#E8BF2A", "--shadow": "rgba(99, 86, 70, .18)", "--board-shell": "#E5E0D6",
      "--key-bg": "#F6F3EC", "--touch-bg": "#DED6CA", "--overlay-bg": "rgba(246, 243, 236, .86)",
      "--grid-a": "rgba(76, 74, 69, .04)", "--grid-b": "rgba(76, 74, 69, .024)",
      "--glow-a": "rgba(167, 180, 147, .24)", "--glow-b": "rgba(199, 138, 161, .16)"
    },
    colors: { I: "#86A1C2", O: "#E8BF2A", T: "#9A84BC", S: "#A7B493", Z: "#C78AA1", J: "#7F9FC3", L: "#F0A142" },
    boardBackground: "#E5E0D6",
    previewBackground: "#F6F3EC",
    gridColor: "rgba(76,74,69,.06)",
    ghostAlpha: 0.32
  },
  mutedCraft: {
    id: "mutedCraft",
    name: "Muted Craft",
    description: "手作纸张底色，陶土橙与植物绿交错，朴素、温暖。",
    css: {
      "--bg": "#EEEAE2", "--panel": "#F7F3EA", "--panel-2": "#EAE3D8", "--line": "#D8D0C3",
      "--text": "#514A45", "--muted": "#7FA99D", "--accent": "#8FB1CC", "--danger": "#D97B42",
      "--gold": "#D5B35C", "--shadow": "rgba(95, 78, 62, .18)", "--board-shell": "#E4DDD1",
      "--key-bg": "#F7F3EA", "--touch-bg": "#DED4C7", "--overlay-bg": "rgba(247, 243, 234, .86)",
      "--grid-a": "rgba(81, 74, 69, .04)", "--grid-b": "rgba(81, 74, 69, .024)",
      "--glow-a": "rgba(143, 177, 204, .22)", "--glow-b": "rgba(217, 123, 66, .16)"
    },
    colors: { I: "#8FB1CC", O: "#D5B35C", T: "#9A908E", S: "#A2AA7C", Z: "#D97B42", J: "#7FA99D", L: "#D97B42" },
    boardBackground: "#E4DDD1",
    previewBackground: "#F7F3EA",
    gridColor: "rgba(81,74,69,.06)",
    ghostAlpha: 0.32
  },
  mistMonoLight: {
    id: "mistMonoLight",
    name: "Mist Mono Light",
    description: "雾面浅底，紫、蓝、灰绿轻轻铺开，清淡而冷静。",
    css: {
      "--bg": "#EEF1F0", "--panel": "#F7F8F5", "--panel-2": "#E6EBEA", "--line": "#D7DEDC",
      "--text": "#4B5556", "--muted": "#6F8B91", "--accent": "#84AEB8", "--danger": "#A77BC4",
      "--gold": "#8580C2", "--shadow": "rgba(72, 88, 92, .16)", "--board-shell": "#E6EBEA",
      "--key-bg": "#F7F8F5", "--touch-bg": "#DCE4E3", "--overlay-bg": "rgba(247, 248, 245, .86)",
      "--grid-a": "rgba(75, 85, 86, .04)", "--grid-b": "rgba(75, 85, 86, .024)",
      "--glow-a": "rgba(132, 174, 184, .22)", "--glow-b": "rgba(167, 123, 196, .14)"
    },
    colors: { I: "#A77BC4", O: "#8580C2", T: "#63789D", S: "#6C9BAF", Z: "#83AEB6", J: "#738786", L: "#8A95B8" },
    boardBackground: "#E6EBEA",
    previewBackground: "#F7F8F5",
    gridColor: "rgba(75,85,86,.06)",
    ghostAlpha: 0.32
  },
  macaron: {
    id: "macaron",
    name: "Macaron",
    description: "浅奶油底色，马卡龙粉彩轻快明亮，甜而柔和。",
    css: {
      "--bg": "#FFF3F0", "--panel": "#FFF9F4", "--panel-2": "#F8E8E4", "--line": "#EAD9D2",
      "--text": "#5B5051", "--muted": "#DA93A6", "--accent": "#9ED9D2", "--danger": "#F5A6B8",
      "--gold": "#F8E58C", "--shadow": "rgba(120, 85, 85, .16)", "--board-shell": "#F8E8E4",
      "--key-bg": "#FFF9F4", "--touch-bg": "#F1DCD8", "--overlay-bg": "rgba(255, 249, 244, .86)",
      "--grid-a": "rgba(91, 80, 81, .038)", "--grid-b": "rgba(91, 80, 81, .022)",
      "--glow-a": "rgba(158, 217, 210, .24)", "--glow-b": "rgba(245, 166, 184, .16)"
    },
    colors: { I: "#9ED9E6", O: "#F8E58C", T: "#C6A4E8", S: "#BDE6A8", Z: "#F5A6B8", J: "#A9C8F5", L: "#F7C59F" },
    boardBackground: "#F8E8E4",
    previewBackground: "#FFF9F4",
    gridColor: "rgba(91,80,81,.055)",
    ghostAlpha: 0.32
  },
  morandi: {
    id: "morandi",
    name: "Morandi",
    description: "莫兰迪灰调铺底，低对比色块安静、柔和、克制。",
    css: {
      "--bg": "#D8D1C7", "--panel": "#E7E1D8", "--panel-2": "#D2C9BD", "--line": "#C5BBAE",
      "--text": "#4F4A45", "--muted": "#7B8A83", "--accent": "#9AA89E", "--danger": "#B88986",
      "--gold": "#C7B17A", "--shadow": "rgba(84, 74, 64, .18)", "--board-shell": "#CDC5BA",
      "--key-bg": "#E7E1D8", "--touch-bg": "#CFC5B8", "--overlay-bg": "rgba(231, 225, 216, .86)",
      "--grid-a": "rgba(79, 74, 69, .04)", "--grid-b": "rgba(79, 74, 69, .024)",
      "--glow-a": "rgba(154, 168, 158, .22)", "--glow-b": "rgba(184, 137, 134, .14)"
    },
    colors: { I: "#8EA1A7", O: "#C7B17A", T: "#A18FA8", S: "#9AA89E", Z: "#B88986", J: "#8795A7", L: "#C09A7E" },
    boardBackground: "#CDC5BA",
    previewBackground: "#E7E1D8",
    gridColor: "rgba(79,74,69,.06)",
    ghostAlpha: 0.32
  }
};

const LIGHT_THEME_IDS = new Set([
  "washiPastel",
  "mutedCraft",
  "mistMonoLight",
  "macaron",
  "morandi"
]);

const HIDDEN_THEME_IDS = new Set([
  "vscodeDark",
  "oneDark",
  "dracula",
  "catppuccinMocha",
  "tokyoNight",
  "materialOcean",
  "washiPastel",
  "morandi"
]);

Object.values(themes).forEach(theme => {
  theme.tone = LIGHT_THEME_IDS.has(theme.id) ? "light" : "dark";
});

export const defaultTheme = themes.githubDark;

export function applyCssTheme(theme) {
  Object.entries(theme.css).forEach(([name, value]) => {
    document.documentElement.style.setProperty(name, value);
  });
}

export function getTheme(id) {
  const theme = themes[id];
  if (!theme || HIDDEN_THEME_IDS.has(theme.id)) return defaultTheme;
  return theme;
}

export function listThemes() {
  return Object.values(themes).filter(theme => !HIDDEN_THEME_IDS.has(theme.id));
}
