import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Package, Shield, Truck, Heart, Edit3 } from "lucide-react";
import { ImageGallery } from "@/components/ImageGallery";
import { GuideNavigation, MenopauseEducation, AnatomyEducation, GuideSources } from "@/components/WellnessEducation";
import { LemMechanism } from "@/components/LemMechanism";
import { ProductComparison } from "@/components/ProductComparison";

export default function Home() {
  const [showStickyBar, setShowStickyBar] = useState(false);
  useEffect(() => {
    const handleScroll = () => setShowStickyBar(window.scrollY > 800);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Keep the reference's eight-image layout, using photos without reviews or claims.
  const galleryImages = [
    { src: "/unlock/PDP.jpg", alt: "Nancy's Lem held in two hands" },
    { src: "/unlock/PDP-1.jpg", alt: "Lem on a yellow background" },
    { src: "/unlock/PDP-2.jpg", alt: "Lem held above fresh lemons" },
    { src: "/unlock/PDP-3.jpg", alt: "Lem beside another personal wellness device" },
    { src: "/unlock/lem_product_packaging.webp", alt: "Lem in its presentation box" },
    { src: "/unlock/PDP-5.jpg", alt: "A woman holding Lem beside her face" },
    { src: "/unlock/lem_product_lemons.webp", alt: "Lem arranged with sliced lemons" },
    { src: "/unlock/lem_product_cocktail.webp", alt: "Lem beside sunglasses and a glass on a pink background" },
  ];

  return (
    <div className="min-h-screen bg-white relative">
      {/* Editorial Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-50">
        <div className="container max-w-4xl px-4 py-4">
          <div className="flex items-center justify-between">
            <img 
              src="/unlock/wellness-insider-logo.png" 
              alt="Wellness Insider" 
              className="h-8 md:h-10"
            />
            <div className="text-right">
              <p className="text-xs text-gray-500 font-medium">Menopause & Personal Self-Care</p>
            </div>
          </div>
        </div>
      </header>

      {/* Sticky CTA Bar */}
      {showStickyBar && (
        <div className="fixed top-[65px] md:top-[73px] left-0 right-0 z-40 box-border w-full max-w-[100vw] overflow-x-clip bg-[#FF1493] text-white py-2 shadow-lg animate-in slide-in-from-top">
          <div className="container max-w-4xl box-border flex w-full items-center gap-2 px-2.5 sm:px-4">
            <div className="hidden md:flex items-center gap-2">
              <span className="text-sm font-medium">Nancy's Lem • Personal Wellness</span>
            </div>
            <div className="grid w-full min-w-0 max-w-full flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 md:ml-auto md:flex-none md:w-auto">
              <div className="flex flex-col items-start md:items-end">
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  <span className="text-sm font-medium">Explore Nancy's Lem</span>
                </div>

              </div>
              <a 
                href="https://hellonancy.com/products/lem" 
                onClick={() => {
                  // @ts-ignore
                  if (typeof window.gtag === 'function') {
                    // @ts-ignore
                    window.gtag('event', 'conversion', {
                      'send_to': 'AW-11033179838/wazqCJ385ZgYEL7tg40p',
                      'event_callback': function() {
                        // Optional: Ensure navigation happens if tracking fails, but standard <a> tag handles it
                      }
                    });
                  }
                }}
              >
                <Button className="bg-white text-[#FF1493] hover:bg-gray-100 font-bold">
                  View Product
                </Button>
              </a>
            </div>
          </div>
        </div>
      )}





      {/* Article Metadata */}
      <section className="bg-white py-8 md:py-16 border-b border-gray-200">
        <div className="container max-w-4xl px-4">
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-600 mb-4">
            <span className="text-[#FF1493] font-semibold bg-[#FF1493]/10 px-3 py-1 rounded-full">MENOPAUSE & SELF-CARE</span>
            <span className="hidden sm:inline">•</span>
            <span className="bg-gray-100 px-3 py-1 rounded-full">ADVERTISEMENT</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-4 md:mb-6 leading-tight">
            Self-Care During Menopause: A Closer Look at Nancy's Lem
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 mb-6 leading-relaxed">
            Making space for personal self-care during menopause? Explore the design, adjustable air-pulse settings, and practical features of this lemon-shaped device at your own pace.
          </p>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-600 border-t border-gray-200 pt-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FF1493] to-[#FFE14D]" />
              <div>
                <p className="font-semibold text-gray-900">Wellness Insider Guide</p>
                <p className="text-xs sm:text-sm">Promotional product guide</p>
              </div>
            </div>
            <span className="hidden sm:inline">•</span>
            <span>Last updated: Oct 27, 2026</span>
            <span className="hidden sm:inline">•</span>
            <span>7 min read</span>
          </div>
        </div>
      </section>

      {/* Advertising Disclosure */}
      <section className="bg-[#FFE14D]/20 py-3 border-b border-[#FFE14D]">
        <div className="container max-w-4xl">
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0 mt-0.5">
              <div className="w-5 h-5 bg-[#FF1493] rounded-full flex items-center justify-center">
                <Edit3 className="w-3 h-3 text-white" />
              </div>
            </div>
            <p className="text-gray-700 text-xs leading-tight">
              <span className="font-bold text-gray-900 mr-1">Advertisement:</span>
              This promotional guide contains affiliate links. We may earn a commission if you purchase through them, at no extra cost to you. It describes product features and does not provide medical advice.
            </p>
          </div>
        </div>
      </section>

      {/* Hero Image */}
      <section className="container max-w-4xl py-8">
        <img 
          src="/unlock/PDP.jpg" 
          alt="Nancy's Lem wellness device held in a hand"
          className="w-full rounded-lg shadow-lg"
        />
        <p className="text-sm text-gray-500 mt-2 italic">Nancy's Lem has a compact, lemon-shaped design. Photo: Hello Nancy</p>
      </section>

      {/* Trust Indicators */}
      <section className="bg-white py-6 border-y border-gray-200">
        <div className="container max-w-4xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-sm">
            <div className="flex flex-col items-center gap-2">
              <Package className="w-6 h-6 text-[#FF1493]" />
              <p className="font-medium text-gray-900">Discreet Packaging</p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Check className="w-6 h-6 text-[#FF1493]" />
              <p className="font-medium text-gray-900">Adjustable Settings</p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Check className="w-6 h-6 text-[#FF1493]" />
              <p className="font-medium text-gray-900">Rechargeable Design</p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Shield className="w-6 h-6 text-[#FF1493]" />
              <p className="font-medium text-gray-900">Care Instructions Included</p>
            </div>
          </div>
        </div>
      </section>

      {/* Article Body */}
      <article className="container max-w-4xl py-12 space-y-8">
        <GuideNavigation />

        <div className="prose prose-lg max-w-none">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">A Personal Approach to Self-Care During Menopause</h2>
          <p className="text-gray-700 leading-relaxed mb-4">Menopause is a personal experience. If you are taking a fresh look at your self-care routine at this stage of life, your own preferences, privacy, and pace are a place to start.</p>
          <p className="text-gray-700 leading-relaxed">This guide introduces Nancy's Lem as one optional personal wellness accessory. We look at its design, adjustable settings, and everyday care so you can decide whether it interests you.</p>
        </div>

        <MenopauseEducation />

        <AnatomyEducation />

        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Meet Nancy's Lem</h2>
          <p className="text-gray-700 leading-relaxed mb-4">Compact, rechargeable, and shaped like a lemon, Lem is designed for personal relaxation and intimate self-care.</p>
          <p className="text-gray-700 leading-relaxed">Its <strong>Air Pulse Technology</strong> offers an alternative sensation to direct vibration. With adjustable settings, you can start gently and choose the intensity you prefer.</p>
        </div>

        <LemMechanism />

        <ProductComparison />

        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-6 text-center">A Closer Look at Lem's Features</h2>
          <p className="text-center text-gray-600 mb-8">Everyday design details for a personal self-care routine.</p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse bg-white shadow-lg rounded-lg overflow-hidden">
              <thead><tr className="bg-gray-100"><th scope="col" className="border border-gray-300 p-4 text-left">Feature</th><th scope="col" className="border border-gray-300 p-4 text-left bg-[#FFE14D]/30">Nancy's Lem</th></tr></thead>
              <tbody className="text-sm">
                {[
                  ["Design", "Compact, lemon-shaped design"],
                  ["Settings", "12 adjustable air-pulse settings"],
                  ["Material", "Medical-grade silicone"],
                  ["Water resistance", "IPX7 waterproof rating"],
                  ["Charging", "USB-C or magnetic charging cable"],
                  ["Storage", "Satin pouch included"],
                ].map(([feature, detail]) => <tr key={feature}><th scope="row" className="border border-gray-300 p-4 text-left font-medium">{feature}</th><td className="border border-gray-300 p-4 bg-[#FFE14D]/10">{detail}</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>

        {/* Design Features */}
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">A Design for Your Personal Space</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            The design is <em>intentionally</em> discreet. Lem is bright yellow, fits in the palm of your hand, and looks like a decorative lemon.
          </p>
          
          <div className="bg-[#FFE14D]/20 p-6 rounded-xl mb-6">
            <h3 className="font-bold text-lg text-gray-900 mb-3">A Closer Look at the Shape</h3>
            
            {/* Discretion Illustration */}
            <div className="max-w-md mx-auto mb-6">
              <img 
                src="/unlock/discretion_illustration.png" 
                alt="Lem device sitting discreetly on nightstand" 
                className="w-full rounded-lg shadow-lg"
              />
            </div>

            <p className="text-gray-700 leading-relaxed mb-3">
              Personal self-care is your business. Lem's small size makes it easy to keep close or store in its satin pouch.
            </p>
            <p className="text-gray-700 leading-relaxed mb-3">
              Its playful shape and soft exterior are designed to fit naturally into a private self-care routine.
            </p>
            <p className="text-gray-700 leading-relaxed font-semibold">
              Its lemon-shaped design is a distinctive detail that makes it easy to recognise.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="border-2 border-[#FFE14D]">
              <CardContent className="p-6 text-center space-y-3">
                <div className="text-4xl">🤫</div>
                <h3 className="font-bold text-lg text-gray-900">Quiet Motor</h3>
                <p className="text-gray-600 text-sm">
                  Sound varies with the setting and surroundings
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 border-[#FF1493]">
              <CardContent className="p-6 text-center space-y-3">
                <div className="text-4xl">🌊</div>
                <h3 className="font-bold text-lg text-gray-900">Waterproof (IPX7)</h3>
                <p className="text-gray-600 text-sm">
                  Follow the user guide for use around water
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 border-[#FFE14D]">
              <CardContent className="p-6 text-center space-y-3">
                <div className="text-4xl">🍋</div>
                <h3 className="font-bold text-lg text-gray-900">Medical-grade Silicone</h3>
                <p className="text-gray-600 text-sm">
                  Clean according to the care instructions
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 border-[#FF1493]">
              <CardContent className="p-6 text-center space-y-3">
                <div className="text-4xl">⚡</div>
                <h3 className="font-bold text-lg text-gray-900">USB-C or Magnetic Charging</h3>
                <p className="text-gray-600 text-sm">
                  Recharge with the supplied cable
                </p>
              </CardContent>
            </Card>
          </div>

          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">Product Gallery</h3>
            <ImageGallery images={galleryImages} />
          </div>
        </div>

        {/* Unboxing Experience Section */}
        <div className="bg-gradient-to-r from-[#FFE14D]/20 to-white p-8 rounded-xl my-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Packaging and Everyday Essentials</h2>
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <img 
                src="/unlock/lem_product_packaging.webp"
                alt="Lem in its presentation box with printed guides"
                className="w-full rounded-lg shadow-lg"
              />
            </div>
            <div className="space-y-4">
              <p className="text-gray-700 leading-relaxed">
                Lem arrives with the accessories you need to get started, in discreet packaging.
              </p>
              <div className="bg-white p-6 rounded-lg border-2 border-[#FFE14D]">
                <h3 className="font-bold text-lg text-gray-900 mb-3">What's Inside the Box:</h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-[#FF1493] flex-shrink-0 mt-0.5" />
                    <span>The Lem device (bright yellow, palm-sized)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-[#FF1493] flex-shrink-0 mt-0.5" />
                    <span>USB-C or magnetic charging cable</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-[#FF1493] flex-shrink-0 mt-0.5" />
                    <span>Satin pouch included</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-[#FF1493] flex-shrink-0 mt-0.5" />
                    <span>"Self-Love Manual" with usage tips and wellness advice</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-[#FF1493] flex-shrink-0 mt-0.5" />
                    <span>Quick-start guide with illustrated instructions</span>
                  </li>
                </ul>
              </div>
              <p className="text-gray-700 leading-relaxed italic">
                Read the supplied user guide before you begin, and keep it for charging, cleaning, and storage advice.
              </p>
            </div>
          </div>
        </div>

        <div className="my-12 bg-[#FF1493]/5 p-6 sm:p-8 rounded-xl border-2 border-[#FF1493]/20">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Make Space for Your Self-Care</h2>
          <div className="space-y-4 text-gray-700 leading-relaxed">
            <p>There is no one-size-fits-all routine. Choose a comfortable, private setting and take your time. Read the user guide before use and begin with a low intensity.</p>
            <p>Keep Lem clean according to its care instructions, charge it with the supplied cable, and store it in its satin pouch when you are finished.</p>
            <p>Menopause-related health questions belong in a conversation with a qualified healthcare professional. This guide focuses on a personal wellness accessory, not menopause care.</p>
          </div>
        </div>

        {/* Shared Self-Care */}
        <div className="my-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Making Space for a Conversation</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4 text-gray-700 leading-relaxed">
              <p>
                If you are revisiting personal self-care during menopause, you may want to talk with a partner about your preferences. What you choose to share is up to you.
              </p>
              <p>
                Personal wellness can be enjoyed alone or shared with a partner. Talk about comfort and preferences, and decide together what feels right.
              </p>
              <div className="bg-[#FFE14D]/20 p-6 rounded-lg">
                <p className="italic text-gray-900 mb-2">
                Give each other space to talk about preferences and boundaries.
                </p>
                <p className="font-semibold text-gray-700">Take your time and communicate</p>
              </div>
              <p>
                The compact size makes Lem easy to hold and position. Follow the guide and stop if either partner feels uncomfortable.
              </p>
            </div>
            <div className="bg-gradient-to-br from-[#FF1493]/10 to-[#FFE14D]/10 p-8 rounded-xl">
              <h3 className="font-bold text-xl text-gray-900 mb-4">Things to Discuss Together</h3>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-8 h-8 bg-[#FF1493] rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold">1</div>
                  <div>
                    <p className="font-semibold text-gray-900">Shared Self-Care</p>
                    <p className="text-sm text-gray-600">Explore the settings together at a comfortable pace</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 bg-[#FF1493] rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold">2</div>
                  <div>
                    <p className="font-semibold text-gray-900">Personal Preferences</p>
                    <p className="text-sm text-gray-600">Talk about what feels comfortable for each of you</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 bg-[#FF1493] rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold">3</div>
                  <div>
                    <p className="font-semibold text-gray-900">Time to Yourself</p>
                    <p className="text-sm text-gray-600">Choose a private setting and take your time</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 bg-[#FF1493] rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold">4</div>
                  <div>
                    <p className="font-semibold text-gray-900">Care and Storage</p>
                    <p className="text-sm text-gray-600">Clean the device and store it in its satin pouch after use</p>
                  </div>
                </div>
              </div>
              <div className="mt-6 p-4 bg-white rounded-lg">
                <p className="text-sm text-gray-700">
                  Keep communication open. Experiences and preferences vary from person to person.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="my-12 bg-gradient-to-r from-[#FFE14D]/30 to-[#FF1493]/30 p-6 sm:p-8 rounded-xl">
          <h2 className="text-3xl font-bold text-gray-900 mb-6 text-center">Choose What Fits Your Routine</h2>
          <div className="grid md:grid-cols-2 gap-6 bg-white p-6 rounded-lg text-gray-700">
            <div><h3 className="font-bold text-lg mb-3">Things to Consider</h3><ul className="space-y-2"><li>✓ Adjustable air-pulse settings</li><li>✓ Compact design and rechargeable battery</li><li>✓ Discreet packaging and a satin pouch</li><li>✓ Your own preferences, comfort, and budget</li></ul></div>
            <div><h3 className="font-bold text-lg mb-3">Before You Buy</h3><p className="leading-relaxed">Explore the product details and current shipping and return terms on HelloNancy. Take the time you need to decide whether a device belongs in your routine.</p></div>
          </div>
        </div>

        <GuideSources />
      </article>



      {/* Product Details */}
      <section id="offer-section" className="bg-gradient-to-br from-[#FF1493]/10 to-[#FFE14D]/20 py-12 md:py-20">
        <div className="container px-4">
          <div className="max-w-4xl mx-auto mb-8">
            <h2 className="text-3xl md:text-5xl font-bold text-center text-gray-900 mb-4">
              Take a Closer Look at Nancy's Lem
            </h2>
            <p className="text-center text-xl text-gray-600">
              Exploring personal self-care during menopause? Read the product details and decide whether Lem's design and settings suit your preferences.
            </p>
          </div>

          <div className="max-w-2xl mx-auto">
            <Card className="border-4 border-[#FF1493] shadow-2xl relative overflow-hidden">
              <CardContent className="space-y-5 p-4 sm:space-y-6 sm:p-8">
                <div className="text-center">
                  <div className="inline-block bg-[#FFE14D] text-black px-6 py-3 rounded-full text-sm font-bold mb-4">
                    EXPLORE NANCY'S LEM
                  </div>

                  <h3 className="text-3xl font-bold text-gray-900 mb-2">Nancy's Lem Personal Wellness Device</h3>
                  <div className="bg-gradient-to-r from-[#FF1493]/10 to-[#FFE14D]/10 p-4 rounded-lg mb-4">
                    <p className="text-center text-gray-900">
                      <strong className="text-xl text-[#FF1493]">Explore the details at your own pace</strong>
                    </p>
                    <p className="text-center text-sm text-gray-600 mt-1">
                      See HelloNancy for current pricing, available currency, delivery options, and purchase terms for your location.
                    </p>
                  </div>
                </div>

                <div className="space-y-3 border-t border-b border-gray-200 py-6">
                  <div className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-[#FF1493] flex-shrink-0" />
                    <span className="text-gray-700">Lem personal wellness device (bright yellow)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-[#FF1493] flex-shrink-0" />
                    <span className="text-gray-700">Self-love manual & usage guide</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-[#FF1493] flex-shrink-0" />
                    <span className="text-gray-700">USB-C or magnetic charging cable</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-[#FF1493] flex-shrink-0" />
                    <span className="text-gray-700">Satin pouch included</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-[#FF1493] flex-shrink-0" />
                    <span className="text-gray-700">Shipping options at checkout</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-[#FF1493] flex-shrink-0" />
                    <span className="text-gray-700">Current return policy on HelloNancy</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-[#FF1493] flex-shrink-0" />
                    <span className="text-gray-700">Warranty terms on the product page</span>
                  </div>
                </div>

                <a href="https://hellonancy.com/products/lem"   className="w-full">
                  <Button size="lg" className="w-full bg-[#FF1493] hover:bg-[#E01280] text-white text-xl h-auto min-h-14 w-full whitespace-normal py-4 shadow-xl">
                    View Lem Product Details
                  </Button>
                </a>

                <div className="bg-green-50 border-2 border-green-200 p-4 rounded-lg">
                  <p className="text-center text-green-800 font-semibold flex items-center justify-center gap-2">
                    <Shield className="w-5 h-5" />
                    Shipping & Returns
                  </p>
                  <p className="text-center text-sm text-green-700 mt-2">
                    Read the current shipping and return terms on HelloNancy before purchase, including the conditions for opened products.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-4 text-center text-sm text-gray-600">
                  <div className="flex flex-col items-center gap-1">
                    <Package className="w-5 h-5 text-[#FF1493]" />
                    <span>Discreet Packaging</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <Truck className="w-5 h-5 text-[#FF1493]" />
                    <span>Delivery details at checkout</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <Shield className="w-5 h-5 text-[#FF1493]" />
                    <span>Secure Checkout</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Is This For You Section */}
      <section className="bg-gradient-to-br from-[#FFE14D]/10 via-white to-[#FF1493]/10 py-16 md:py-24">
        <div className="container max-w-4xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-4">
            Is Lem Right For You?
          </h2>
          <p className="text-center text-xl text-gray-600 mb-12">
            Consider what matters to you in a self-care routine during or after menopause.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-2 border-[#FFE14D] bg-white hover:shadow-xl transition-shadow">
              <CardContent className="p-8 space-y-4">
                <h3 className="font-bold text-xl text-gray-900 mb-4">🌸 Features You May Want to Explore</h3>
                <div className="space-y-3 text-gray-700">
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-[#FF1493] flex-shrink-0 mt-0.5" />
                    <span>Looking for a compact personal wellness device</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-[#FF1493] flex-shrink-0 mt-0.5" />
                    <span>Interested in adjustable air-pulse settings</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-[#FF1493] flex-shrink-0 mt-0.5" />
                    <span>Wanting to explore self-care at your own pace</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-[#FF1493] flex-shrink-0 mt-0.5" />
                    <span>Preferring an alternative sensation to direct vibration</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-[#FF1493] flex-shrink-0 mt-0.5" />
                    <span>Making time for relaxation and personal enjoyment</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-[#FF1493] flex-shrink-0 mt-0.5" />
                    <span>Preferring a lemon-shaped design and a storage pouch</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-[#FF1493] flex-shrink-0 mt-0.5" />
                    <span>Wanting a rechargeable device with simple controls</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-[#FF1493] flex-shrink-0 mt-0.5" />
                    <span>Looking for a device that fits your routine</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-[#FF1493] bg-white hover:shadow-xl transition-shadow">
              <CardContent className="p-8 space-y-4">
                <h3 className="font-bold text-xl text-gray-900 mb-4">💡 Your Preferences Come First</h3>
                <div className="space-y-3 text-gray-700">
                  <div className="flex items-start gap-3">
                    <Heart className="w-5 h-5 text-[#FF1493] flex-shrink-0 mt-0.5" />
                    <span>You value <strong>clear product information</strong></span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Heart className="w-5 h-5 text-[#FF1493] flex-shrink-0 mt-0.5" />
                    <span>You want <strong>adjustable settings</strong> to suit your preferences</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Heart className="w-5 h-5 text-[#FF1493] flex-shrink-0 mt-0.5" />
                    <span>You prefer a <strong>compact, easy-to-store device</strong></span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Heart className="w-5 h-5 text-[#FF1493] flex-shrink-0 mt-0.5" />
                    <span>You appreciate <strong>thoughtful design</strong> that respects your privacy</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Heart className="w-5 h-5 text-[#FF1493] flex-shrink-0 mt-0.5" />
                    <span>You want to consider <strong>your budget and the current purchase terms</strong></span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Heart className="w-5 h-5 text-[#FF1493] flex-shrink-0 mt-0.5" />
                    <span>You enjoy <strong>taking time for personal self-care</strong></span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Heart className="w-5 h-5 text-[#FF1493] flex-shrink-0 mt-0.5" />
                    <span>You want to <strong>explore at your own pace</strong></span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-8 text-center">
            <div className="bg-[#FFE14D]/30 p-6 rounded-xl max-w-2xl mx-auto">
              <p className="text-lg text-gray-900 mb-4">
                <strong>Interested in these features?</strong> See the full product details on HelloNancy.
              </p>
              <a 
                href="https://hellonancy.com/products/lem" 
                 
                
              onClick={() => {
                // @ts-ignore
                if (typeof window.gtag === 'function') {
                  // @ts-ignore
                  window.gtag('event', 'conversion', {
                    'send_to': 'AW-11033179838/wazqCJ385ZgYEL7tg40p',
                    'event_callback': function() {
                      // Optional: Ensure navigation happens if tracking fails, but standard <a> tag handles it
                    }
                  });
                }
              }}
              >
                <Button size="lg" className="bg-[#FF1493] hover:bg-[#E01280] text-white w-full h-auto min-h-12 whitespace-normal px-5 py-4 text-lg sm:w-auto sm:px-12">
                  Explore Nancy's Lem
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="container px-4 py-12 md:py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-4">
            Your Questions, Answered
          </h2>
          <p className="text-center text-gray-600 mb-12">Practical information before you choose</p>
          
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <h3 className="font-bold text-lg text-gray-900 mb-2">Is this a menopause product?</h3>
                <p className="text-gray-700">
                  Lem is a personal wellness accessory. This guide discusses it in the context of personal self-care during menopause. It is not a medical device or a substitute for advice from a qualified healthcare professional.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="font-bold text-lg text-gray-900 mb-2">How should I get started?</h3>
                <p className="text-gray-700">
                  Read the user guide and start on the lowest setting. Comfort varies, so adjust gradually and stop if you feel discomfort. If you have pain or a medical concern, ask a qualified healthcare professional before use.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="font-bold text-lg text-gray-900 mb-2">How is it packaged?</h3>
                <p className="text-gray-700">
                  HelloNancy describes its shipping as discreet. See the product page for current packaging and delivery details.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="font-bold text-lg text-gray-900 mb-2">What if I don't like it?</h3>
                <p className="text-gray-700">
                  Check HelloNancy's current return policy before purchase, including the conditions that apply to opened products. Their customer care team can help with questions.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="font-bold text-lg text-gray-900 mb-2">Can I use it in the shower or bath?</h3>
                <p className="text-gray-700">
                  Lem has an IPX7 waterproof rating. Follow the user guide for use around water, and keep the charging cable and charging connection dry.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="font-bold text-lg text-gray-900 mb-2">How loud is it?</h3>
                <p className="text-gray-700">
                  Lem is designed with a quiet motor. Sound can vary with the setting and your surroundings.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Final Editorial Note */}
      <section className="bg-gradient-to-r from-[#FFE14D] to-[#FF1493] py-12 md:py-20">
        <div className="container max-w-4xl px-4">
          <div className="bg-white/10 backdrop-blur-sm p-8 rounded-2xl space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold text-white text-center">
              Your Self-Care, Your Choice
            </h2>
            <div className="text-white text-lg leading-relaxed space-y-4">
              <p>
                Nancy's Lem combines a playful design, adjustable air-pulse settings, and rechargeable convenience in a compact personal wellness device.
              </p>
              <p>
                During or after menopause, your self-care choices are personal. Take your time, consider your preferences, and speak with a qualified healthcare professional about health concerns.
              </p>
              <p className="text-xl font-bold">
                Visit HelloNancy for full product details, current pricing, and shipping and return information.
              </p>
            </div>
            <div className="text-center pt-6">
              <a 
                href="https://hellonancy.com/products/lem" 
                 
                
                onClick={() => {
                  // @ts-ignore
                  if (typeof window.gtag === 'function') {
                    // @ts-ignore
                    window.gtag('event', 'conversion', {
                      'send_to': 'AW-11033179838/wazqCJ385ZgYEL7tg40p',
                      'event_callback': function() {
                        // Optional: Ensure navigation happens if tracking fails, but standard <a> tag handles it
                      }
                    });
                  }
                }}
              >
                <Button size="lg" className="bg-white text-[#FF1493] hover:bg-gray-100 text-xl h-auto min-h-14 w-full whitespace-normal px-5 py-4 shadow-2xl sm:w-auto sm:px-12">
                View Nancy's Lem
              </Button>
              </a>
              <p className="text-white/90 text-sm mt-4">✓ Return terms on HelloNancy ✓ Shipping options on HelloNancy ✓ Discreet packaging</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-10 md:py-12">
        <div className="container px-4">
          <div className="max-w-4xl mx-auto">
            <div className="bg-gray-800 p-6 rounded-lg mb-8">
              <h3 className="font-bold text-lg mb-3">Affiliate Disclosure</h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                Wellness Insider is reader-supported. When you buy through links on our site, we may earn an affiliate commission at no extra cost to you. This is a promotional product guide. Product descriptions are for general information and are not medical advice.
              </p>
            </div>

            <div className="grid md:grid-cols-4 gap-8 mb-8">
              <div>
                <h3 className="font-bold text-lg mb-4">About Us</h3>
                <p className="text-gray-400 text-sm">
                  Wellness Insider shares promotional product guides and personal self-care information, including self-care during menopause.
                </p>
              </div>
              <div>
                <h3 className="font-bold text-lg mb-4">Categories</h3>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li>Menopause & Self-Care</li>
                  <li>Wellness</li>
                  <li>Self-Care & Relationships</li>
                  <li>Product Guides</li>
                </ul>
              </div>
              <div>
                <h3 className="font-bold text-lg mb-4">About Nancy's Lem</h3>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li>Product Details</li>
                  <li>Product Care</li>
                  <li>Shipping & Returns</li>
                  <li><a href="mailto:care@hellonancy.com" className="underline hover:text-white">Contact: care@hellonancy.com</a></li>
                </ul>
              </div>
              <div>
                <h3 className="font-bold text-lg mb-4">Purchase Information</h3>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li><a href="https://hellonancy.com/policies/privacy-policy" className="underline hover:text-white">Privacy Policy</a></li>
                  <li><a href="https://hellonancy.com/policies/terms-of-service" className="underline hover:text-white">Terms of Service</a></li>
                  <li>Return terms on HelloNancy</li>
                  <li>Warranty terms on the product page</li>
                </ul>
              </div>
            </div>
            <div className="border-t border-gray-800 pt-8 text-center text-sm text-gray-400">
              <p>© 2026 Wellness Insider. All rights reserved.</p>
              <p className="mt-2">CRN No. 16519269</p>
              <p className="mt-2">Product featured: Nancy's Lem by Hello Nancy</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
