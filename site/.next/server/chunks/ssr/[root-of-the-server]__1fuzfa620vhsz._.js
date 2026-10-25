module.exports = [
  [
    84614,
    (a, b, c) => {
      b.exports = a.r(80236).vendored["react-rsc"].React;
    },
    45221,
    (a) => {
      let b = { src: a.i(79186).default, width: 48, height: 48 };
      a.s(["default", 0, b]);
    },
    33702,
    (a) => {
      var b = a.i(36571);
      let c = [
        {
          title: "Requests, from intake to done",
          body: "A form any employee can use, a list the team works from, and a status on every request.",
        },
        {
          title: "Policies in one place",
          body: "The company's rules as plain documents, each owned by a team, readable by everyone.",
        },
        {
          title: "One console for the teams",
          body: "Operations, finance and support see their open work, by status and by priority, in one place.",
        },
      ];
      a.s([
        "default",
        0,
        function () {
          return (0, b.jsxs)("main", {
            className:
              "mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-20 px-6 py-24",
            children: [
              (0, b.jsxs)("section", {
                className: "max-w-2xl",
                children: [
                  (0, b.jsx)("p", {
                    className: "text-sm font-medium text-neutral-500",
                    children: "WorkBot",
                  }),
                  (0, b.jsx)("h1", {
                    className:
                      "mt-4 text-5xl font-semibold tracking-tight text-balance",
                    children:
                      "The assistant for the teams that keep a company running",
                  }),
                  (0, b.jsx)("p", {
                    className: "mt-6 text-xl leading-relaxed text-neutral-600",
                    children:
                      "WorkBot takes in the requests that operations, finance and support teams receive, keeps the company's policies where everyone can read them, and gives each team one place to work from.",
                  }),
                ],
              }),
              (0, b.jsx)("section", {
                className:
                  "grid gap-10 border-t border-neutral-200 pt-12 sm:grid-cols-3",
                children: c.map((a) =>
                  (0, b.jsxs)(
                    "div",
                    {
                      children: [
                        (0, b.jsx)("h2", {
                          className: "font-medium",
                          children: a.title,
                        }),
                        (0, b.jsx)("p", {
                          className:
                            "mt-2 text-sm leading-relaxed text-neutral-600",
                          children: a.body,
                        }),
                      ],
                    },
                    a.title,
                  ),
                ),
              }),
            ],
          });
        },
      ]);
    },
  ],
  54799,
  (a, b, c) => {
    b.exports = a.x("crypto", () => require("crypto"));
  },
  70406,
  (a, b, c) => {
    b.exports = a.x("next/dist/compiled/@opentelemetry/api", () =>
      require("next/dist/compiled/@opentelemetry/api"),
    );
  },
  20635,
  (a, b, c) => {
    b.exports = a.x(
      "next/dist/server/app-render/action-async-storage.external.js",
      () =>
        require("next/dist/server/app-render/action-async-storage.external.js"),
    );
  },
  24725,
  (a, b, c) => {
    b.exports = a.x(
      "next/dist/server/app-render/after-task-async-storage.external.js",
      () =>
        require("next/dist/server/app-render/after-task-async-storage.external.js"),
    );
  },
  43285,
  (a, b, c) => {
    b.exports = a.x(
      "next/dist/server/app-render/dynamic-access-async-storage.external.js",
      () =>
        require("next/dist/server/app-render/dynamic-access-async-storage.external.js"),
    );
  },
  56704,
  (a, b, c) => {
    b.exports = a.x(
      "next/dist/server/app-render/work-async-storage.external.js",
      () =>
        require("next/dist/server/app-render/work-async-storage.external.js"),
    );
  },
  32319,
  (a, b, c) => {
    b.exports = a.x(
      "next/dist/server/app-render/work-unit-async-storage.external.js",
      () =>
        require("next/dist/server/app-render/work-unit-async-storage.external.js"),
    );
  },
  59043,
  (a, b, c) => {
    b.exports = a.x("next/dist/server/runtime-reacts.external.js", () =>
      require("next/dist/server/runtime-reacts.external.js"),
    );
  },
  93695,
  (a, b, c) => {
    b.exports = a.x("next/dist/shared/lib/no-fallback-error.external.js", () =>
      require("next/dist/shared/lib/no-fallback-error.external.js"),
    );
  },
  81111,
  (a, b, c) => {
    b.exports = a.x("node:stream", () => require("node:stream"));
  },
  14747,
  (a, b, c) => {
    b.exports = a.x("path", () => require("path"));
  },
  64301,
  (a, b, c) => {
    (() => {
      "use strict";
      var a = {
          86: (a) => {
            ((a.exports = function (a, b) {
              return "string" == typeof a
                ? g(a)
                : "number" == typeof a
                  ? f(a, b)
                  : null;
            }),
              (a.exports.format = f),
              (a.exports.parse = g));
            var b = /\B(?=(\d{3})+(?!\d))/g,
              c = /(?:\.0*|(\.[^0]+)0+)$/,
              d = {
                b: 1,
                kb: 1024,
                mb: 1048576,
                gb: 0x40000000,
                tb: 0x10000000000,
                pb: 0x4000000000000,
              },
              e = /^((-|\+)?(\d+(?:\.\d+)?)) *(kb|mb|gb|tb|pb)$/i;
            function f(a, e) {
              if (!Number.isFinite(a)) return null;
              var f = Math.abs(a),
                g = (e && e.thousandsSeparator) || "",
                h = (e && e.unitSeparator) || "",
                i = e && void 0 !== e.decimalPlaces ? e.decimalPlaces : 2,
                j = !!(e && e.fixedDecimals),
                k = (e && e.unit) || "";
              (k && d[k.toLowerCase()]) ||
                (k =
                  f >= d.pb
                    ? "PB"
                    : f >= d.tb
                      ? "TB"
                      : f >= d.gb
                        ? "GB"
                        : f >= d.mb
                          ? "MB"
                          : f >= d.kb
                            ? "KB"
                            : "B");
              var l = (a / d[k.toLowerCase()]).toFixed(i);
              return (
                j || (l = l.replace(c, "$1")),
                g &&
                  (l = l
                    .split(".")
                    .map(function (a, c) {
                      return 0 === c ? a.replace(b, g) : a;
                    })
                    .join(".")),
                l + h + k
              );
            }
            function g(a) {
              if ("number" == typeof a && !isNaN(a)) return a;
              if ("string" != typeof a) return null;
              var b,
                c = e.exec(a),
                f = "b";
              return (
                c
                  ? ((b = parseFloat(c[1])), (f = c[4].toLowerCase()))
                  : ((b = parseInt(a, 10)), (f = "b")),
                Math.floor(d[f] * b)
              );
            }
          },
        },
        c = {};
      function d(b) {
        var e = c[b];
        if (void 0 !== e) return e.exports;
        var f = (c[b] = { exports: {} }),
          g = !0;
        try {
          (a[b](f, f.exports, d), (g = !1));
        } finally {
          g && delete c[b];
        }
        return f.exports;
      }
      ((d.ab =
        "/ROOT/node_modules/.pnpm/next@16.4.3_@babel+core@7.29.7_@types+node@20.19.43_react-dom@19.3.0_react@19.3.0__react@19.3.0/node_modules/next/dist/compiled/bytes/"),
        (b.exports = d(86)));
    })();
  },
  79186,
  (a) => {
    a.v(
      "/_next/static/media/favicon.117ezoe8m31dk.ico" +
        (globalThis.NEXT_CLIENT_ASSET_SUFFIX || ""),
    );
  },
  66090,
  function (a) {
    a.n(a.i(33702));
  },
];

//# sourceMappingURL=%5Broot-of-the-server%5D__1fuzfa620vhsz._.js.map
