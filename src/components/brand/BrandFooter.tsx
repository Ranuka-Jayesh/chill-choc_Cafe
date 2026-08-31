import React from 'react';

interface BrandFooterProps {
  className?: string;
}

export const BrandFooter: React.FC<BrandFooterProps> = ({ className = '' }) => {
  return (
    <footer
      className={`h-7 px-4 sm:px-6 flex items-center justify-between text-[11px] font-bold text-text-secondary/80 flex-shrink-0 select-none z-10 w-full bg-white border-t border-[#EAE3DA] ${className}`}
    >
      <div className="flex items-center gap-1.5">
        <span>Developed By</span>
        <a
          href="https://www.ogotechnology.net"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-orange hover:opacity-80 font-extrabold hover:underline transition-colors"
        >
          www.ogotechnology.net
        </a>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-brand-teal animate-pulse" />
        <span className="font-extrabold text-brand-brown-dark tracking-wide">Chill&amp;Choc V1.</span>
      </div>
    </footer>
  );
};

