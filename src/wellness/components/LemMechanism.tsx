export function LemMechanism() {
  return (
    <section id="lem-mechanism" data-wellness-section="lem-mechanism" aria-labelledby="mechanism-title" className="rounded-xl bg-gradient-to-br from-[#FFE14D]/20 to-[#FF1493]/10 p-6 sm:p-8">
      <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#ad1463]">A closer look at the mechanism</p>
      <h2 id="mechanism-title" className="mb-4 text-3xl font-bold text-gray-900">How Lem's Air Pulse Technology Works</h2>
      <p className="mb-6 leading-relaxed text-gray-700">Lem creates rhythmic changes in air pressure at its opening. Its rim rests around the external area, while the air pulses provide the sensation. This differs from the vibrating surface of a direct-contact massager.</p>
      <div className="grid items-center gap-6 sm:grid-cols-2">
        <figure className="overflow-hidden rounded-xl bg-white">
          <img src="/unlock/PDP-2.jpg" alt="Lem held above fresh lemons, showing the small air-pulse opening at one end" width="500" height="500" loading="lazy" className="aspect-square w-full object-cover" />
          <figcaption className="p-4 text-sm text-gray-600">The opening is the part that delivers the air pulses. Photo: Hello Nancy.</figcaption>
        </figure>
        <ol className="space-y-5">
          {[
            ["Get to know the opening", "Read the supplied guide for placement. The rim makes contact with the skin around the area being stimulated."],
            ["Begin with a low setting", "Use the controls to explore the adjustable air-pulse settings gradually."],
            ["Let comfort guide you", "Adjust the position or intensity to your preferences. Stop if anything feels uncomfortable."],
          ].map(([title, description], index) => (
            <li key={title} className="flex gap-3">
              <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white font-bold text-[#ad1463]">{index + 1}</span>
              <div><h3 className="mb-1 font-bold text-gray-900">{title}</h3><p className="text-sm leading-relaxed text-gray-700">{description}</p></div>
            </li>
          ))}
        </ol>
      </div>
      <p className="mt-6 rounded-lg bg-white/80 p-4 text-sm leading-relaxed text-gray-700">Comfort and sensation vary from person to person. Follow the supplied user guide for placement, cleaning, and charging.</p>
      <a href="https://hellonancy.com/products/lem" data-wellness-cta="mechanism" className="mt-5 inline-block font-semibold text-[#ad1463] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4">Explore Lem's settings and product details</a>
    </section>
  );
}
