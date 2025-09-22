'use client';

import { useState } from 'react';
import VideoNudge from './VideoNudge';

/**
 * Pawgrammer branding banner
 * Displays at the top of the application to promote Pawgrammer
 */
export default function PawgrammerBanner() {
  return (
    <>
      <style jsx>{`
        .shine-button {
          position: relative;
          display: inline-block;
          padding: 8px 16px;
          border-radius: 12px;
          color: #fff;
          background: rgba(255, 255, 255, 0.15);
          text-decoration: none;
          font-weight: 600;
          overflow: hidden;
          backdrop-filter: blur(10px);
          transition: background-color 0.2s ease;
        }

        .shine-button:hover {
          background: rgba(255, 255, 255, 0.25);
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
      <div className="relative">
        <div className="bg-gradient-to-r from-[#7866CC] via-[#9B7EF7] to-[#AF97F8] text-white">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-sm">
              <span className="font-medium">
                Built with Pawgrammer. Make it yours, give it your spin - no heavy setup.
              </span>
              <a
                href="https://pawgrammer.com"
                target="_blank"
                rel="noopener noreferrer"
                className="shine-button"
              >
                <div className="shine-border-mask">
                  <div className="shine-border-glow"></div>
                </div>
                <span className="relative z-10">Build my version</span>
              </a>
            </div>
          </div>
        </div>
        <VideoNudge url="https://youtu.be/pGNIEEcD3f8" />
      </div>
    </>
  );
}