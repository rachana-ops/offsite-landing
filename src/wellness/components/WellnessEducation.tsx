const sourceLink = "font-medium text-[#ad1463] underline decoration-[#ad1463]/40 underline-offset-4 hover:decoration-[#ad1463] focus-visible:outline-2 focus-visible:outline-offset-4";

export function GuideNavigation() {
  return (
    <nav aria-label="In this guide" className="rounded-xl border border-gray-200 bg-gray-50 p-5 sm:p-6">
      <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">In this guide</p>
      <ol className="grid gap-3 text-sm font-medium sm:grid-cols-2">
        {[
          ["menopause-facts", "01", "What changes during menopause"],
          ["understanding-anatomy", "02", "A closer look at your anatomy"],
          ["lem-mechanism", "03", "How Lem's air pulses work"],
          ["product-comparison", "04", "Compare the design details"],
        ].map(([id, number, label]) => (
          <li key={id}>
            <a href={`#${id}`} className="flex items-start gap-3 rounded-md p-1 text-gray-800 underline-offset-4 hover:text-[#ad1463] hover:underline focus-visible:outline-2 focus-visible:outline-offset-4">
              <span aria-hidden="true" className="text-[#ad1463]">{number}</span>
              {label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function MenopauseEducation() {
  return (
    <section id="menopause-facts" data-wellness-section="menopause-facts" aria-labelledby="menopause-facts-title" className="rounded-xl bg-gray-50 p-6 sm:p-8">
      <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#ad1463]">Understanding the changes</p>
      <h2 id="menopause-facts-title" className="mb-4 text-3xl font-bold text-gray-900">The Talk Nobody Warned Us About</h2>
      <p className="mb-5 leading-relaxed text-gray-700">
        Hot flashes get plenty of attention. Changes in intimate comfort deserve a conversation, too.
      </p>
      <div className="space-y-4">
        <div className="rounded-lg border-l-4 border-[#FF1493] bg-white p-5">
          <h3 className="mb-2 text-lg font-bold text-gray-900">Hormones and tissue changes</h3>
          <p className="leading-relaxed text-gray-700">
            Lower estrogen during menopause can leave vaginal tissue drier, thinner, and less elastic. Dryness, irritation, and some urinary symptoms can be part of genitourinary syndrome of menopause, or GSM. <a className={sourceLink} href="https://menopause.org/patient-education/menopause-topics/symptoms" target="_blank" rel="noopener noreferrer" aria-label="Source 1: The Menopause Society, Menopause Symptoms (opens in a new tab)">[1]</a>
          </p>
        </div>
        <div className="rounded-lg border-l-4 border-[#FFE14D] bg-white p-5">
          <h3 className="mb-2 text-lg font-bold text-gray-900">Your experience is your own</h3>
          <p className="leading-relaxed text-gray-700">
            Symptoms vary. Some people notice changes that affect daily life, while others have few symptoms. There is no single experience you are supposed to have. <a className={sourceLink} href="https://www.nhs.uk/conditions/menopause-and-perimenopause/symptoms/" target="_blank" rel="noopener noreferrer" aria-label="Source 2: NHS, Symptoms of menopause and perimenopause (opens in a new tab)">[2]</a>
          </p>
        </div>
      </div>
      <p className="mt-5 leading-relaxed text-gray-700">
        You do not have to put up with ongoing discomfort. If symptoms concern you or affect your day, a qualified healthcare professional can help you explore care options. <a className={sourceLink} href="https://www.nhs.uk/conditions/menopause-and-perimenopause/symptoms/" target="_blank" rel="noopener noreferrer" aria-label="NHS advice on when to seek help for menopause symptoms (opens in a new tab)">[2]</a>
      </p>
      <p className="mt-4 text-sm leading-relaxed text-gray-600">Lem is an optional personal wellness accessory, not a medical treatment or a substitute for professional care.</p>
    </section>
  );
}

export function AnatomyEducation() {
  return (
    <section id="understanding-anatomy" data-wellness-section="understanding-anatomy" aria-labelledby="anatomy-title">
      <h2 id="anatomy-title" className="mb-4 text-3xl font-bold text-gray-900">Let's Talk Anatomy: More Than Meets the Eye</h2>
      <p className="mb-6 leading-relaxed text-gray-700">
        The visible tip of the clitoris is called the glans. The organ also extends inside the body, beyond what is visible externally. Knowing the basic anatomy can make conversations about your body a little easier. <a className={sourceLink} href="https://www.acog.org/womens-health/faqs/vulvovaginal-health" target="_blank" rel="noopener noreferrer" aria-label="Source 3: ACOG, Vulvovaginal Health (opens in a new tab)">[3]</a>
      </p>
      <figure className="overflow-hidden rounded-xl border border-[#FF1493]/15 bg-white">
        <div className="bg-gradient-to-br from-[#FF1493]/5 to-[#FFE14D]/10 p-4 sm:p-8">
          <img src="/unlock/assets/clitoris-anatomy-labeled.svg" alt="Labeled educational diagram showing the glans, body, and crura of the clitoris, vestibular bulbs, and the nearby urethral and vaginal openings" width="600" height="600" loading="lazy" className="mx-auto w-full max-w-lg rounded-lg bg-white p-3 sm:p-5" />
        </div>
        <figcaption className="p-4 text-sm leading-relaxed text-gray-600 sm:px-6">
          <a className={sourceLink} href="/unlock/assets/clitoris-anatomy-labeled.svg" target="_blank" rel="noopener noreferrer">Open the full-size diagram<span className="sr-only"> (opens in a new tab)</span></a>. Simplified illustration; bodies vary. Public-domain illustration by Amphis, Marnanel, and Xeror, via <a className={sourceLink} href="https://commons.wikimedia.org/wiki/File:Clitoris_Anatomy.svg" target="_blank" rel="noopener noreferrer">Wikimedia Commons<span className="sr-only"> (opens in a new tab)</span></a>.
        </figcaption>
      </figure>
      <div className="mt-6 rounded-xl border border-[#FF1493]/15 bg-[#FF1493]/5 p-6 sm:p-8">
        <h3 className="mb-3 text-xl font-bold text-gray-900">Start with understanding, then your own preferences</h3>
        <p className="leading-relaxed text-gray-700">There is no need to chase a particular sensation or follow someone else's routine. If you choose to explore a device, take your time, follow its instructions, and let comfort guide you.</p>
      </div>
    </section>
  );
}

export function GuideSources() {
  return (
    <section id="sources" data-wellness-section="sources" aria-labelledby="sources-title" className="rounded-xl border border-gray-200 p-6 sm:p-8">
      <h2 id="sources-title" className="mb-4 text-xl font-bold text-gray-900">Sources & Further Reading</h2>
      <p className="mb-4 text-sm leading-relaxed text-gray-600">These sources support the general education above. They do not review or endorse Lem.</p>
      <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed text-gray-700">
        <li><a className={sourceLink} href="https://menopause.org/patient-education/menopause-topics/symptoms" target="_blank" rel="noopener noreferrer">The Menopause Society: Menopause Symptoms<span className="sr-only"> (opens in a new tab)</span></a></li>
        <li><a className={sourceLink} href="https://www.nhs.uk/conditions/menopause-and-perimenopause/symptoms/" target="_blank" rel="noopener noreferrer">NHS: Symptoms of menopause and perimenopause<span className="sr-only"> (opens in a new tab)</span></a></li>
        <li><a className={sourceLink} href="https://www.acog.org/womens-health/faqs/vulvovaginal-health" target="_blank" rel="noopener noreferrer">American College of Obstetricians and Gynecologists: Vulvovaginal Health<span className="sr-only"> (opens in a new tab)</span></a></li>
      </ol>
      <p className="mt-5 text-xs text-gray-500">Sources checked October 27, 2026. Product specifications come from Hello Nancy's Lem product page.</p>
    </section>
  );
}
