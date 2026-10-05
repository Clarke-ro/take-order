import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';

export interface BuyerImageViewerProps {
  isOpen: boolean;
  onClose: () => void;
  images: string[];
  initialIndex?: number;
  productName: string;
}

export function BuyerImageViewer({
  isOpen,
  onClose,
  images,
  initialIndex = 0,
  productName,
}: BuyerImageViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const initialPinchDistance = useRef<number | null>(null);
  const initialScale = useRef<number>(1);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(Math.min(Math.max(0, initialIndex), images.length - 1));
      setScale(1);
      triggerElementRef.current = document.activeElement as HTMLElement;
      // Focus close button on open
      setTimeout(() => closeButtonRef.current?.focus(), 50);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      triggerElementRef.current?.focus();
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, initialIndex, images.length]);

  const handlePrev = useCallback(() => {
    setScale(1);
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  }, [images.length]);

  const handleNext = useCallback(() => {
    setScale(1);
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  }, [images.length]);

  // Keyboard navigation & Focus trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'Tab') {
        // Focus trap inside modal
        const focusableElements = document.querySelectorAll<HTMLElement>(
          '#buyer-image-viewer-modal button, #buyer-image-viewer-modal [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;
        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handlePrev, handleNext]);

  // Touch handlers for swipe & pinch-to-zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      initialPinchDistance.current = null;
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      initialPinchDistance.current = Math.hypot(dx, dy);
      initialScale.current = scale;
      touchStartX.current = null;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistance.current != null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const currentDistance = Math.hypot(dx, dy);
      const newScale = Math.min(
        Math.max(1, initialScale.current * (currentDistance / initialPinchDistance.current)),
        3
      );
      setScale(newScale);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current != null && scale === 1 && e.changedTouches.length === 1) {
      const deltaX = e.changedTouches[0].clientX - touchStartX.current;
      const deltaY = e.changedTouches[0].clientY - (touchStartY.current || 0);

      // Only horizontal swipe if not scrolling vertically
      if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
        if (deltaX < 0) {
          handleNext();
        } else {
          handlePrev();
        }
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
    initialPinchDistance.current = null;
  };

  if (!isOpen || images.length === 0) return null;

  const currentImage = images[currentIndex] || '';

  return (
    <div
      id="buyer-image-viewer-modal"
      role="dialog"
      aria-modal="true"
      aria-label={`${productName} image viewer`}
      className="fixed inset-0 z-50 flex flex-col justify-between bg-black/95 text-white backdrop-blur-md select-none touch-none"
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)',
        paddingLeft: 'max(env(safe-area-inset-left, 0px), 16px)',
        paddingRight: 'max(env(safe-area-inset-right, 0px), 16px)',
      }}
    >
      {/* Top Header Row */}
      <div className="flex items-center justify-between px-2 py-2">
        <div className="text-xs font-semibold tracking-wider font-mono-ui text-neutral-300">
          {currentIndex + 1} / {images.length}
        </div>

        <div className="flex items-center gap-2">
          {scale > 1 ? (
            <button
              type="button"
              onClick={() => setScale(1)}
              aria-label="Reset zoom"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-800/80 text-white hover:bg-neutral-700 transition cursor-pointer"
            >
              <ZoomOut size={18} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setScale(2)}
              aria-label="Zoom in"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-800/80 text-white hover:bg-neutral-700 transition cursor-pointer"
            >
              <ZoomIn size={18} />
            </button>
          )}

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close image viewer"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-800/80 text-white hover:bg-neutral-700 transition cursor-pointer"
            data-testid="button-close-image-viewer"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main Image Display Area */}
      <div
        className="relative flex-1 flex items-center justify-center overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <img
          key={currentImage}
          src={currentImage}
          alt={`${productName} view ${currentIndex + 1}`}
          className="max-h-[75vh] max-w-full object-contain transition-transform duration-150 ease-out"
          style={{ transform: `scale(${scale})` }}
          draggable={false}
        />

        {/* Desktop / Large Arrow Controls */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous image"
              className="absolute left-2 top-1/2 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900/60 text-white hover:bg-neutral-800 transition cursor-pointer"
            >
              <ChevronLeft size={24} />
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Next image"
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900/60 text-white hover:bg-neutral-800 transition cursor-pointer"
            >
              <ChevronRight size={24} />
            </button>
          </>
        )}
      </div>

      {/* Bottom Thumbnail Strip (if multiple images) */}
      {images.length > 1 && (
        <div className="flex items-center justify-center gap-2 overflow-x-auto py-2 px-4 max-w-full">
          {images.map((img, idx) => (
            <button
              key={`${img}-${idx}`}
              type="button"
              onClick={() => {
                setScale(1);
                setCurrentIndex(idx);
              }}
              aria-label={`View image ${idx + 1}`}
              className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition cursor-pointer ${
                idx === currentIndex ? 'border-[hsl(var(--primary))] ring-1 ring-[hsl(var(--primary))]' : 'border-neutral-700 opacity-60 hover:opacity-100'
              }`}
            >
              <img src={img} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
