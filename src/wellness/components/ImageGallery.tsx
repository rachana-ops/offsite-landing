import { useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImageGalleryProps {
  images: { src: string; alt: string }[];
}

export function ImageGallery({ images }: ImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const isOpen = selectedIndex !== null;

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector("button")?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedIndex(null);
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const direction = event.key === "ArrowLeft" ? -1 : 1;
        setSelectedIndex(index => index === null ? null : (index + direction + images.length) % images.length);
      }
      if (event.key === "Tab") {
        const buttons = dialog.current?.querySelectorAll("button");
        if (!buttons?.length) return;
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [isOpen, images.length]);

  const openLightbox = (index: number) => {
    setSelectedIndex(index);
  };

  const closeLightbox = () => {
    setSelectedIndex(null);
  };

  const goToPrevious = () => {
    if (selectedIndex !== null) {
      setSelectedIndex((selectedIndex - 1 + images.length) % images.length);
    }
  };

  const goToNext = () => {
    if (selectedIndex !== null) {
      setSelectedIndex((selectedIndex + 1) % images.length);
    }
  };

  return (
    <>
      {/* Gallery Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {images.map((image, index) => (
          <button
            key={index}
            type="button"
            aria-label={`Enlarge photo: ${image.alt}`}
            onClick={() => openLightbox(index)}
            className="relative aspect-square overflow-hidden rounded-lg border-2 border-gray-200 hover:border-[#FF1493] transition-all hover:scale-105 cursor-zoom-in"
          >
            <img
              src={image.src}
              alt={image.alt}
              className="w-full h-full object-cover"
            />
          </button>
        ))}
      </div>

      {/* Lightbox Modal */}
      {selectedIndex !== null && (
        <div
          ref={dialog}
          role="dialog"
          aria-modal="true"
          aria-label="Lem product photos"
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center"
          onClick={closeLightbox}
        >
          <Button
            aria-label="Close product photos"
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/20"
            onClick={closeLightbox}
          >
            <X className="w-6 h-6" />
          </Button>

          <Button
            aria-label="Previous photo"
            variant="ghost"
            size="icon"
            className="absolute left-4 text-white hover:bg-white/20"
            onClick={(e) => {
              e.stopPropagation();
              goToPrevious();
            }}
          >
            <ChevronLeft className="w-8 h-8" />
          </Button>

          <div
            className="max-w-5xl max-h-[90vh] p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={images[selectedIndex].src}
              alt={images[selectedIndex].alt}
              className="mx-auto max-h-[calc(90vh-4rem)] w-auto max-w-full object-contain rounded-lg"
            />
            <p className="text-white text-center mt-4">
              {selectedIndex + 1} / {images.length}
            </p>
          </div>

          <Button
            aria-label="Next photo"
            variant="ghost"
            size="icon"
            className="absolute right-4 text-white hover:bg-white/20"
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
          >
            <ChevronRight className="w-8 h-8" />
          </Button>
        </div>
      )}
    </>
  );
}
