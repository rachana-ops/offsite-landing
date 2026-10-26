const comparisons = [
  {
    feature: "Sensation",
    lem: "Pulses of air pressure around the opening",
    other: "Vibration delivered through surface contact",
  },
  {
    feature: "Shape",
    lem: "Compact, lemon-shaped body with an opening",
    other: "Head shapes, sizes, and grips vary by model",
  },
  {
    feature: "Settings",
    lem: "12 adjustable air-pulse settings",
    other: "Intensity levels and patterns vary by model",
  },
  {
    feature: "Power",
    lem: "Rechargeable design",
    other: "Rechargeable or replaceable batteries, depending on the model",
  },
  {
    feature: "Water resistance",
    lem: "IPX7 rating; follow the supplied care instructions",
    other: "Check the individual model's rating and care instructions",
  },
];

export function ProductComparison() {
  return (
    <section
      id="product-comparison"
      data-wellness-section="product-comparison"
      aria-labelledby="product-comparison-heading"
      className="min-w-0 max-w-full rounded-xl bg-gradient-to-br from-[#FFE14D]/20 to-[#FF1493]/10 p-4 sm:p-8"
    >
      <h2
        id="product-comparison-heading"
        className="mb-4 text-2xl font-bold text-gray-900 sm:text-3xl"
      >
        Air Pulses and Direct Vibration: A Practical Comparison
      </h2>
      <p className="mb-6 leading-relaxed text-gray-700">
        Devices can offer different sensations and designs. Here is how Lem's
        air-pulse mechanism compares with direct-contact vibrating massagers.
        Your preferences are personal.
      </p>

      <p id="product-comparison-scroll-hint" className="mb-3 text-sm text-gray-600 md:sr-only">
        Swipe or scroll to see the full comparison.
        <span className="sr-only"> Keyboard: focus the table and use the arrow keys.</span>
      </p>
      <div
        role="region"
        aria-label="Device feature comparison"
        aria-describedby="product-comparison-scroll-hint"
        tabIndex={0}
        className="max-w-full overflow-x-auto rounded-xl border border-[#FFE14D] bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#B20F64]"
      >
        <table className="w-full min-w-[34rem] border-collapse text-left text-sm leading-relaxed text-gray-700">
          <caption className="border-b border-gray-200 px-4 py-3 text-left font-medium text-gray-900">
            Mechanical and physical features at a glance
          </caption>
          <thead>
            <tr className="bg-gray-50 text-gray-900">
              <th scope="col" className="w-1/4 px-4 py-4 font-semibold">
                Feature
              </th>
              <th scope="col" className="w-[37.5%] bg-[#FFE14D]/30 px-4 py-4 font-semibold">
                Nancy's Lem
              </th>
              <th scope="col" className="w-[37.5%] px-4 py-4 font-semibold">
                Direct-contact vibrating massagers
              </th>
            </tr>
          </thead>
          <tbody>
            {comparisons.map(({ feature, lem, other }) => (
              <tr key={feature} className="border-t border-gray-200">
                <th scope="row" className="px-4 py-4 align-top font-medium text-gray-900">
                  {feature}
                </th>
                <td className="bg-[#FFE14D]/10 px-4 py-4 align-top">{lem}</td>
                <td className="px-4 py-4 align-top">{other}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-gray-600">
        Direct-contact massagers are a broad category. Features depend on the
        specific model, so check its product details before comparing. This table
        describes design differences; experiences vary from person to person.
      </p>
      <a
        href="https://hellonancy.com/products/lem"
        data-wellness-cta="comparison"
        className="mt-6 inline-flex max-w-full items-center justify-center rounded-lg bg-[#FFE14D] px-5 py-3 text-center text-sm font-bold text-gray-900 hover:bg-[#F4D437] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#B20F64]"
      >
        View Lem product details
      </a>
    </section>
  );
}
