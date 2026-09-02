import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { Eraser, RotateCcw } from 'lucide-react';

export interface SignaturePadRef {
  clear: () => void;
  isEmpty: () => boolean;
  getSignatureDataUrl: () => string | null;
}

interface SignaturePadCanvasProps {
  onSignatureChange?: (dataUrl: string | null, isEmpty: boolean) => void;
  strokeColor?: string;
  strokeWidth?: number;
  height?: number | string;
  className?: string;
  disabled?: boolean;
}

export const SignaturePadCanvas = forwardRef<SignaturePadRef, SignaturePadCanvasProps>(
  (
    {
      onSignatureChange,
      strokeColor = '#1e1b18',
      strokeWidth = 3,
      height = 320,
      className = '',
      disabled = false,
    },
    ref
  ) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasStrokes, setHasStrokes] = useState(false);
    const strokesHistoryRef = useRef<Array<Array<{ x: number; y: number }>>>([]);
    const currentStrokeRef = useRef<Array<{ x: number; y: number }>>([]);

    const setupCanvas = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const displayWidth = Math.floor(rect.width);
      const displayHeight = Math.floor(rect.height || (typeof height === 'number' ? height : 320));

      if (displayWidth === 0 || displayHeight === 0) return;

      canvas.width = displayWidth * dpr;
      canvas.height = displayHeight * dpr;
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        redrawStrokes();
      }
    };

    useEffect(() => {
      setupCanvas();
      const timer = setTimeout(setupCanvas, 60);

      let ro: ResizeObserver | null = null;
      if (containerRef.current && typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(() => {
          setupCanvas();
        });
        ro.observe(containerRef.current);
      }

      window.addEventListener('resize', setupCanvas);
      return () => {
        clearTimeout(timer);
        ro?.disconnect();
        window.removeEventListener('resize', setupCanvas);
      };
    }, [height]);

    const redrawStrokes = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      strokesHistoryRef.current.forEach((stroke) => {
        if (stroke.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(stroke[0].x, stroke[0].y);
        for (let i = 1; i < stroke.length; i++) {
          ctx.lineTo(stroke[i].x, stroke[i].y);
        }
        ctx.stroke();
      });
    };

    const getCanvasCoordinates = (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    };

    const startDrawing = (clientX: number, clientY: number) => {
      if (disabled) return;
      const coords = getCanvasCoordinates(clientX, clientY);
      setIsDrawing(true);
      currentStrokeRef.current = [coords];

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx) {
        ctx.beginPath();
        ctx.moveTo(coords.x, coords.y);
      }
    };

    const draw = (clientX: number, clientY: number) => {
      if (!isDrawing || disabled) return;
      const coords = getCanvasCoordinates(clientX, clientY);
      currentStrokeRef.current.push(coords);

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx) {
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();
      }
    };

    const stopDrawing = () => {
      if (!isDrawing) return;
      setIsDrawing(false);

      if (currentStrokeRef.current.length > 0) {
        strokesHistoryRef.current.push([...currentStrokeRef.current]);
        currentStrokeRef.current = [];
        setHasStrokes(true);

        const dataUrl = canvasRef.current?.toDataURL('image/png') || null;
        onSignatureChange?.(dataUrl, false);
      }
    };

    const handleClear = () => {
      strokesHistoryRef.current = [];
      currentStrokeRef.current = [];
      setHasStrokes(false);
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        if (ctx) ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      }
      onSignatureChange?.(null, true);
    };

    const handleUndo = () => {
      if (strokesHistoryRef.current.length === 0) return;
      strokesHistoryRef.current.pop();
      redrawStrokes();

      const isEmpty = strokesHistoryRef.current.length === 0;
      setHasStrokes(!isEmpty);
      const dataUrl = isEmpty ? null : getSvgVector();
      onSignatureChange?.(dataUrl, isEmpty);
    };

    const getSvgVector = () => {
      if (strokesHistoryRef.current.length === 0 || !containerRef.current) return null;
      const rect = containerRef.current.getBoundingClientRect();
      const width = Math.max(300, Math.round(rect.width) || 500);
      const height = Math.max(150, Math.round(rect.height) || 300);

      const pathStrings: string[] = [];
      strokesHistoryRef.current.forEach((stroke) => {
        if (stroke.length === 0) return;
        if (stroke.length === 1) {
          pathStrings.push(
            `M ${stroke[0].x.toFixed(1)} ${stroke[0].y.toFixed(1)} L ${(stroke[0].x + 0.5).toFixed(1)} ${(stroke[0].y + 0.5).toFixed(1)}`
          );
          return;
        }
        let d = `M ${stroke[0].x.toFixed(1)} ${stroke[0].y.toFixed(1)}`;
        for (let i = 1; i < stroke.length; i++) {
          const xc = ((stroke[i - 1].x + stroke[i].x) / 2).toFixed(1);
          const yc = ((stroke[i - 1].y + stroke[i].y) / 2).toFixed(1);
          d += ` Q ${stroke[i - 1].x.toFixed(1)} ${stroke[i - 1].y.toFixed(1)}, ${xc} ${yc}`;
        }
        d += ` L ${stroke[stroke.length - 1].x.toFixed(1)} ${stroke[stroke.length - 1].y.toFixed(1)}`;
        pathStrings.push(d);
      });

      const pathData = pathStrings.join(' ');
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"><path d="${pathData}" /></svg>`;

      return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    };

    useImperativeHandle(ref, () => ({
      clear: handleClear,
      isEmpty: () => !hasStrokes,
      getStrokes: () => [...strokesHistoryRef.current],
      getSignatureSvg: getSvgVector,
      getSignatureDataUrl: () => {
        // Return pure vector SVG data URL (ultra-sharp, scalable, 95% smaller)
        const svgVector = getSvgVector();
        if (svgVector) return svgVector;
        if (!hasStrokes || !canvasRef.current) return null;
        return canvasRef.current.toDataURL('image/png');
      },
    }));

    return (
      <div className={`relative flex-1 flex flex-col min-h-0 w-full ${className}`}>
        {/* Full Signature Canvas Container */}
        <div
          ref={containerRef}
          className={`relative flex-1 w-full rounded-2xl bg-white border-2 transition-all overflow-hidden min-h-[220px] sm:min-h-[260px] ${
            isDrawing
              ? 'border-brand-teal shadow-xs'
              : hasStrokes
              ? 'border-brand-teal/60'
              : 'border-[#EAE3DA] hover:border-brand-teal/30'
          }`}
          style={{ touchAction: 'none' }}
        >
          {/* Subtle Bottom Guideline */}
          <div className="absolute inset-x-4 bottom-6 pointer-events-none select-none border-b border-dashed border-[#EAE3DA]" />

          <canvas
            ref={canvasRef}
            className="w-full h-full cursor-crosshair relative z-10"
            onPointerDown={(e) => {
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
              startDrawing(e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
              if (isDrawing) draw(e.clientX, e.clientY);
            }}
            onPointerUp={(e) => {
              try {
                (e.target as HTMLElement).releasePointerCapture(e.pointerId);
              } catch {}
              stopDrawing();
            }}
            onPointerCancel={() => stopDrawing()}
          />

          {/* Quick Undo / Clear in top-right corner */}
          {hasStrokes && (
            <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 bg-white/90 backdrop-blur-xs p-1 rounded-xl border border-border shadow-xs">
              <button
                type="button"
                onClick={handleUndo}
                disabled={disabled}
                className="p-1.5 rounded-lg text-text-secondary hover:bg-cream-100 hover:text-brand-brown-dark transition-colors cursor-pointer"
                title="Undo last stroke"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleClear}
                disabled={disabled}
                className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                title="Clear signature"
              >
                <Eraser className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }
);
