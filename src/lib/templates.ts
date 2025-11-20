export interface CodebaseTemplate {
  id: string;
  name: string;
  extensions: string[];
  ignores: string[];
  iconUrl: string;
  triggers: string[];
}

export const templates: CodebaseTemplate[] = [
  {
    id: "typescript",
    name: "TypeScript",
    extensions: [".ts", ".tsx", ".d.ts", ".mts", ".cts"],
    ignores: [
      "*.tsbuildinfo",
      "dist/",
      "build/",
      ".tsc/",
      "out/",
      "package-lock.json", // <--- ADDED
      "yarn.lock",         // <--- ADDED
      "pnpm-lock.yaml",    // <--- ADDED
      "bun.lockb"          // <--- ADDED
    ],
    iconUrl:
      "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/typescript.svg",
    triggers: ["tsconfig.json", "package.json"],
  },
  {
    id: "python",
    name: "Python",
    extensions: [
      ".py",
      ".pyc",
      ".pyo",
      ".pyd",
      ".pyw",
      ".pyz",
      ".pyi",
      ".pyx",
    ],
    ignores: [
      "__pycache__/",
      "*.py[cod]",
      "*$py.class",
      "*.so",
      ".Python",
      "env/",
      "venv/",
      ".venv",
      "build/",
      "develop-eggs/",
      "dist/",
      "downloads/",
      "eggs/",
      ".eggs/",
      "lib/",
      "lib64/",
      "parts/",
      "sdist/",
      "var/",
      "wheels/",
      "*.egg-info/",
      ".installed.cfg",
      "*.egg",
      "pip-log.txt",
      "pip-delete-this-directory.txt",
      ".pytest_cache/",
      ".coverage",
    ],
    iconUrl:
      "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/python.svg",
    triggers: ["requirements.txt", "setup.py", "pyproject.toml"],
  },
  {
    id: "javascript",
    name: "JavaScript",
    extensions: [".js", ".cjs", ".mjs", ".jsx", ".jsm", ".jsonc"],
    ignores: [
      "node_modules/",
      "npm-debug.log*",
      "yarn-debug.log*",
      "yarn-error.log*",
      "package-lock.json",
      "yarn.lock",
      "pnpm-lock.yaml",
      ".env",
      ".env.local",
      "dist/",
      "build/",
    ],
    iconUrl:
      "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/javascript.svg",
    triggers: ["package.json", ".npmrc"],
  },
  {
    id: "html-css",
    name: "HTML/CSS",
    extensions: [
      ".html",
      ".htm",
      ".xhtml",
      ".css",
      ".scss",
      ".sass",
      ".less",
      ".postcss",
    ],
    ignores: [
      ".cache/",
      ".parcel-cache/",
      "*.css.map",
      "*.sass.map",
      "*.scss.map",
      "dist/",
    ],
    iconUrl:
      "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/html5.svg",
    triggers: ["index.html", "style.css"],
  },
  {
    id: "sql",
    name: "SQL",
    extensions: [".sql", ".psql", ".hql", ".ddl", ".dml"],
    ignores: [
      "*.db",
      "*.sqlite",
      "*.sqlite3",
      "*.mdb",
      "*.accdb",
      "*.sqlitedb",
    ],
    iconUrl: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/mysql.svg",
    triggers: ["schema.sql", "migrations/"],
  },
  {
    id: "java",
    name: "Java",
    extensions: [
      ".java",
      ".class",
      ".jar",
      ".war",
      ".ear",
      ".jvm",
      ".gradle",
      ".maven",
    ],
    ignores: [
      "target/",
      "*.class",
      "*.jar",
      "*.war",
      "*.ear",
      ".gradle/",
      "build/",
      ".idea/",
      "*.iml",
      "out/",
      "*.log",
    ],
    iconUrl: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/java.svg",
    triggers: ["pom.xml", "build.gradle"],
  },
  {
    id: "csharp",
    name: "C#",
    extensions: [".cs", ".csproj", ".sln", ".cshtml", ".csx", ".cake", ".razor"],
    ignores: [
      "bin/",
      "obj/",
      "*.suo",
      "*.user",
      ".vs/",
      ".vscode/",
      "*.userprefs",
      "packages/",
      "*.nupkg",
      "project.lock.json",
    ],
    iconUrl:
      "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/csharp.svg",
    triggers: ["*.csproj", "*.sln"],
  },
  {
    id: "cpp",
    name: "C++",
    extensions: [
      ".cpp",
      ".cc",
      ".cxx",
      ".c++",
      ".h",
      ".hpp",
      ".hh",
      ".hxx",
      ".inl",
      ".ipp",
      ".tcc",
    ],
    ignores: [
      "*.o",
      "*.obj",
      "*.exe",
      "*.out",
      "*.app",
      "*.a",
      "*.so",
      "*.dylib",
      "Debug/",
      "Release/",
      "x64/",
      "x86/",
      "CMakeFiles/",
      "CMakeCache.txt",
      "cmake_install.cmake",
      "Makefile",
    ],
    iconUrl:
      "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/cplusplus.svg",
    triggers: ["CMakeLists.txt", "*.vcxproj"],
  },
  {
    id: "go",
    name: "Go",
    extensions: [".go", ".mod", ".sum"],
    ignores: [
      "*.exe",
      "*.dll",
      "*.so",
      "*.dylib",
      "vendor/",
      "*.test",
      "dist/",
      "bin/",
    ],
    iconUrl: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/go.svg",
    triggers: ["go.mod", "go.sum"],
  },
  {
    id: "rust",
    name: "Rust",
    extensions: [".rs", ".rlib", ".rmeta"],
    ignores: ["target/", "Cargo.lock", "*.pdb", "dist/", "*.swp"],
    iconUrl: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/rust.svg",
    triggers: ["Cargo.toml", "Cargo.lock"],
  },
  {
    id: "php",
    name: "PHP",
    extensions: [
      ".php",
      ".php3",
      ".php4",
      ".php5",
      ".phtml",
      ".phps",
      ".phar",
    ],
    ignores: [
      "/vendor/",
      "composer.lock",
      ".env",
      ".phpunit.result.cache",
      "node_modules/",
    ],
    iconUrl: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/php.svg",
    triggers: ["composer.json", "composer.lock"],
  },
  {
    id: "kotlin",
    name: "Kotlin",
    extensions: [".kt", ".kts", ".ktm", ".gradle"],
    ignores: ["*.class", "build/", ".idea/", "*.iml", "out/", ".gradle/"],
    iconUrl:
      "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/kotlin.svg",
    triggers: ["build.gradle.kts", "pom.xml"],
  },
  {
    id: "swift",
    name: "Swift",
    extensions: [".swift", ".swifttemplate", ".xcodeproj"],
    ignores: [
      "xcuserdata/",
      "*.xcuserstate",
      "build/",
      "*.ipa",
      ".build/",
      ".swiftpm/",
    ],
    iconUrl: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/swift.svg",
    triggers: ["Package.swift", "*.xcodeproj"],
  },
  {
    id: "ruby",
    name: "Ruby",
    extensions: [".rb", ".rbw", ".rake", ".gemspec", ".erb"],
    ignores: [
      "*.gem",
      ".bundle",
      "vendor/bundle",
      ".rvmrc",
      ".ruby-version",
      "Gemfile.lock",
      ".byebug_history",
      "tmp/",
    ],
    iconUrl: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/ruby.svg",
    triggers: ["Gemfile", "Gemfile.lock"],
  },
  {
    id: "bash-shell",
    name: "Bash/Shell",
    extensions: [".sh", ".bash", ".zsh", ".fish", ".ksh", ".csh"],
    ignores: ["*.swp", "*.swo", "*~", ".bash_history", ".zsh_history"],
    iconUrl:
      "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/gnubash.svg",
    triggers: ["*.sh"],
  },
  {
    id: "c",
    name: "C",
    extensions: [".c", ".h", ".idc", ".w"],
    ignores: ["*.o", "*.obj", "*.a", "*.exe", "*.out", "*.so", "*.dylib"],
    iconUrl: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/c.svg",
    triggers: ["Makefile", "*.h"],
  },
  {
    id: "r",
    name: "R",
    extensions: [".r", ".R", ".Rmd", ".RData", ".rds", ".Rproj"],
    ignores: [".Rhistory", ".RData", ".Ruserdata", ".Rproj.user/"],
    iconUrl: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/r.svg",
    triggers: [".Rproj", "DESCRIPTION"],
  },
  {
    id: "scala",
    name: "Scala",
    extensions: [".scala", ".sc", ".sbt"],
    ignores: ["target/", ".idea/", "*.class", "*.jar"],
    iconUrl:
      "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/scala.svg",
    triggers: ["build.sbt", "project/"],
  },
  {
    id: "perl",
    name: "Perl",
    extensions: [".pl", ".pm", ".t", ".pod", ".cgi"],
    ignores: ["*.perlcritic", "cover_db/", "*.o", "blib/"],
    iconUrl: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/perl.svg",
    triggers: ["Makefile.PL", "cpanfile"],
  },
  {
    id: "dart",
    name: "Dart",
    extensions: [".dart", ".dill", ".g.dart"],
    ignores: [".dart_tool/", ".pub-cache/", ".pub/", "build/", "*.g.dart"],
    iconUrl: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/dart.svg",
    triggers: ["pubspec.yaml", "pubspec.lock"],
  },
  {
    id: "elixir",
    name: "Elixir",
    extensions: [".ex", ".exs", ".eex", ".leex"],
    ignores: [
      "_build/",
      "deps/",
      ".fetch",
      "erl_crash.dump",
      "*.ez",
      "*.beam",
    ],
    iconUrl:
      "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/elixir.svg",
    triggers: ["mix.exs", "mix.lock"],
  },
  {
    id: "lua",
    name: "Lua",
    extensions: [".lua", ".luac", ".lua5.1", ".rockspec"],
    ignores: ["*.luac", "luac.out"],
    iconUrl: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/lua.svg",
    triggers: ["*.rockspec"],
  },
  {
    id: "assembly",
    name: "Assembly",
    extensions: [".asm", ".s", ".S", ".nasm", ".a51", ".inc", ".obj"],
    ignores: ["*.o", "*.obj", "*.exe", "*.bin", "*.hex"],
    iconUrl:
      "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/assemblyscript.svg",
    triggers: ["Makefile"],
  },
  {
    id: "groovy",
    name: "Groovy",
    extensions: [".groovy", ".gvy", ".gy", ".gsh", ".gradle"],
    ignores: ["*.class", "build/", ".gradle/"],
    iconUrl:
      "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/groovy.svg",
    triggers: ["build.gradle", "Jenkinsfile"],
  },
  {
    id: "vb-net",
    name: "Visual Basic .NET",
    extensions: [".vb", ".vba", ".vbs", ".frm", ".cls"],
    ignores: ["bin/", "obj/", "*.suo", "*.user"],
    iconUrl:
      "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/dotnet.svg",
    triggers: ["*.vbproj", "*.sln"],
  },
  {
    id: "react",
    name: "React",
    extensions: [".js", ".jsx", ".ts", ".tsx"],
    ignores: [
      "node_modules/",
      "build/",
      "dist/",
      ".env",
      ".env.local",
      "npm-debug.log*",
      "yarn-debug.log*",
      "coverage/",
      ".eslintcache",
    ],
    iconUrl: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/react.svg",
    triggers: ["package.json", "*.jsx", "*.tsx"],
  },
  {
    id: "nextjs",
    name: "Next.js",
    extensions: [".js", ".jsx", ".ts", ".tsx"],
    ignores: [
      ".next/",
      "out/",
      "build/",
      "dist/",
      ".vercel",
      "*.tsbuildinfo",
      "node_modules/",
    ],
    iconUrl:
      "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/nextdotjs.svg",
    // ADDED: next.config.mjs, next.config.ts, next.config.cjs
    triggers: ["next.config.js", "next.config.mjs", "next.config.ts", "next.config.cjs", "package.json"],
  },
  {
    id: "django",
    name: "Django",
    extensions: [],
    ignores: [
      "*.log",
      "*.pot",
      "*.pyc",
      "__pycache__/",
      "db.sqlite3",
      "media/",
      "staticfiles/",
      "venv/",
      ".env",
    ],
    iconUrl:
      "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/django.svg",
    triggers: ["manage.py", "wsgi.py"],
  },
  {
    id: "vuejs",
    name: "Vue.js",
    extensions: [".js", ".jsx", ".ts", ".tsx", ".vue"],
    ignores: [
      "node_modules/",
      "/dist",
      "/build",
      ".env",
      ".env.local",
      "npm-debug.log*",
      "yarn-debug.log*",
      ".eslintcache",
    ],
    iconUrl:
      "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/vuedotjs.svg",
    triggers: ["package.json", "*.vue"],
  },
  {
    id: "spring-boot",
    name: "Spring Boot",
    extensions: [".properties", ".yml", ".yaml"],
    ignores: [
      "target/",
      "*.jar",
      "*.war",
      "*.ear",
      ".gradle/",
      "build/",
      "out/",
      ".idea/",
      "*.iml",
      ".classpath",
      ".project",
    ],
    iconUrl:
      "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/springboot.svg",
    triggers: ["pom.xml", "build.gradle", "application.properties"],
  },
  {
    id: "expressjs",
    name: "Express.js",
    extensions: [".js", ".ts"],
    ignores: [
      "node_modules/",
      "npm-debug.log*",
      "yarn-debug.log*",
      "yarn-error.log*",
      ".env",
      ".env.local",
      "dist/",
      "build/",
    ],
    iconUrl:
      "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/express.svg",
    triggers: ["package.json", "server.js", "index.js"],
  },
  {
    id: "angular",
    name: "Angular",
    extensions: [".ts", ".tsx", ".html", ".css"],
    ignores: [
      "dist/",
      ".angular/",
      "node_modules/",
      "npm-debug.log*",
      "yarn-error.log*",
      ".vscode/",
      ".idea/",
      "*.swp",
      "*.swo",
    ],
    iconUrl:
      "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/angular.svg",
    triggers: ["angular.json", "package.json"],
  },
  {
    id: "nuxtjs",
    name: "Nuxt.js",
    extensions: [".js", ".jsx", ".ts", ".tsx", ".vue"],
    ignores: [
      ".nuxt/",
      "dist/",
      "node_modules/",
      "npm-debug.log*",
      "yarn-debug.log*",
      ".env",
      ".env.local",
      ".output/",
    ],
    iconUrl:
      "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/nuxtdotjs.svg",
    triggers: ["nuxt.config.ts", "package.json"],
  },
  {
    id: "remix",
    name: "Remix",
    extensions: [".js", ".jsx", ".ts", ".tsx"],
    ignores: [
      "build/",
      "dist/",
      ".remix",
      "node_modules/",
      "npm-debug.log*",
      ".env",
      ".env.local",
      ".vercel",
    ],
    iconUrl:
      "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/remix.svg",
    triggers: ["remix.config.js", "package.json"],
  },
  {
    id: "sveltekit",
    name: "SvelteKit",
    extensions: [".js", ".ts", ".svelte"],
    ignores: [
      ".svelte-kit/",
      "build/",
      "dist/",
      "node_modules/",
      "npm-debug.log*",
      ".env",
      ".env.local",
      "vite.config.js.timestamp-*",
    ],
    iconUrl:
      "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/svelte.svg",
    triggers: ["svelte.config.js", "package.json"],
  },
  {
    id: "astro",
    name: "Astro",
    extensions: [".js", ".ts", ".astro"],
    ignores: [
      "dist/",
      ".astro/",
      "node_modules/",
      "npm-debug.log*",
      ".env",
      ".env.local",
      ".vercel",
    ],
    iconUrl: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/astro.svg",
    triggers: ["astro.config.mjs", "package.json"],
  },
  {
    id: "qwik",
    name: "Qwik",
    extensions: [".js", ".ts", ".jsx", ".tsx"],
    ignores: [
      "dist/",
      ".qwik/",
      "node_modules/",
      "npm-debug.log*",
      ".env",
      ".env.local",
      ".vercel",
    ],
    iconUrl: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/qwik.svg",
    triggers: ["qwik.config.ts", "package.json"],
  },
  {
    id: "nestjs",
    name: "NestJS",
    extensions: [".ts"],
    ignores: [
      "dist/",
      "node_modules/",
      "npm-debug.log*",
      ".env",
      ".env.local",
      ".vercel",
      "coverage/",
      ".nyc_output/",
    ],
    iconUrl:
      "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/nestjs.svg",
    triggers: ["package.json", "src/main.ts"],
  },
  {
    id: "fastify",
    name: "Fastify",
    extensions: [".js", ".ts"],
    ignores: [
      "dist/",
      "node_modules/",
      "npm-debug.log*",
      ".env",
      ".env.local",
      "coverage/",
      ".nyc_output/",
    ],
    iconUrl:
      "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/fastify.svg",
    triggers: ["package.json", "server.js"],
  },
  {
    id: "koa",
    name: "Koa",
    extensions: [".js", ".ts"],
    ignores: [
      "dist/",
      "node_modules/",
      "npm-debug.log*",
      ".env",
      ".env.local",
      "coverage/",
    ],
    iconUrl: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/koa.svg",
    triggers: ["package.json", "index.js"],
  },
  {
    id: "meteorjs",
    name: "Meteor.js",
    extensions: [".js", ".jsx", ".ts", ".tsx"],
    ignores: [
      "node_modules/",
      ".meteor/local/",
      ".meteor/dev_bundle/",
      "npm-debug.log*",
      ".env",
      ".env.local",
      "dist/",
    ],
    iconUrl:
      "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/meteor.svg",
    triggers: ["package.json", ".meteor/"],
  },
  {
    id: "solidjs",
    name: "SolidJS",
    extensions: [".js", ".ts", ".jsx", ".tsx"],
    ignores: [
      "dist/",
      ".solid/",
      "node_modules/",
      "npm-debug.log*",
      ".env",
      ".env.local",
      "coverage/",
    ],
    iconUrl: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/solid.svg",
    triggers: ["vite.config.ts", "package.json"],
  },
  {
    id: "laravel",
    name: "Laravel",
    extensions: [],
    ignores: [
      "/vendor/",
      "node_modules/",
      "npm-debug.log*",
      "yarn-error.log*",
      ".env",
      ".env.local",
      "storage/",
      "bootstrap/cache/",
      ".vscode/",
      ".idea/",
      "composer.lock",
      "package-lock.json",
    ],
    iconUrl:
      "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/laravel.svg",
    triggers: ["artisan", "composer.json"],
  },
  {
    id: "godot4",
    name: "Godot 4",
    extensions: [".gd", ".gdshader", ".gdscript", ".tscn", ".tres"],
    ignores: [
      ".godot/",
      ".mono/",
      "export/",
      "*.import",
      "*.generated",
      "user_data/",
      ".DS_Store",
      "Thumbs.db",
      "*.log",
      ".cache/",
      "*.swp",
      "*.swo",
      "*~",
    ],
    iconUrl:
      "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/godotengine.svg",
    triggers: ["project.godot", "*.tscn"],
  },
  {
    id: "docker",
    name: "Docker",
    extensions: ["Dockerfile", ".dockerignore", ".yml", ".yaml"],
    ignores: [],
    iconUrl: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/docker.svg",
    triggers: ["Dockerfile", "docker-compose.yml", "docker-compose.yaml", "docker-compose.dev.yml"],
  },
  {
    id: "prisma",
    name: "Prisma",
    extensions: [".prisma"],
    ignores: ["migrations/"],
    iconUrl: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/prisma.svg",
    triggers: ["schema.prisma", "prisma/"],
  },
];

/**
 * Universal .gitignore patterns for all projects
 */
export const universalGitignorePatterns = [
  "# OS Files & Metadata",
  "ehthumbs.db",
  "Desktop.ini",
  ".AppleDouble",
  ".LSOverride",
  "._*",
  ".Spotlight-V100",
  ".Trashes",
  ".TemporaryItems",
  "Thumbs.db.lock",
  ".fseventsd",
  ".fuse_hidden*",
  "",
  "# Package Managers / Lock Files", // <--- ADDED SECTION
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
  "",
  "# Editor Configuration",
  ".sublime-project",
  ".sublime-workspace",
  ".atom/",
  ".nova/",
  ".editorconfig",
  ".c9/",
  "",
  "# Security Files",
  "*.key",
  "*.pem",
  "*.p12",
  "*.pfx",
  "*.jks",
  "*.cert",
  "*.crt",
  "*.der",
  "secrets/",
  "private/",
  "credentials/",
  "",
  "# Temporary & Backup Files",
  "*.bak",
  "*.tmp",
  "*.backup",
  "backup/",
  ".backup/",
  "*.orig",
  "",
  "# Miscellaneous",
  ".directory",
  ".netrc",
  "*.svg",
  "*.mp4",
  "*.mp3",
  "*.jpg",
  "*.png",
];

/**
 * Find a template by ID
 */
export function findTemplateById(id: string): CodebaseTemplate | undefined {
  return templates.find((template) => template.id === id);
}

/**
 * Find a template by name
 */
export function findTemplateByName(
  name: string
): CodebaseTemplate | undefined {
  return templates.find((template) =>
    template.name.toLowerCase().includes(name.toLowerCase())
  );
}

/**
 * Detect templates based on file triggers
 */
export function detectTemplatesByFiles(
  fileNames: string[]
): CodebaseTemplate[] {
  const detectedTemplates = new Set<CodebaseTemplate>();

  for (const template of templates) {
    for (const fileName of fileNames) {
      if (template.triggers.some((trigger) => fileName.includes(trigger))) {
        detectedTemplates.add(template);
        break;
      }
    }
  }

  return Array.from(detectedTemplates);
}

/**
 * Generate combined .gitignore content for multiple templates
 */
export function generateGitignore(templateIds: string[]): string {
  const ignorePatterns = new Set<string>(universalGitignorePatterns);
  const templateNames: string[] = [];

  for (const id of templateIds) {
    const template = findTemplateById(id);
    if (template) {
      templateNames.push(template.name);
      template.ignores.forEach((pattern) => ignorePatterns.add(pattern));
    }
  }

  let gitignore = "";

  if (templateNames.length > 0) {
    gitignore += `# ${templateNames.join(", ")} Configuration\n`;
    gitignore += Array.from(ignorePatterns)
      .filter((pattern) => pattern.trim().length > 0)
      .join("\n");
  }

  return gitignore;
}