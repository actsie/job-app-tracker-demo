"use client";
import { useEffect, useState } from "react";

type NudgeState = "collapsed" | "open" | "hidden";

export default function VideoNudge({
  url = "https://youtu.be/pGNIEEcD3f8",
  embedUrl = "https://www.youtube-nocookie.com/embed/pGNIEEcD3f8?rel=0&modestbranding=1&playsinline=1&autoplay=1",
  storageKey = "video_nudge_state",
  label = "Watch build and demo video ✨",
}: {
  url?: string;
  embedUrl?: string;
  storageKey?: string;
  label?: string;
}) {
  const [state, setState] = useState<NudgeState>("collapsed");
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem(storageKey)) as NudgeState | null;
    if (saved === "open" || saved === "collapsed" || saved === "hidden") setState(saved);
  }, [storageKey]);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(storageKey, state);
  }, [state, storageKey]);

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isModalOpen) {
        setIsModalOpen(false);
      }
    };

    if (isModalOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden"; // Prevent background scroll
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isModalOpen]);

  const openModal = () => {
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  if (state === "hidden") return null;

  return (
    <div className="absolute left-4 top-2 z-50 select-none">
      {/* Collapsed tab */}
      {state === "collapsed" && (
        <button
          onClick={() => setState("open")}
          className="group flex items-center gap-2 rounded-full bg-black/80 text-white px-4 py-2 shadow-lg backdrop-blur transition hover:bg-black"
          aria-label={label}
        >
          <span className="text-sm">{label}</span>
          <span className="inline-block h-2 w-2 rounded-full bg-white/70 group-hover:bg-white" />
        </button>
      )}

      {/* Expanded card */}
      {state === "open" && (
        <div className="w-80 max-w-[90vw] rounded-2xl bg-white shadow-2xl ring-1 ring-black/10 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-start justify-between p-4">
            <div>
              <div className="text-sm font-semibold">Demo video</div>
              <p className="text-xs text-gray-600">See how this app was built & how to use it.</p>
            </div>
            <button
              onClick={() => setState("collapsed")}
              className="ml-3 rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Minimize"
              title="Minimize"
            >
              ✕
            </button>
          </div>

          {/* Thumbnail teaser with play button */}
          <button
            onClick={openModal}
            className="group relative mx-4 mb-3 aspect-video w-[calc(100%-2rem)] overflow-hidden rounded-lg bg-gray-900 hover:bg-gray-800 transition-colors"
            aria-label="Play demo video"
          >
            {/* YouTube thumbnail background */}
            <div 
              className="absolute inset-0 bg-cover bg-center opacity-80 group-hover:opacity-90 transition-opacity"
              style={{
                backgroundImage: 'url(https://img.youtube.com/vi/pGNIEEcD3f8/maxresdefault.jpg)'
              }}
            />
            
            {/* Dark overlay */}
            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors" />
            
            {/* Play button */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
            
            {/* Duration badge */}
            <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
              Demo Video
            </div>
          </button>

          <div className="flex justify-center p-3 pt-0">
            <button
              onClick={() => window.open("https://pawgrammer.com", "_blank", "noopener,noreferrer")}
              className="shine-button text-sm"
              title="Build my version"
            >
              <div className="shine-border-mask">
                <div className="shine-border-glow"></div>
              </div>
              <span className="relative z-10">Build my version</span>
            </button>
          </div>

          <style jsx>{`
            .shine-button {
              position: relative;
              display: inline-block;
              padding: 8px 16px;
              border-radius: 12px;
              color: #fff;
              background: linear-gradient(to right, #7866CC, #9B7EF7, #AF97F8);
              text-decoration: none;
              font-weight: 600;
              overflow: hidden;
              backdrop-filter: blur(10px);
              transition: all 0.2s ease;
            }

            .shine-button:hover {
              background: linear-gradient(to right, #6B5BB8, #8A6EE3, #9B84E4);
              transform: translateY(-1px);
            }

            .shine-border-mask {
              position: absolute;
              inset: 0;
              border-radius: inherit;
              padding: 1px;
              mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
              -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
              mask-composite: exclude;
              -webkit-mask-composite: xor;
            }

            .shine-border-glow {
              background: conic-gradient(
                from 0deg,
                transparent 0%,
                rgba(255, 255, 255, 0.8) 10%,
                rgba(255, 255, 255, 0.4) 15%,
                transparent 20%
              );
              position: absolute;
              top: 50%;
              left: 50%;
              width: 200px;
              height: 200px;
              transform: translate(-50%, -50%);
              animation: rotateShine 4s linear infinite;
            }

            @keyframes rotateShine {
              0% {
                transform: translate(-50%, -50%) rotate(0deg);
              }
              100% {
                transform: translate(-50%, -50%) rotate(360deg);
              }
            }
          `}</style>
        </div>
      )}

      {/* Video Modal */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div 
            className="relative w-full max-w-2xl lg:max-w-4xl max-h-[80vh] bg-black rounded-lg overflow-hidden shadow-2xl mx-auto"
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(90vw, 720px)' }}
          >
            {/* Close button */}
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 z-10 w-10 h-10 bg-black/70 hover:bg-black/90 text-white rounded-full flex items-center justify-center transition-colors text-lg"
              aria-label="Close video"
            >
              ✕
            </button>
            
            {/* Video container with 16:9 aspect ratio */}
            <div className="aspect-video w-full">
              <iframe
                src={embedUrl}
                title="Demo video"
                className="w-full h-full"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}