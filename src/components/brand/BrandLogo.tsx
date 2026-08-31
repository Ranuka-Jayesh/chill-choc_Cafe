import React from 'react';

interface BrandLogoProps {
  variant?: 'full' | 'compact' | 'icon';
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'compact',
  className = '',
  size = 'md',
}) => {
  const PandaHead = ({ s = 36 }: { s?: number }) => (
    <svg
      width={s}
      height={s}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="flex-shrink-0 drop-shadow-sm transition-transform hover:scale-105"
    >
      {/* Outer Rounded Teal Shield */}
      <rect x="4" y="4" width="92" height="92" rx="28" fill="#1FB5AE" />
      {/* Warm Cream Inner Card */}
      <rect x="9" y="9" width="82" height="82" rx="23" fill="#FFFDF9" stroke="#F8F0DF" strokeWidth="2" />
      
      {/* Golden Sparkle Glow */}
      <circle cx="50" cy="50" r="32" fill="#FEF8EC" />

      {/* Panda Ears */}
      <circle cx="32" cy="30" r="11" fill="#3D2319" />
      <circle cx="32" cy="30" r="5.5" fill="#E99343" />
      <circle cx="68" cy="30" r="11" fill="#3D2319" />
      <circle cx="68" cy="30" r="5.5" fill="#E99343" />

      {/* Head */}
      <circle cx="50" cy="50" r="28" fill="#FFFFFF" stroke="#EFE1C7" strokeWidth="2" />

      {/* Cute Angled Eye Patches */}
      <ellipse cx="37" cy="48" rx="8.5" ry="11" transform="rotate(-15 37 48)" fill="#3D2319" />
      <ellipse cx="63" cy="48" rx="8.5" ry="11" transform="rotate(15 63 48)" fill="#3D2319" />

      {/* Sparkly Eyes */}
      <circle cx="38" cy="46" r="3.5" fill="#FFFFFF" />
      <circle cx="36" cy="48.5" r="1.5" fill="#1FB5AE" />
      <circle cx="62" cy="46" r="3.5" fill="#FFFFFF" />
      <circle cx="64" cy="48.5" r="1.5" fill="#1FB5AE" />

      {/* Warm Rosy Cheeks */}
      <circle cx="28" cy="57" r="5" fill="#F3B33D" opacity="0.65" />
      <circle cx="72" cy="57" r="5" fill="#F3B33D" opacity="0.65" />

      {/* Chocolate Nose & Smile */}
      <ellipse cx="50" cy="55" rx="4" ry="2.8" fill="#875136" />
      <path d="M45 59 Q50 65 55 59" stroke="#875136" strokeWidth="2.4" strokeLinecap="round" fill="none" />

      {/* Chocolate Swirl Bow / Medallion */}
      <circle cx="50" cy="77" r="9" fill="#F3B33D" stroke="#FFFFFF" strokeWidth="1.5" />
      <path d="M46 77 C46 73, 54 73, 54 77 C54 81, 46 81, 50 78.5" stroke="#5C3528" strokeWidth="2.2" strokeLinecap="round" fill="none" />
    </svg>
  );

  if (variant === 'icon') {
    return <PandaHead s={size === 'sm' ? 32 : size === 'md' ? 42 : size === 'lg' ? 56 : 80} />;
  }

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <PandaHead s={size === 'sm' ? 36 : size === 'md' ? 42 : 50} />
        <div className="flex flex-col leading-none">
          <div className="flex items-center gap-1.5 font-black text-xl sm:text-2xl tracking-tight">
            <span className="text-brand-teal">Chill</span>
            <span className="text-brand-yellow">&</span>
            <span className="text-brand-brown-dark">Choc</span>
          </div>
          <span className="text-[10.5px] uppercase font-extrabold tracking-widest text-brand-teal mt-1">
            Cool Vibes, Sweet Bites
          </span>
        </div>
      </div>
    );
  }

  // Full Variant with badge frame
  return (
    <div className={`flex flex-col items-center text-center ${className}`}>
      <PandaHead s={size === 'xl' ? 84 : 64} />
      <div className="mt-3">
        <h1 className="flex items-center justify-center gap-2 font-black text-2xl sm:text-3xl tracking-tight">
          <span className="text-brand-teal">Chill</span>
          <span className="text-brand-yellow">&</span>
          <span className="text-brand-brown-dark">Choc</span>
        </h1>
        <p className="text-xs font-black tracking-widest uppercase text-brand-teal mt-1">
          Cool Vibes, Sweet Bites
        </p>
        <div className="inline-flex items-center gap-2 px-3.5 py-1 mt-2.5 rounded-full bg-cream-100 border border-cream-200 shadow-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-teal"></span>
          <span className="text-xs uppercase font-bold tracking-wider text-brand-brown">
            Café & Dessert Bar
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-brand-yellow"></span>
        </div>
      </div>
    </div>
  );
};
