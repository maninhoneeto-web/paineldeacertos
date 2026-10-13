import React, { useState, useEffect, useRef } from 'react';
import { 
  ZoomIn, ZoomOut, RotateCw, Maximize2, Minimize2, 
  Download, X, RefreshCw, Move 
} from 'lucide-react';

interface PhotoZoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  imagemUrl: string;
  titulo?: string;
  subtitulo?: string;
}

export const PhotoZoomModal: React.FC<PhotoZoomModalProps> = ({
  isOpen,
  onClose,
  imagemUrl,
  titulo = 'Comprovante / Foto do Acerto',
  subtitulo,
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Reset controls ao abrir
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen, imagemUrl]);

  // Tecla ESC para fechar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !imagemUrl) return null;

  const handleZoomIn = () => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)));
  const handleZoomOut = () => setZoom((z) => Math.max(0.4, +(z - 0.25).toFixed(2)));
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };
  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imagemUrl;
    link.download = `comprovante_${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-md text-white select-none animate-fadeIn"
      onMouseUp={handleMouseUp}
    >
      {/* BARRA SUPERIOR */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-slate-900/90 border-b border-slate-800 z-10">
        <div className="min-w-0 pr-4">
          <h2 className="text-sm sm:text-base font-bold truncate text-white">
            {titulo}
          </h2>
          {subtitulo && (
            <p className="text-xs text-slate-400 truncate">{subtitulo}</p>
          )}
        </div>

        {/* Ações Direitas */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownload}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            title="Baixar imagem original"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer hidden sm:block"
            title="Alternar Tela Cheia"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white transition cursor-pointer"
            title="Fechar visualizador (ESC)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ÁREA CENTRAL DE VISUALIZAÇÃO INTERATIVA COM ZOOM E DRAG */}
      <div
        className={`flex-1 relative overflow-hidden flex items-center justify-center p-4 ${
          zoom > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
        }`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
      >
        <div
          className="transition-transform duration-75 select-none"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
            transformOrigin: 'center center',
          }}
        >
          <img
            src={imagemUrl}
            alt={titulo}
            draggable={false}
            className="max-w-[85vw] max-h-[75vh] object-contain rounded-lg shadow-2xl pointer-events-none ring-1 ring-white/10"
          />
        </div>

        {/* Dica de arraste quando com zoom */}
        {zoom > 1 && (
          <div className="absolute top-4 left-4 bg-slate-900/80 border border-slate-700 text-slate-300 text-[11px] px-2.5 py-1 rounded-full flex items-center gap-1.5 backdrop-blur-xs pointer-events-none">
            <Move className="w-3 h-3 text-emerald-400" />
            <span>Clique e arraste para navegar</span>
          </div>
        )}
      </div>

      {/* BARRA FLUTUANTE INFERIOR DE CONTROLES */}
      <div className="flex items-center justify-center pb-4 pt-2 px-4 z-10">
        <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-2xl bg-slate-900/90 border border-slate-700/80 shadow-2xl backdrop-blur-md">
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer disabled:opacity-40"
            disabled={zoom <= 0.4}
            title="Diminuir zoom (-)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <span className="font-mono text-xs font-semibold px-2 min-w-[52px] text-center text-emerald-400">
            {Math.round(zoom * 100)}%
          </span>

          <button
            type="button"
            onClick={handleZoomIn}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer disabled:opacity-40"
            disabled={zoom >= 4}
            title="Aumentar zoom (+)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-slate-700 mx-1" />

          <button
            type="button"
            onClick={handleRotate}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
            title="Girar 90°"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
            title="Redefinir tamanho e posição"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
