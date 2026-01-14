// src/components/pipeline/Canvas.tsx
'use client';
import React, { useRef, useEffect, useState } from 'react';

interface CanvasProps {
  children: React.ReactNode;
  zoom: number;
  offset: { x: number; y: number };
  onOffsetChange: (offset: { x: number; y: number }) => void;
  onZoomChange: (zoom: number) => void;
  disabled?: boolean;
}

export function Canvas({ 
  children, 
  zoom, 
  offset, 
  onOffsetChange, 
  onZoomChange,
  disabled = false
}: CanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    if (e.button === 0) { // Left mouse button
      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || disabled) return;
    
    const newOffset = {
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    };
    
    onOffsetChange(newOffset);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: WheelEvent) => {
    if (disabled) return;
    
    e.preventDefault();
    
    // Mark as scrolling
    setIsScrolling(true);
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 150);
    
    // Zoom with Ctrl/Cmd + scroll
    if (e.ctrlKey || e.metaKey) {
      const delta = -e.deltaY * 0.001;
      const newZoom = Math.max(0.4, Math.min(2, zoom + delta));
      onZoomChange(newZoom);
    } else {
      // Pan with scroll
      const newOffset = {
        x: offset.x - e.deltaX,
        y: offset.y - e.deltaY,
      };
      onOffsetChange(newOffset);
    }
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragStart, offset, disabled]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('wheel', handleWheel, { passive: false });
      return () => {
        canvas.removeEventListener('wheel', handleWheel);
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
      };
    }
  }, [zoom, offset, disabled]);

  return (
    <div
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      className={`relative w-full h-full overflow-hidden bg-slate-50 ${
        isDragging ? 'cursor-grabbing' : disabled ? 'cursor-default' : 'cursor-grab'
      }`}
      style={{
        touchAction: 'none',
      }}
    >
      <div
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          transformOrigin: 'center',
          transition: (isDragging || isScrolling) ? 'none' : 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        className="w-full h-full"
      >
        {children}
      </div>
    </div>
  );
}