module.exports = [
  [
    80236,
    (a, b, c) => {
      b.exports = a.r(18622);
    },
    36571,
    (a, b, c) => {
      b.exports = a.r(80236).vendored["react-rsc"].ReactJsxRuntime;
    },
    73535,
    (a) => {
      var b = a.i(36571),
        c = a.i(63080);
      let d = {
        className: c.default.className,
        style: { fontFamily: "'Geist', 'Geist Fallback'", fontStyle: "normal" },
      };
      (null != c.default.variable && (d.variable = c.default.variable),
        a.s(
          [
            "default",
            0,
            function ({ children: a }) {
              return (0, b.jsx)("html", {
                lang: "en",
                className: `${d.variable} h-full antialiased`,
                children: (0, b.jsx)("body", {
                  className: "flex min-h-full flex-col",
                  children: a,
                }),
              });
            },
            "metadata",
            0,
            {
              title: "WorkBot",
              description:
                "An AI assistant and workflow engine for operations, finance and support teams.",
            },
          ],
          73535,
        ));
    },
  ],
  18622,
  (a, b, c) => {
    b.exports = a.x(
      "next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",
      () =>
        require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"),
    );
  },
  63080,
  (a) => {
    a.v({ className: "wMpiTW_className", variable: "wMpiTW_variable" });
  },
  80546,
  function (a) {
    a.n(a.i(73535));
  },
];

//# sourceMappingURL=%5Broot-of-the-server%5D__1apuk87wlpw9u._.js.map
