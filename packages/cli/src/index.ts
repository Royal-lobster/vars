import { defineCommand, runMain } from "citty";

const main = defineCommand({
  meta: {
    name: "vars",
    version: "0.1.0",
    description: "Encrypted, typed, schema-first environment variables",
  },
  subCommands: {
    init: () => import("./commands/init.js").then((m) => m.default),
    add: () => import("./commands/add.js").then((m) => m.default),
    remove: () => import("./commands/remove.js").then((m) => m.default),
    check: () => import("./commands/check.js").then((m) => m.default),
    gen: () => import("./commands/gen.js").then((m) => m.default),
    unlock: () => import("./commands/unlock.js").then((m) => m.default),
    lock: () => import("./commands/lock.js").then((m) => m.default),
    show: () => import("./commands/show.js").then((m) => m.default),
    hide: () => import("./commands/hide.js").then((m) => m.default),
    toggle: () => import("./commands/toggle.js").then((m) => m.default),
    rotate: () => import("./commands/rotate.js").then((m) => m.default),
    push: () => import("./commands/push.js").then((m) => m.default),
    pull: () => import("./commands/pull.js").then((m) => m.default),
    run: () => import("./commands/run.js").then((m) => m.default),
    status: () => import("./commands/status.js").then((m) => m.default),
    diff: () => import("./commands/diff.js").then((m) => m.default),
    doctor: () => import("./commands/doctor.js").then((m) => m.default),
    hook: () => import("./commands/hook.js").then((m) => m.default),
    ls: () => import("./commands/ls.js").then((m) => m.default),
    "export": () => import("./commands/export.js").then((m) => m.default),
    template: () => import("./commands/export.js").then((m) => m.default),
    completions: () => import("./commands/completions.js").then((m) => m.default),
    typecheck: () => import("./commands/typecheck.js").then((m) => m.default),
    coverage: () => import("./commands/coverage.js").then((m) => m.default),
    blame: () => import("./commands/blame.js").then((m) => m.default),
    history: () => import("./commands/history.js").then((m) => m.default),
  },
});

runMain(main);
