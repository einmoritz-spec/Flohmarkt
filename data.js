// Default configuration. Used only the first time the app runs on a device
// (i.e. when nothing is found yet in localStorage).
function defaultState() {
  return {
    categories: [
      {
        id: "drucke",
        name: "Drucke",
        columns: 3,
        tiers: [
          { qty: 1, price: 8 },
          { qty: 2, price: 15 },
          { qty: 3, price: 21 }
        ],
        motifs: [
          { id: "d1", name: "Kreis", stock: 3, image: "icons/motive/kreis.jpg" },
          { id: "d2", name: "Kreis Punkte", stock: 3, image: "icons/motive/kreis-punkte.jpg" },
          { id: "d3", name: "Kreis Halb", stock: 3, image: "icons/motive/kreis-halb.jpg" },
          { id: "d4", name: "Kaffeekanne", stock: 3, image: "icons/motive/kaffeekanne.jpg" },
          { id: "d5", name: "Regenbogen", stock: 3, image: "icons/motive/regenbogen-druck.jpg" },
          { id: "d6", name: "Ginkgo", stock: 3, image: "icons/motive/ginkgo-druck.jpg" }
        ]
      },
      {
        id: "karten",
        name: "Karten",
        columns: 3,
        tiers: [
          { qty: 1, price: 6 },
          { qty: 2, price: 11 },
          { qty: 3, price: 15 }
        ],
        motifs: [
          { id: "k1", name: "Ginkgo", stock: 5, image: "icons/motive/ginkgo.jpg" },
          { id: "k2", name: "Regenbogen", stock: 5, image: "icons/motive/regenbogen.jpg" },
          { id: "k3", name: "Capybara", stock: 5, image: "icons/motive/capybara.jpg" }
        ]
      },
      {
        id: "lesezeichen",
        name: "Lesezeichen",
        columns: 1,
        tiers: [
          { qty: 1, price: 4 },
          { qty: 2, price: 7 },
          { qty: 3, price: 10 }
        ],
        motifs: [
          { id: "l1", name: "Fußspuren", stock: 13, image: "icons/motive/fussspuren.jpg" },
          { id: "l2", name: "Naturmotive", stock: 5, image: "icons/motive/naturmotive.jpg" }
        ]
      }
    ],
    // Appearance. The four color fields override the matching CSS variable
    // when set; null means "use the built-in default".
    theme: { paper: null, card: null, ink: null, brass: null },
    // Payment methods offered as quick-tap buttons. "Sonstiges" always
    // stays as a free-text fallback in addition to these.
    paymentMethods: ["Bar", "PayPal"],
    cart: {},          // { categoryId: { motifId: qty } }
    history: [],        // array of sale objects, newest first
    nextSaleId: 1
  };
}
