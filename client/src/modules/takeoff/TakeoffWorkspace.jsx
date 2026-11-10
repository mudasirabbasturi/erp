import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    BiArrowBack,
    BiRuler,
    BiShapeSquare,
    BiShapePolygon,
    BiPencil,
    BiCheckCircle,
    BiCube,
    BiTargetLock,
    BiMove,
    BiZoomIn,
    BiZoomOut,
    BiReset,
    BiUpload,
    BiDownload,
    BiCog,
    BiTrash,
    BiSave,
    BiLoaderAlt,
    BiPlus,
    BiLayer,
    BiCalculator,
    BiFullscreen,
    BiFolderOpen,
    BiImages,
    BiImage,
    BiX
} from 'react-icons/bi';
import takeoffApi from './takeoffApi';
import { useToast } from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal/Modal';
import MediaPickerModal from '../../components/MediaPicker/MediaPickerModal';
import { getMediaUrl } from '../../utils/media';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';
import styles from './TakeoffWorkspace.module.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const TOOL_COLORS = {
    rect: '#3b82f6',
    polygon: '#f59e0b',
    line: '#10b981',
    count: '#ef4444',
    volume: '#8b5cf6'
};

const TakeoffWorkspace = () => {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const toast = useToast();

    // Session & Blueprint state
    const [sessionData, setSessionData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [blueprints, setBlueprints] = useState([]);
    const [activeBlueprint, setActiveBlueprint] = useState(null);
    const [activePage, setActivePage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [measurements, setMeasurements] = useState([]);
    const [assemblies, setAssemblies] = useState([]);
    const [scales, setScales] = useState([]);
    const [selectedMeasurementId, setSelectedMeasurementId] = useState(null);

    // Active tool state
    const [activeTool, setActiveTool] = useState('rect'); // 'select' | 'rect' | 'line' | 'polygon' | 'count' | 'volume' | 'calibrate' | 'pan'
    const [activeTab, setActiveTab] = useState('quantities'); // 'quantities' | 'assemblies' | 'totals'

    // Canvas & Viewport Transform state (Zoom & Pan)
    const [zoom, setZoom] = useState(1.0);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });

    // Drawing state
    const [currentPoints, setCurrentPoints] = useState([]);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [isDrawing, setIsDrawing] = useState(false);
    const [canvasRevision, setCanvasRevision] = useState(0);
    const [blueprintRendering, setBlueprintRendering] = useState(false);
    const [activeSnap, setActiveSnap] = useState(null);

    // Mouse drag & interaction refs
    const isMouseDownRef = useRef(false);
    const dragStartRef = useRef(null);
    const hasDraggedRef = useRef(false);
    const shiftKeyRef = useRef(false);

    // Modals
    const [calibrateModal, setCalibrateModal] = useState({ open: false, points: null, pixelDistance: 0, realDistance: 10, unit: 'ft' });
    const [assemblyModal, setAssemblyModal] = useState({ open: false, name: '', unit: 'sq ft', unit_cost: 5.0, waste_factor: 10, labor_rate: 1.0 });
    const [uploadModal, setUploadModal] = useState(false);
    const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Canvas references
    const containerRef = useRef(null);
    const bgCanvasRef = useRef(null);
    const drawCanvasRef = useRef(null);
    const bgImageRef = useRef(null);

    // Load full session workspace data
    const loadSession = useCallback(async () => {
        try {
            setLoading(true);
            const res = await takeoffApi.getSession(sessionId);
            if (res.success && res.data) {
                setSessionData(res.data.session);
                setMeasurements(res.data.measurements || []);
                setAssemblies(res.data.assemblies || []);
                setScales(res.data.scales || []);

                if (res.data.blueprints && res.data.blueprints.length > 0) {
                    setBlueprints(res.data.blueprints);
                    setActiveBlueprint(res.data.blueprints[0]);
                }
            } else {
                toast.error('Error', res.message || 'Failed to load takeoff session');
            }
        } catch (err) {
            toast.error('Load Failed', err.message);
        } finally {
            setLoading(false);
        }
    }, [sessionId, toast]);

    useEffect(() => {
        loadSession();
    }, [loadSession]);

    // Active scale resolution
    const activeScale = scales.find(s => s.is_default) || scales[0] || { pixels_per_unit: 100, unit: 'ft' };

    // Attach non-passive wheel listener to allow smooth zooming without browser warning
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const onWheel = (e) => {
            e.preventDefault();
            const zoomDelta = e.deltaY < 0 ? 1.15 : 0.85;
            setZoom((prev) => Math.min(Math.max(prev * zoomDelta, 0.15), 5.0));
        };

        el.addEventListener('wheel', onWheel, { passive: false });
        return () => {
            el.removeEventListener('wheel', onWheel);
        };
    }, []);

    // Load background blueprint image or PDF drawing
    useEffect(() => {
        if (!activeBlueprint) {
            bgImageRef.current = null;
            setCanvasRevision(r => r + 1);
            return;
        }

        const isPdf = activeBlueprint.mime_type === 'application/pdf' ||
                      (activeBlueprint.storage_path && activeBlueprint.storage_path.toLowerCase().endsWith('.pdf')) ||
                      (activeBlueprint.original_filename && activeBlueprint.original_filename.toLowerCase().endsWith('.pdf'));

        const fileUrl = getMediaUrl(activeBlueprint.storage_path);
        let isCancelled = false;
        setBlueprintRendering(true);

        const autoFitBlueprint = (w, h) => {
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                const scaleX = (rect.width - 60) / w;
                const scaleY = (rect.height - 60) / h;
                const autoScale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.15), 1.25);
                setZoom(Number(autoScale.toFixed(2)));
                setPan({
                    x: Math.max(20, Math.round((rect.width - w * autoScale) / 2)),
                    y: Math.max(20, Math.round((rect.height - h * autoScale) / 2))
                });
            }
        };

        if (isPdf) {
            const loadingTask = pdfjsLib.getDocument({
                url: fileUrl,
                cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
                cMapPacked: true,
            });

            loadingTask.promise.then(async (pdf) => {
                if (isCancelled) return;
                setTotalPages(pdf.numPages);
                const pageNum = Math.min(Math.max(activePage, 1), pdf.numPages);
                const page = await pdf.getPage(pageNum);
                if (isCancelled) return;

                // Render at high-definition 2.0x scale for crisp blueprints
                const viewport = page.getViewport({ scale: 2.0 });
                const offscreen = document.createElement('canvas');
                offscreen.width = Math.round(viewport.width);
                offscreen.height = Math.round(viewport.height);
                const offCtx = offscreen.getContext('2d');

                await page.render({
                    canvasContext: offCtx,
                    viewport: viewport
                }).promise;

                if (isCancelled) return;

                bgImageRef.current = offscreen;

                if (bgCanvasRef.current && drawCanvasRef.current) {
                    bgCanvasRef.current.width = Math.round(viewport.width);
                    bgCanvasRef.current.height = Math.round(viewport.height);
                    drawCanvasRef.current.width = Math.round(viewport.width);
                    drawCanvasRef.current.height = Math.round(viewport.height);
                    autoFitBlueprint(viewport.width, viewport.height);
                    setCanvasRevision(r => r + 1);
                }
            }).catch(err => {
                if (isCancelled) return;
                console.error('Failed to render PDF blueprint:', err);
                bgImageRef.current = null;
                toast.error('PDF Preview Error', `Could not render PDF drawing (${err.message || 'Check file format'})`);
            }).finally(() => {
                if (!isCancelled) setBlueprintRendering(false);
            });

            return () => {
                isCancelled = true;
                loadingTask.destroy();
            };
        } else {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                if (isCancelled) return;
                bgImageRef.current = img;
                const w = img.naturalWidth || img.width;
                const h = img.naturalHeight || img.height;
                if (bgCanvasRef.current && drawCanvasRef.current) {
                    bgCanvasRef.current.width = w;
                    bgCanvasRef.current.height = h;
                    drawCanvasRef.current.width = w;
                    drawCanvasRef.current.height = h;
                    autoFitBlueprint(w, h);
                    setCanvasRevision(r => r + 1);
                }
                setBlueprintRendering(false);
            };
            img.onerror = (e) => {
                if (isCancelled) return;
                console.warn('Image blueprint failed to load from:', fileUrl, e);
                bgImageRef.current = null;
                setBlueprintRendering(false);
                toast.error('Image Preview Error', 'Could not display blueprint image. Please check file path.');
            };
            img.src = fileUrl;

            return () => {
                isCancelled = true;
            };
        }
    }, [activeBlueprint, activePage]);

    // Math helpers for hit testing & selection
    const distToSegment = (p, a, b) => {
        const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
        if (l2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
        let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(p.x - (a.x + t * (b.x - a.x)), p.y - (a.y + t * (b.y - a.y)));
    };

    const isPointInPolygon = (pt, vs) => {
        let inside = false;
        for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
            const xi = vs[i].x, yi = vs[i].y;
            const xj = vs[j].x, yj = vs[j].y;
            const intersect = ((yi > pt.y) !== (yj > pt.y)) &&
                (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    };

    // Collect all vertex/corner snap points from existing measurements
    const snapTargets = useMemo(() => {
        const points = [];
        measurements.forEach(m => {
            const g = m.geometry;
            if (!g) return;
            if (m.type === 'rect' && g.width && g.height) {
                points.push({ x: g.x, y: g.y, label: 'Corner' });
                points.push({ x: g.x + g.width, y: g.y, label: 'Corner' });
                points.push({ x: g.x + g.width, y: g.y + g.height, label: 'Corner' });
                points.push({ x: g.x, y: g.y + g.height, label: 'Corner' });
                points.push({ x: Math.round(g.x + g.width / 2), y: g.y, label: 'Midpoint' });
                points.push({ x: Math.round(g.x + g.width / 2), y: g.y + g.height, label: 'Midpoint' });
                points.push({ x: g.x, y: Math.round(g.y + g.height / 2), label: 'Midpoint' });
                points.push({ x: g.x + g.width, y: Math.round(g.y + g.height / 2), label: 'Midpoint' });
            } else if (Array.isArray(g)) {
                g.forEach((p, idx) => points.push({ x: p.x, y: p.y, label: `Corner ${idx + 1}` }));
            } else if (g.points && Array.isArray(g.points)) {
                g.points.forEach((p, idx) => points.push({ x: p.x, y: p.y, label: `Corner ${idx + 1}` }));
            }
        });
        return points;
    }, [measurements]);

    // Convert screen coordinates to canvas image coordinates with Magnetic Snapping
    const getBlueprintCoords = useCallback((e) => {
        if (!containerRef.current) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;

        // Invert pan & zoom
        let rawX = Math.round((screenX - pan.x) / zoom);
        let rawY = Math.round((screenY - pan.y) / zoom);

        // Check magnetic corner snap if drawing tool is active
        const snapThreshold = Math.max(16, 20 / zoom);
        let bestSnap = null;
        let minDist = snapThreshold;

        // 1. Check closing snap for active polygon/volume
        if (['polygon', 'volume'].includes(activeTool) && isDrawing && currentPoints.length >= 3) {
            const p0 = currentPoints[0];
            const d0 = Math.hypot(rawX - p0.x, rawY - p0.y);
            if (d0 < 24 / zoom) {
                bestSnap = { x: p0.x, y: p0.y, type: 'close', label: 'Close Shape' };
                minDist = d0;
            }
        }

        // 2. Check existing measurement corners
        if (!bestSnap && ['line', 'rect', 'polygon', 'volume', 'calibrate'].includes(activeTool)) {
            for (const sp of snapTargets) {
                const dist = Math.hypot(rawX - sp.x, rawY - sp.y);
                if (dist < minDist) {
                    minDist = dist;
                    bestSnap = { x: sp.x, y: sp.y, type: 'corner', label: sp.label };
                }
            }
        }

        // 3. Orthogonal snapping for lines / calibrate if Shift held or near 90/180/270
        if (isDrawing && currentPoints.length > 0 && ['line', 'calibrate'].includes(activeTool)) {
            const start = currentPoints[currentPoints.length - 1];
            const dx = Math.abs(rawX - start.x);
            const dy = Math.abs(rawY - start.y);
            if (e.shiftKey || dx < 12 || dy < 12) {
                if (dx > dy) {
                    rawY = start.y;
                } else {
                    rawX = start.x;
                }
            }
        }

        if (bestSnap) {
            setActiveSnap(bestSnap);
            return { x: bestSnap.x, y: bestSnap.y, snapped: true };
        } else {
            setActiveSnap(null);
            return { x: rawX, y: rawY, snapped: false };
        }
    }, [pan, zoom, activeTool, isDrawing, currentPoints, snapTargets]);

    // Render Static Background Canvas (Only on image/page load or resize)
    const renderBackground = useCallback(() => {
        const bgCanvas = bgCanvasRef.current;
        if (!bgCanvas) return;
        const bgCtx = bgCanvas.getContext('2d');
        const width = bgCanvas.width;
        const height = bgCanvas.height;

        bgCtx.clearRect(0, 0, width, height);

        if (bgImageRef.current) {
            bgCtx.drawImage(bgImageRef.current, 0, 0, width, height);
        } else {
            // High-precision blueprint dark architectural grid
            bgCtx.fillStyle = '#0f172a';
            bgCtx.fillRect(0, 0, width, height);

            bgCtx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
            bgCtx.lineWidth = 1;
            const gridSize = 50;
            for (let x = 0; x < width; x += gridSize) {
                bgCtx.beginPath();
                bgCtx.moveTo(x, 0);
                bgCtx.lineTo(x, height);
                bgCtx.stroke();
            }
            for (let y = 0; y < height; y += gridSize) {
                bgCtx.beginPath();
                bgCtx.moveTo(0, y);
                bgCtx.lineTo(width, y);
                bgCtx.stroke();
            }

            bgCtx.fillStyle = '#64748b';
            bgCtx.font = '14px system-ui, -apple-system, sans-serif';
            bgCtx.textAlign = 'center';
            bgCtx.fillText('Architectural Takeoff Grid (Upload a plan or click "⚡ Sample Plan" above)', width / 2, 40);
        }
    }, [canvasRevision]);

    useEffect(() => {
        renderBackground();
    }, [renderBackground]);

    // Canvas Svgator-style Handle Helper
    const drawHandle = (ctx, x, y, isSelected = false) => {
        ctx.save();
        ctx.fillStyle = isSelected ? '#3b82f6' : '#ffffff';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.rect(x - 4, y - 4, 8, 8);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    };

    // Canvas Snap Marker Helper
    const drawSnapMarker = (ctx, snap) => {
        ctx.save();
        const color = snap.type === 'close' ? '#ec4899' : '#10b981';
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        // Snap Box
        ctx.strokeRect(snap.x - 7, snap.y - 7, 14, 14);
        // Crosshair
        ctx.beginPath();
        ctx.moveTo(snap.x - 11, snap.y);
        ctx.lineTo(snap.x + 11, snap.y);
        ctx.moveTo(snap.x, snap.y - 11);
        ctx.lineTo(snap.x, snap.y + 11);
        ctx.stroke();

        // Snap Tag
        ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = color;
        ctx.fillText(snap.label || 'Corner', snap.x + 12, snap.y + 4);
        ctx.restore();
    };

    // Canvas Pin Drawing Helper
    const drawPin = (ctx, x, y, number, color) => {
        ctx.save();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(number), x, y);
        ctx.restore();
    };

    // Canvas Badge Drawing Helper
    const drawBadge = (ctx, x, y, text, color) => {
        ctx.save();
        ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
        const textWidth = ctx.measureText(text).width;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x - 4, y - 12, textWidth + 12, 18, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(text, x + 2, y + 1);
        ctx.restore();
    };

    // Fast Dynamic Overlay Render Loop (Draws ONLY on drawCanvas in < 0.2ms)
    const renderOverlay = useCallback(() => {
        const drawCanvas = drawCanvasRef.current;
        if (!drawCanvas) return;
        const drawCtx = drawCanvas.getContext('2d');
        const width = drawCanvas.width;
        const height = drawCanvas.height;

        drawCtx.clearRect(0, 0, width, height);

        // 1. Render Existing Saved Measurements
        measurements.forEach(m => {
            const isSelected = m.id === selectedMeasurementId;
            const geom = m.geometry;
            if (!geom) return;
            const color = m.color || '#4f46e5';

            drawCtx.save();
            drawCtx.lineWidth = isSelected ? 3 : 2;
            drawCtx.strokeStyle = color;
            drawCtx.fillStyle = color + (isSelected ? '44' : '26');

            if (m.type === 'rect') {
                if (geom.width && geom.height) {
                    drawCtx.strokeRect(geom.x, geom.y, geom.width, geom.height);
                    drawCtx.fillRect(geom.x, geom.y, geom.width, geom.height);
                    drawBadge(drawCtx, geom.x + 8, geom.y + 18, `${m.label}: ${m.computed_quantity} ${m.unit}²`, color);

                    if (isSelected) {
                        drawHandle(drawCtx, geom.x, geom.y, true);
                        drawHandle(drawCtx, geom.x + geom.width, geom.y, true);
                        drawHandle(drawCtx, geom.x + geom.width, geom.y + geom.height, true);
                        drawHandle(drawCtx, geom.x, geom.y + geom.height, true);
                    }
                }
            } else if (m.type === 'line') {
                const pts = Array.isArray(geom) ? geom : (geom.points || []);
                if (pts.length >= 2) {
                    drawCtx.beginPath();
                    drawCtx.moveTo(pts[0].x, pts[0].y);
                    for (let i = 1; i < pts.length; i++) {
                        drawCtx.lineTo(pts[i].x, pts[i].y);
                    }
                    drawCtx.stroke();

                    pts.forEach(p => {
                        drawCtx.fillStyle = color;
                        drawCtx.beginPath();
                        drawCtx.arc(p.x, p.y, 4, 0, Math.PI * 2);
                        drawCtx.fill();
                        if (isSelected) drawHandle(drawCtx, p.x, p.y, true);
                    });
                    drawBadge(drawCtx, pts[0].x + 8, pts[0].y - 8, `${m.label}: ${m.computed_quantity} ${m.unit}`, color);
                }
            } else if (m.type === 'polygon' || m.type === 'volume') {
                const pts = Array.isArray(geom) ? geom : (geom.points || []);
                if (pts.length >= 3) {
                    drawCtx.beginPath();
                    drawCtx.moveTo(pts[0].x, pts[0].y);
                    for (let i = 1; i < pts.length; i++) {
                        drawCtx.lineTo(pts[i].x, pts[i].y);
                    }
                    drawCtx.closePath();
                    drawCtx.stroke();
                    drawCtx.fill();

                    const unitSuffix = m.type === 'volume' ? `${m.unit}³` : `${m.unit}²`;
                    drawBadge(drawCtx, pts[0].x + 8, pts[0].y + 18, `${m.label}: ${m.computed_quantity} ${unitSuffix}`, color);

                    if (isSelected) {
                        pts.forEach(p => drawHandle(drawCtx, p.x, p.y, true));
                    }
                }
            } else if (m.type === 'count') {
                const pts = Array.isArray(geom) ? geom : (geom.points || []);
                pts.forEach((p, idx) => {
                    drawPin(drawCtx, p.x, p.y, idx + 1, color);
                });
            }

            drawCtx.restore();
        });

        // 2. Render Live In-Progress Drawing (Svgator / CAD style)
        if (isDrawing && currentPoints.length > 0) {
            drawCtx.save();
            const liveColor = TOOL_COLORS[activeTool] || '#6366f1';
            drawCtx.strokeStyle = liveColor;
            drawCtx.lineWidth = 2;
            drawCtx.setLineDash([5, 5]);

            if (activeTool === 'rect' && currentPoints.length === 1) {
                const start = currentPoints[0];
                const w = mousePos.x - start.x;
                const h = mousePos.y - start.y;
                drawCtx.strokeRect(start.x, start.y, w, h);
                drawCtx.fillStyle = liveColor + '25';
                drawCtx.fillRect(start.x, start.y, w, h);

                // Live Svgator Corner Handles
                drawHandle(drawCtx, start.x, start.y);
                drawHandle(drawCtx, mousePos.x, start.y);
                drawHandle(drawCtx, mousePos.x, mousePos.y);
                drawHandle(drawCtx, start.x, mousePos.y);

                // Dimension hint
                const ppu = activeScale.pixels_per_unit || 100;
                const areaReal = (Math.abs(w) * Math.abs(h)) / (ppu * ppu);
                const wFt = (Math.abs(w) / ppu).toFixed(1);
                const hFt = (Math.abs(h) / ppu).toFixed(1);
                drawBadge(drawCtx, mousePos.x + 12, mousePos.y + 12, `${wFt}' × ${hFt}' = ${areaReal.toFixed(2)} ${activeScale.unit}²`, liveColor);
            } else if (['line', 'polygon', 'volume', 'calibrate'].includes(activeTool)) {
                drawCtx.beginPath();
                drawCtx.moveTo(currentPoints[0].x, currentPoints[0].y);
                for (let i = 1; i < currentPoints.length; i++) {
                    drawCtx.lineTo(currentPoints[i].x, currentPoints[i].y);
                }
                drawCtx.lineTo(mousePos.x, mousePos.y);

                if (['polygon', 'volume'].includes(activeTool)) {
                    drawCtx.closePath();
                    drawCtx.fillStyle = liveColor + '20';
                    drawCtx.fill();
                }
                drawCtx.stroke();

                // Live corner handles
                currentPoints.forEach(p => drawHandle(drawCtx, p.x, p.y));

                // Live distance/length
                const lastPt = currentPoints[currentPoints.length - 1];
                const dx = mousePos.x - lastPt.x;
                const dy = mousePos.y - lastPt.y;
                const distPx = Math.hypot(dx, dy);
                const distReal = distPx / (activeScale.pixels_per_unit || 100);
                drawBadge(drawCtx, mousePos.x + 14, mousePos.y - 12, `${distReal.toFixed(2)} ${activeScale.unit}`, liveColor);
            }

            drawCtx.restore();
        }

        // 3. Render Active Magnetic Snap Target Indicator
        if (activeSnap) {
            drawSnapMarker(drawCtx, activeSnap);
        }
    }, [measurements, selectedMeasurementId, isDrawing, currentPoints, mousePos, activeTool, activeScale, activeSnap]);

    useEffect(() => {
        renderOverlay();
    }, [renderOverlay]);

    // Drawing Commit Helpers
    const commitRectangle = (start, end) => {
        const width = end.x - start.x;
        const height = end.y - start.y;
        if (Math.abs(width) > 6 && Math.abs(height) > 6) {
            const rectGeom = {
                x: Math.min(start.x, end.x),
                y: Math.min(start.y, end.y),
                width: Math.abs(width),
                height: Math.abs(height)
            };
            saveNewMeasurement({
                type: 'rect',
                geometry: rectGeom,
                label: `Area #${measurements.filter(m => m.type === 'rect').length + 1}`,
                color: TOOL_COLORS.rect
            });
        }
        setIsDrawing(false);
        setCurrentPoints([]);
        setActiveSnap(null);
    };

    const commitLine = (start, end) => {
        const dist = Math.hypot(end.x - start.x, end.y - start.y);
        if (dist > 6) {
            saveNewMeasurement({
                type: 'line',
                geometry: [start, end],
                label: `Linear #${measurements.filter(m => m.type === 'line').length + 1}`,
                color: TOOL_COLORS.line
            });
        }
        setIsDrawing(false);
        setCurrentPoints([]);
        setActiveSnap(null);
    };

    const commitPolygon = (points) => {
        if (points.length >= 3) {
            saveNewMeasurement({
                type: activeTool,
                geometry: points,
                depth: activeTool === 'volume' ? 1.0 : null,
                label: `${activeTool === 'volume' ? 'Volume' : 'Area'} #${measurements.length + 1}`,
                color: TOOL_COLORS[activeTool]
            });
        }
        setIsDrawing(false);
        setCurrentPoints([]);
        setActiveSnap(null);
    };

    const openCalibrationModal = (start, end) => {
        const pxDist = Math.hypot(end.x - start.x, end.y - start.y);
        if (pxDist > 5) {
            setCalibrateModal({
                open: true,
                points: [start, end],
                pixelDistance: Math.round(pxDist),
                realDistance: 10,
                unit: activeScale.unit || 'ft'
            });
        }
        setIsDrawing(false);
        setCurrentPoints([]);
        setActiveSnap(null);
        setActiveTool('select');
    };

    // Pointer Event Handlers (Supports both Drag-and-Release & Click-Click)
    const handleMouseDown = (e) => {
        if (activeTool === 'pan' || e.button === 1 || e.spaceKey) {
            setIsPanning(true);
            setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
            return;
        }

        if (e.button !== 0) return; // Left click only
        const pt = getBlueprintCoords(e);
        dragStartRef.current = pt;
        isMouseDownRef.current = true;
        hasDraggedRef.current = false;

        if (activeTool === 'select') {
            const clicked = measurements.find(m => {
                const g = m.geometry;
                if (!g) return false;
                if (m.type === 'rect') {
                    return pt.x >= g.x && pt.x <= g.x + g.width && pt.y >= g.y && pt.y <= g.y + g.height;
                }
                if (m.type === 'line') {
                    const pts = Array.isArray(g) ? g : (g.points || []);
                    for (let i = 0; i < pts.length - 1; i++) {
                        if (distToSegment(pt, pts[i], pts[i+1]) < 12) return true;
                    }
                }
                if (['polygon', 'volume'].includes(m.type)) {
                    const pts = Array.isArray(g) ? g : (g.points || []);
                    return isPointInPolygon(pt, pts);
                }
                if (m.type === 'count') {
                    const pts = Array.isArray(g) ? g : [g];
                    return pts.some(p => Math.hypot(pt.x - p.x, pt.y - p.y) < 16);
                }
                return false;
            });
            setSelectedMeasurementId(clicked ? clicked.id : null);
            return;
        }

        if (activeTool === 'count') {
            saveNewMeasurement({
                type: 'count',
                geometry: [pt],
                label: `Point #${measurements.length + 1}`,
                color: TOOL_COLORS.count
            });
            return;
        }

        if (activeTool === 'rect') {
            if (!isDrawing) {
                setIsDrawing(true);
                setCurrentPoints([pt]);
            } else {
                commitRectangle(currentPoints[0], pt);
            }
            return;
        }

        if (activeTool === 'line') {
            if (!isDrawing) {
                setIsDrawing(true);
                setCurrentPoints([pt]);
            } else {
                commitLine(currentPoints[0], pt);
            }
            return;
        }

        if (['polygon', 'volume'].includes(activeTool)) {
            if (!isDrawing) {
                setIsDrawing(true);
                setCurrentPoints([pt]);
            } else {
                const firstPt = currentPoints[0];
                const distToFirst = Math.hypot(pt.x - firstPt.x, pt.y - firstPt.y);
                if ((distToFirst < 20 || activeSnap?.type === 'close') && currentPoints.length >= 3) {
                    commitPolygon(currentPoints);
                } else {
                    setCurrentPoints(prev => [...prev, pt]);
                }
            }
            return;
        }

        if (activeTool === 'calibrate') {
            if (!isDrawing) {
                setIsDrawing(true);
                setCurrentPoints([pt]);
            } else {
                openCalibrationModal(currentPoints[0], pt);
            }
        }
    };

    const handleMouseMove = (e) => {
        if (isPanning) {
            setPan({
                x: e.clientX - panStart.x,
                y: e.clientY - panStart.y
            });
            return;
        }

        const pt = getBlueprintCoords(e);
        setMousePos(pt);

        if (isMouseDownRef.current && dragStartRef.current) {
            const dist = Math.hypot(pt.x - dragStartRef.current.x, pt.y - dragStartRef.current.y);
            if (dist > 8) {
                hasDraggedRef.current = true;
            }
        }
    };

    const handleMouseUp = (e) => {
        if (isPanning) {
            setIsPanning(false);
            return;
        }

        const pt = getBlueprintCoords(e);

        if (isMouseDownRef.current && hasDraggedRef.current && dragStartRef.current) {
            const start = dragStartRef.current;
            if (activeTool === 'rect') {
                commitRectangle(start, pt);
            } else if (activeTool === 'line') {
                commitLine(start, pt);
            } else if (activeTool === 'calibrate') {
                openCalibrationModal(start, pt);
            }
        }

        isMouseDownRef.current = false;
        dragStartRef.current = null;
        hasDraggedRef.current = false;
    };

    const handleDoubleClick = () => {
        if (!isDrawing || currentPoints.length < 2) return;
        if (activeTool === 'line') {
            commitLine(currentPoints[0], currentPoints[currentPoints.length - 1]);
        } else if (['polygon', 'volume'].includes(activeTool) && currentPoints.length >= 3) {
            commitPolygon(currentPoints);
        }
    };

    // Keyboard Shortcuts (CAD & Svgator style)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

            if (e.key === 'Escape') {
                if (isDrawing) {
                    setIsDrawing(false);
                    setCurrentPoints([]);
                    setActiveSnap(null);
                } else if (selectedMeasurementId) {
                    setSelectedMeasurementId(null);
                }
            } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedMeasurementId) {
                deleteMeasurement(selectedMeasurementId);
            } else if (e.key === 'Enter' && isDrawing && ['polygon', 'volume'].includes(activeTool) && currentPoints.length >= 3) {
                commitPolygon(currentPoints);
            } else if (e.key.toLowerCase() === 'v') {
                setActiveTool('select');
            } else if (e.key.toLowerCase() === 'h' || e.key === ' ') {
                setActiveTool('pan');
            } else if (e.key.toLowerCase() === 'r') {
                setActiveTool('rect');
            } else if (e.key.toLowerCase() === 'p') {
                setActiveTool('polygon');
            } else if (e.key.toLowerCase() === 'l') {
                setActiveTool('line');
            } else if (e.key.toLowerCase() === 'c') {
                setActiveTool('count');
            } else if (e.key.toLowerCase() === 'o') {
                setActiveTool('volume');
            } else if (e.key.toLowerCase() === 's') {
                setActiveTool('calibrate');
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isDrawing, selectedMeasurementId, activeTool, currentPoints]);

    // Save newly drawn measurement via API
    const saveNewMeasurement = async (item) => {
        try {
            setSaving(true);
            const payload = {
                ...item,
                page_number: activePage,
                scale_id: activeScale.id || null,
                blueprint_id: activeBlueprint ? activeBlueprint.id : null
            };

            const res = await takeoffApi.batchSaveMeasurements(sessionId, [payload]);
            if (res.success && res.data && res.data[0]) {
                setMeasurements(prev => [...prev, res.data[0]]);
                toast.success('Measured', `Added ${res.data[0].label} (${res.data[0].computed_quantity} ${res.data[0].unit})`);
            }
        } catch (err) {
            toast.error('Save Failed', err.message);
        } finally {
            setSaving(false);
        }
    };

    // Delete single measurement
    const deleteMeasurement = async (id) => {
        try {
            const res = await takeoffApi.deleteMeasurement(id);
            if (res.success) {
                setMeasurements(prev => prev.filter(m => m.id !== id));
                if (selectedMeasurementId === id) setSelectedMeasurementId(null);
                toast.success('Deleted', 'Measurement removed');
            }
        } catch (err) {
            toast.error('Delete Failed', err.message);
        }
    };

    // Calibrate Scale Submit
    const handleApplyCalibration = async (e) => {
        e.preventDefault();
        try {
            const res = await takeoffApi.calibrateScale(sessionId, {
                point_a: calibrateModal.points[0],
                point_b: calibrateModal.points[1],
                real_distance: calibrateModal.realDistance,
                unit: calibrateModal.unit,
                is_default: 1
            });

            if (res.success && res.data) {
                setScales(prev => [res.data, ...prev.map(s => ({ ...s, is_default: 0 }))]);
                setCalibrateModal(prev => ({ ...prev, open: false }));
                toast.success('Scale Calibrated', `${calibrateModal.realDistance} ${calibrateModal.unit} = ${res.data.pixels_per_unit} px`);
                // reload measurements to reflect new server calculations
                loadSession();
            }
        } catch (err) {
            toast.error('Calibration Failed', err.message);
        }
    };

    // Save New Assembly
    const handleCreateAssembly = async (e) => {
        e.preventDefault();
        try {
            const res = await takeoffApi.saveAssembly(sessionId, assemblyModal);
            if (res.success && res.data) {
                setAssemblies(prev => [...prev, res.data]);
                setAssemblyModal({ open: false, name: '', unit: 'sq ft', unit_cost: 5.0, waste_factor: 10, labor_rate: 1.0 });
                toast.success('Assembly Created', res.data.name);
            }
        } catch (err) {
            toast.error('Assembly Save Failed', err.message);
        }
    };

    // Link Assembly to Measurement
    const handleLinkAssembly = async (measurementId, assemblyId) => {
        try {
            const res = await takeoffApi.linkAssembly(measurementId, assemblyId);
            if (res.success) {
                const targetAsm = assemblies.find(a => a.id === parseInt(assemblyId));
                setMeasurements(prev => prev.map(m => {
                    if (m.id === measurementId) {
                        const unitCost = targetAsm ? parseFloat(targetAsm.unit_cost) : 0;
                        const waste = targetAsm ? parseFloat(targetAsm.waste_factor) : 0;
                        const labor = targetAsm ? parseFloat(targetAsm.labor_rate) : 0;
                        const lineTotal = (m.computed_quantity * unitCost * (1 + waste / 100)) + labor;
                        return {
                            ...m,
                            assembly_id: assemblyId || null,
                            assembly_name: targetAsm ? targetAsm.name : null,
                            line_total: lineTotal
                        };
                    }
                    return m;
                }));
                toast.success('Assembly Linked', 'Line total cost updated');
            }
        } catch (err) {
            toast.error('Link Failed', err.message);
        }
    };

    // Export Estimate
    const handleExport = async (format = 'csv') => {
        try {
            const res = await takeoffApi.exportSession(sessionId, format);
            if (res.success && res.data.download_url) {
                window.open(res.data.download_url, '_blank');
                toast.success('Export Ready', `Downloaded ${res.data.filename}`);
            }
        } catch (err) {
            toast.error('Export Failed', err.message);
        }
    };

    // Blueprint File Upload
    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            setUploading(true);
            const res = await takeoffApi.uploadBlueprint(sessionId, file);
            if (res.success && res.data) {
                setBlueprints(prev => [res.data, ...prev]);
                setActiveBlueprint(res.data);
                setUploadModal(false);
                toast.success('Blueprint Uploaded', `${file.name} saved to project folder & Media Library`);
            }
        } catch (err) {
            toast.error('Upload Failed', err.message);
        } finally {
            setUploading(false);
        }
    };

    // Link file from ERP Media Library
    const handleSelectFromMedia = async (mediaItem) => {
        try {
            setUploading(true);
            const res = await takeoffApi.selectBlueprintFromMedia(sessionId, mediaItem.id);
            if (res.success && res.data) {
                setBlueprints(prev => [res.data, ...prev]);
                setActiveBlueprint(res.data);
                setMediaPickerOpen(false);
                setUploadModal(false);
                toast.success('Blueprint Attached', `${mediaItem.original_name} selected from Media Library`);
            }
        } catch (err) {
            toast.error('Failed to attach media', err.message);
        } finally {
            setUploading(false);
        }
    };

    // Load pre-calibrated sample architectural blueprint
    const handleLoadSampleBlueprint = async () => {
        try {
            setUploading(true);
            const res = await takeoffApi.loadSampleBlueprint(sessionId);
            if (res.success && res.data) {
                const sampleBp = res.data;
                setBlueprints(prev => {
                    const exists = prev.some(b => b.id === sampleBp.id);
                    return exists ? prev : [sampleBp, ...prev];
                });
                setActiveBlueprint(sampleBp);
                setActivePage(1);
                setUploadModal(false);
                toast.success('Sample Blueprint Loaded', 'Commercial Building Footprint & Floor Plan (calibrated at 10px = 1ft)');
                loadSession();
            }
        } catch (err) {
            toast.error('Sample Failed', err.message);
        } finally {
            setUploading(false);
        }
    };

    // Exit fullscreen or close tab
    const handleExit = () => {
        if (window.opener) {
            window.close();
        } else if (sessionData?.project_id) {
            navigate(`/projects/view/${sessionData.project_id}`);
        } else {
            navigate('/takeoff');
        }
    };

    // Toggle full browser screen mode
    const toggleFullScreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen().catch(() => {});
        }
    };

    // Calculate totals on the fly
    const grandTotalCost = measurements.reduce((sum, m) => sum + (m.line_total || 0), 0);
    const totalArea = measurements.filter(m => ['rect', 'polygon'].includes(m.type)).reduce((sum, m) => sum + parseFloat(m.computed_quantity || 0), 0);
    const totalLinear = measurements.filter(m => m.type === 'line').reduce((sum, m) => sum + parseFloat(m.computed_quantity || 0), 0);
    const totalCounts = measurements.filter(m => m.type === 'count').reduce((sum, m) => sum + (Array.isArray(m.geometry) ? m.geometry.length : 1), 0);

    return (
        <div className={styles.workspaceContainer}>
            {/* Top Toolbar */}
            <header className={styles.topToolbar}>
                <div className={styles.toolbarSection}>
                    <button
                        type="button"
                        onClick={handleExit}
                        className={styles.backBtn}
                        title="Close / Exit Workspace"
                    >
                        <BiX size={17} /> Exit Workspace
                    </button>

                    <div className={styles.sessionTitleGroup}>
                        <span className={styles.sessionTitle} title={sessionData?.name}>
                            {sessionData?.name || 'Loading Takeoff...'}
                        </span>
                        {sessionData?.project_title && (
                            <span className={styles.projectBadge}>
                                Project: {sessionData.project_title}
                            </span>
                        )}
                    </div>

                    {/* Active Blueprint Switcher */}
                    {blueprints.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '11px', color: '#64748b' }}>Plan:</span>
                            <select
                                value={activeBlueprint?.id || ''}
                                onChange={(e) => {
                                    const bp = blueprints.find(b => b.id === parseInt(e.target.value));
                                    if (bp) {
                                        setActiveBlueprint(bp);
                                        setActivePage(1);
                                    }
                                }}
                                style={{
                                    background: '#0f172a',
                                    color: '#f8fafc',
                                    border: '1px solid #334155',
                                    borderRadius: '6px',
                                    padding: '4px 8px',
                                    fontSize: '11.5px',
                                    maxWidth: '200px'
                                }}
                                title="Switch Active Blueprint Plan"
                            >
                                {blueprints.map(bp => (
                                    <option key={bp.id} value={bp.id}>{bp.original_filename}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {/* Primary Measurement Tools Group (Icon-only Svgator/CAD Toolbar) */}
                <div className={styles.toolButtonGroup}>
                    <button
                        type="button"
                        onClick={() => setActiveTool('select')}
                        className={`${styles.toolBtn} ${activeTool === 'select' ? styles.activeTool : ''}`}
                        title="Select & Inspect (Shortcut: V)"
                    >
                        <BiTargetLock size={18} />
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTool('pan')}
                        className={`${styles.toolBtn} ${activeTool === 'pan' ? styles.activeTool : ''}`}
                        title="Pan Canvas (Shortcut: H or Hold Space)"
                    >
                        <BiMove size={18} />
                    </button>

                    <div className={styles.toolDivider} />

                    <button
                        type="button"
                        onClick={() => setActiveTool('rect')}
                        className={`${styles.toolBtn} ${activeTool === 'rect' ? styles.activeTool : ''}`}
                        title="Rectangle Area (Shortcut: R) · Drag corner to corner or click 2 points"
                    >
                        <BiShapeSquare size={18} />
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTool('polygon')}
                        className={`${styles.toolBtn} ${activeTool === 'polygon' ? styles.activeTool : ''}`}
                        title="Polygon Area (Shortcut: P) · Click corners, close on start or double click"
                    >
                        <BiShapePolygon size={18} />
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTool('line')}
                        className={`${styles.toolBtn} ${activeTool === 'line' ? styles.activeTool : ''}`}
                        title="Linear Distance (Shortcut: L) · Drag or click endpoints (Hold Shift for Ortho)"
                    >
                        <BiPencil size={18} />
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTool('count')}
                        className={`${styles.toolBtn} ${activeTool === 'count' ? styles.activeTool : ''}`}
                        title="Count Marker (Shortcut: C) · Click anywhere to drop numbered pins"
                    >
                        <BiCheckCircle size={18} />
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTool('volume')}
                        className={`${styles.toolBtn} ${activeTool === 'volume' ? styles.activeTool : ''}`}
                        title="3D Volume with Depth (Shortcut: O) · Concrete slabs, excavation"
                    >
                        <BiCube size={18} />
                    </button>

                    <div className={styles.toolDivider} />

                    <button
                        type="button"
                        onClick={() => setActiveTool('calibrate')}
                        className={`${styles.toolBtn} ${activeTool === 'calibrate' ? styles.activeTool : ''}`}
                        title={`Calibrate Scale (Shortcut: S) · Currently 1 ${activeScale.unit} = ${Math.round(activeScale.pixels_per_unit)}px`}
                    >
                        <BiRuler size={18} />
                    </button>
                </div>

                {/* Scale Calibration & Actions */}
                <div className={styles.toolbarSection}>
                    <button
                        type="button"
                        onClick={() => setActiveTool('calibrate')}
                        className={`${styles.scaleBadge} ${activeTool === 'calibrate' ? styles.activeTool : ''}`}
                        title="Click to Calibrate Scale (Pick 2 known points on plan)"
                    >
                        <BiRuler size={14} />
                        <span>1 {activeScale.unit} = {Math.round(activeScale.pixels_per_unit)}px</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleLoadSampleBlueprint}
                        className={styles.actionBtn}
                        style={{ background: 'rgba(59, 130, 246, 0.15)', borderColor: '#3b82f6', color: '#60a5fa' }}
                        title="Load High-Definition Commercial Footprint & Floor Plan Example"
                    >
                        <BiLayer size={14} /> ⚡ Sample Plan
                    </button>

                    <button
                        type="button"
                        onClick={() => setUploadModal(true)}
                        className={styles.actionBtn}
                        title="Upload Blueprint or Choose from Media Library"
                    >
                        <BiImages size={14} /> Blueprints ({blueprints.length})
                    </button>

                    <button
                        type="button"
                        onClick={() => handleExport('csv')}
                        className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                        title="Export Estimates to CSV/Excel"
                    >
                        <BiDownload size={14} /> Export
                    </button>

                    <button
                        type="button"
                        onClick={toggleFullScreen}
                        className={styles.actionBtn}
                        title="Toggle Browser Fullscreen"
                    >
                        <BiFullscreen size={14} />
                    </button>
                </div>
            </header>

            {/* Main Area: Blueprint Canvas + Side Panel */}
            <div className={styles.workspaceBody}>
                {/* Canvas Workspace Viewport */}
                <div
                    ref={containerRef}
                    className={styles.canvasArea}
                    style={{
                        cursor: activeTool === 'pan' 
                            ? (isPanning ? 'grabbing' : 'grab') 
                            : activeTool === 'select' 
                                ? 'default' 
                                : 'crosshair'
                    }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onDoubleClick={handleDoubleClick}
                >
                    {/* Live Instruction Bar */}
                    <div className={styles.hintBar}>
                        <span>Tool: <strong>{activeTool.toUpperCase()}</strong></span>
                        <span>·</span>
                        {activeTool === 'rect' && <span>Drag corner to corner or click 2 points to measure rectangular area (R)</span>}
                        {activeTool === 'polygon' && <span>Click corners to trace area · Click first point or Enter to close (P)</span>}
                        {activeTool === 'line' && <span>Drag or click endpoints to measure distance · Shift for 90° ortho (L)</span>}
                        {activeTool === 'count' && <span>Click anywhere on plan to drop numbered markers (C)</span>}
                        {activeTool === 'volume' && <span>Trace 3D volume area with depth for excavation or concrete (O)</span>}
                        {activeTool === 'calibrate' && <span>Click 2 points on a known dimension to calibrate scale (S)</span>}
                        {activeTool === 'pan' && <span>Drag to pan · Scroll wheel to zoom (H)</span>}
                        {activeTool === 'select' && <span>Click any measurement or corner to inspect and edit (V)</span>}
                        <span>·</span>
                        <span><kbd>Esc</kbd> Cancel</span>
                    </div>

                    {/* Transform Layer for Pan & Zoom */}
                    <div
                        style={{
                            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                            transformOrigin: '0 0',
                            position: 'relative'
                        }}
                    >
                        {/* Layer 1: Blueprint raster background */}
                        <canvas
                            ref={bgCanvasRef}
                            width={1600}
                            height={1000}
                            style={{ display: 'block', maxWidth: 'none', maxHeight: 'none', position: 'relative', zIndex: 1 }}
                        />

                        {/* Layer 2: Annotations & drawing vector overlay */}
                        <canvas
                            ref={drawCanvasRef}
                            width={1600}
                            height={1000}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                pointerEvents: 'none',
                                maxWidth: 'none',
                                maxHeight: 'none',
                                zIndex: 2
                            }}
                        />
                    </div>

                    {/* Rendering Blueprint Spinner Overlay */}
                    {blueprintRendering && (
                        <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            background: 'rgba(15, 23, 42, 0.88)',
                            color: '#ffffff',
                            padding: '12px 22px',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            zIndex: 15,
                            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
                            backdropFilter: 'blur(4px)',
                            border: '1px solid #334155'
                        }}>
                            <BiLoaderAlt className="spin" size={20} color="#60a5fa" />
                            <span style={{ fontSize: '13px', fontWeight: 500 }}>Decoding and rendering blueprint drawing...</span>
                        </div>
                    )}

                    {/* Floating Zoom & Pan Controls */}
                    <div className={styles.floatingControls}>
                        <button
                            type="button"
                            onClick={() => setZoom(prev => Math.min(prev * 1.25, 4.0))}
                            className={styles.floatingBtn}
                            title="Zoom In (+)"
                        >
                            <BiZoomIn size={16} />
                        </button>
                        <span style={{ fontSize: '11px', color: '#94a3b8', minWidth: '40px', textAlign: 'center' }}>
                            {Math.round(zoom * 100)}%
                        </span>
                        <button
                            type="button"
                            onClick={() => setZoom(prev => Math.max(prev * 0.8, 0.2))}
                            className={styles.floatingBtn}
                            title="Zoom Out (-)"
                        >
                            <BiZoomOut size={16} />
                        </button>
                        <button
                            type="button"
                            onClick={() => { setZoom(1.0); setPan({ x: 0, y: 0 }); }}
                            className={styles.floatingBtn}
                            title="Reset View"
                        >
                            <BiReset size={16} />
                        </button>

                        {/* PDF Multi-page navigation */}
                        {totalPages > 1 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderLeft: '1px solid #475569', paddingLeft: '8px', marginLeft: '4px' }}>
                                <button
                                    type="button"
                                    disabled={activePage <= 1}
                                    onClick={() => setActivePage(p => Math.max(1, p - 1))}
                                    className={styles.floatingBtn}
                                    style={{ opacity: activePage <= 1 ? 0.4 : 1, padding: '2px 6px' }}
                                    title="Previous PDF Page"
                                >
                                    ◀
                                </button>
                                <span style={{ fontSize: '11px', color: '#cbd5e1', whiteSpace: 'nowrap' }}>
                                    Pg {activePage} / {totalPages}
                                </span>
                                <button
                                    type="button"
                                    disabled={activePage >= totalPages}
                                    onClick={() => setActivePage(p => Math.min(totalPages, p + 1))}
                                    className={styles.floatingBtn}
                                    style={{ opacity: activePage >= totalPages ? 0.4 : 1, padding: '2px 6px' }}
                                    title="Next PDF Page"
                                >
                                    ▶
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Side Panel: Quantities, Assemblies, Totals */}
                <aside className={styles.sidePanel}>
                    {/* Navigation Tabs */}
                    <div className={styles.panelTabs}>
                        <button
                            type="button"
                            onClick={() => setActiveTab('quantities')}
                            className={`${styles.panelTab} ${activeTab === 'quantities' ? styles.activeTab : ''}`}
                        >
                            📋 Takeoffs ({measurements.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('assemblies')}
                            className={`${styles.panelTab} ${activeTab === 'assemblies' ? styles.activeTab : ''}`}
                        >
                            🏗️ Assemblies ({assemblies.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('totals')}
                            className={`${styles.panelTab} ${activeTab === 'totals' ? styles.activeTab : ''}`}
                        >
                            📊 Totals
                        </button>
                    </div>

                    {/* Tab 1: Quantities & Measurements */}
                    {activeTab === 'quantities' && (
                        <div className={styles.panelContent}>
                            {measurements.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px 10px', color: '#64748b' }}>
                                    <BiCalculator size={36} style={{ marginBottom: '8px', opacity: 0.5 }} />
                                    <div style={{ fontWeight: 600, color: '#94a3b8' }}>No Takeoffs Yet</div>
                                    <div style={{ fontSize: '12px', marginTop: '4px' }}>
                                        Select an Area, Linear, or Count tool above and draw on the blueprint.
                                    </div>
                                </div>
                            ) : (
                                measurements.map(m => {
                                    const isSelected = m.id === selectedMeasurementId;
                                    const unitSuffix = m.type === 'rect' || m.type === 'polygon' ? `${m.unit}²` : (m.type === 'volume' ? `${m.unit}³` : m.unit);

                                    return (
                                        <div
                                            key={m.id}
                                            onClick={() => setSelectedMeasurementId(m.id)}
                                            className={`${styles.measureCard} ${isSelected ? styles.selected : ''}`}
                                        >
                                            <div className={styles.measureCardTop}>
                                                <div className={styles.measureTitle}>
                                                    <span className={styles.colorDot} style={{ background: m.color || '#4f46e5' }} />
                                                    <span>{m.label}</span>
                                                </div>
                                                <span className={styles.measureQty}>
                                                    {m.computed_quantity} {unitSuffix}
                                                </span>
                                            </div>

                                            <div className={styles.measureMeta}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span>Assembly:</span>
                                                    <select
                                                        value={m.assembly_id || ''}
                                                        onChange={(e) => handleLinkAssembly(m.id, e.target.value)}
                                                        className={styles.assemblySelect}
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <option value="">Unassigned</option>
                                                        {assemblies.map(a => (
                                                            <option key={a.id} value={a.id}>
                                                                {a.name} (${a.unit_cost}/{a.unit})
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    {m.line_total > 0 && (
                                                        <span className={styles.costTotal}>
                                                            ${Number(m.line_total).toFixed(2)}
                                                        </span>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            deleteMeasurement(m.id);
                                                        }}
                                                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 2 }}
                                                        title="Delete measurement"
                                                    >
                                                        <BiTrash size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}

                    {/* Tab 2: Assemblies & Cost Rates */}
                    {activeTab === 'assemblies' && (
                        <div className={styles.panelContent}>
                            <button
                                type="button"
                                onClick={() => setAssemblyModal(prev => ({ ...prev, open: true }))}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    background: '#4f46e5',
                                    color: '#ffffff',
                                    border: 'none',
                                    padding: '8px',
                                    borderRadius: '6px',
                                    fontWeight: 600,
                                    fontSize: '12px',
                                    cursor: 'pointer'
                                }}
                            >
                                <BiPlus size={15} /> Add New Assembly
                            </button>

                            {assemblies.map(a => (
                                <div key={a.id} className={styles.measureCard}>
                                    <div className={styles.measureCardTop}>
                                        <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '13px' }}>
                                            {a.name}
                                        </div>
                                        <span style={{ color: '#34d399', fontWeight: 700, fontFamily: 'Consolas' }}>
                                            ${parseFloat(a.unit_cost).toFixed(2)} / {a.unit}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                                        Waste: {a.waste_factor}% · Labor: ${parseFloat(a.labor_rate).toFixed(2)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Tab 3: Totals & Financial Summary */}
                    {activeTab === 'totals' && (
                        <div className={styles.panelContent}>
                            <div style={{ background: '#0f172a', padding: '14px', borderRadius: '8px', border: '1px solid #334155' }}>
                                <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>
                                    Quantity Aggregates
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
                                    <div style={{ background: '#1e293b', padding: '8px', borderRadius: '6px' }}>
                                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>Total Area</span>
                                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#60a5fa' }}>
                                            {totalArea.toFixed(2)} {activeScale.unit}²
                                        </div>
                                    </div>
                                    <div style={{ background: '#1e293b', padding: '8px', borderRadius: '6px' }}>
                                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>Total Linear</span>
                                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#34d399' }}>
                                            {totalLinear.toFixed(2)} {activeScale.unit}
                                        </div>
                                    </div>
                                    <div style={{ background: '#1e293b', padding: '8px', borderRadius: '6px' }}>
                                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>Total Items</span>
                                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#f87171' }}>
                                            {totalCounts} Count pins
                                        </div>
                                    </div>
                                    <div style={{ background: '#1e293b', padding: '8px', borderRadius: '6px' }}>
                                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>Estimated Cost</span>
                                        <div style={{ fontSize: '14px', fontWeight: 800, color: '#34d399' }}>
                                            ${grandTotalCost.toFixed(2)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Bottom Grand Total Bar */}
                    <div className={styles.bottomTotalsBar}>
                        <div>
                            <div className={styles.grandTotalLabel}>Grand Estimate</div>
                            <div className={styles.grandTotalVal}>
                                ${grandTotalCost.toFixed(2)}
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => handleExport('csv')}
                            className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                            title="Export full breakdown to CSV/Excel"
                        >
                            <BiDownload size={14} /> Export CSV
                        </button>
                    </div>
                </aside>
            </div>

            {/* Scale Calibration Modal */}
            {calibrateModal.open && (
                <Modal
                    isOpen={calibrateModal.open}
                    onClose={() => setCalibrateModal(prev => ({ ...prev, open: false }))}
                    title="📐 Calibrate Blueprint Scale"
                >
                    <form onSubmit={handleApplyCalibration}>
                        <p style={{ fontSize: '13px', color: '#475569', marginBottom: '14px' }}>
                            You measured a distance of <strong>{calibrateModal.pixelDistance} pixels</strong> between Point A and Point B on your plan. Enter the known real-world dimension:
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                                    Real Distance
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    value={calibrateModal.realDistance}
                                    onChange={(e) => setCalibrateModal(prev => ({ ...prev, realDistance: parseFloat(e.target.value) || 0 }))}
                                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                                    Unit
                                </label>
                                <select
                                    value={calibrateModal.unit}
                                    onChange={(e) => setCalibrateModal(prev => ({ ...prev, unit: e.target.value }))}
                                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                                >
                                    <option value="ft">Feet (ft)</option>
                                    <option value="m">Meters (m)</option>
                                    <option value="in">Inches (in)</option>
                                    <option value="cm">Centimeters (cm)</option>
                                    <option value="mm">Millimeters (mm)</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button
                                type="button"
                                onClick={() => setCalibrateModal(prev => ({ ...prev, open: false }))}
                                style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                style={{ padding: '8px 18px', background: '#4f46e5', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 600 }}
                            >
                                Apply Scale Calibration
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Create Assembly Modal */}
            {assemblyModal.open && (
                <Modal
                    isOpen={assemblyModal.open}
                    onClose={() => setAssemblyModal(prev => ({ ...prev, open: false }))}
                    title="🏗️ Add Cost Estimation Assembly"
                >
                    <form onSubmit={handleCreateAssembly}>
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                                Assembly Name
                            </label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. 5/8 Drywall Partition with Insulation"
                                value={assemblyModal.name}
                                onChange={(e) => setAssemblyModal(prev => ({ ...prev, name: e.target.value }))}
                                style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                                    Unit Cost ($)
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={assemblyModal.unit_cost}
                                    onChange={(e) => setAssemblyModal(prev => ({ ...prev, unit_cost: parseFloat(e.target.value) || 0 }))}
                                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                                    Measurement Unit
                                </label>
                                <input
                                    type="text"
                                    value={assemblyModal.unit}
                                    onChange={(e) => setAssemblyModal(prev => ({ ...prev, unit: e.target.value }))}
                                    placeholder="sq ft, ft, ea, cu yd"
                                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                                    Waste Factor (%)
                                </label>
                                <input
                                    type="number"
                                    step="1"
                                    value={assemblyModal.waste_factor}
                                    onChange={(e) => setAssemblyModal(prev => ({ ...prev, waste_factor: parseFloat(e.target.value) || 0 }))}
                                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                                    Labor Rate ($)
                                </label>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={assemblyModal.labor_rate}
                                    onChange={(e) => setAssemblyModal(prev => ({ ...prev, labor_rate: parseFloat(e.target.value) || 0 }))}
                                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button
                                type="button"
                                onClick={() => setAssemblyModal(prev => ({ ...prev, open: false }))}
                                style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                style={{ padding: '8px 18px', background: '#4f46e5', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 600 }}
                            >
                                Save Assembly
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Blueprint Selection & Upload Modal */}
            {uploadModal && (
                <Modal
                    isOpen={uploadModal}
                    onClose={() => setUploadModal(false)}
                    title="📐 Blueprint Drawing & Media Plans"
                    size="medium"
                >
                    <div style={{ padding: '16px 8px' }}>
                        <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b', textAlign: 'center' }}>
                            Upload architectural drawings directly or select existing blueprints from the ERP Media Library.
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                            {/* Option 1: Sample Footprint Blueprint */}
                            <div
                                onClick={handleLoadSampleBlueprint}
                                style={{
                                    border: '1px solid #3b82f6',
                                    borderRadius: '10px',
                                    padding: '18px 12px',
                                    textAlign: 'center',
                                    cursor: 'pointer',
                                    background: '#eff6ff',
                                    transition: 'all 0.15s ease'
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.background = '#dbeafe'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.background = '#eff6ff'; }}
                            >
                                <BiLayer size={36} color="#2563eb" style={{ marginBottom: '8px' }} />
                                <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#1e3a8a', marginBottom: '4px' }}>
                                    ⚡ Load Sample Plan
                                </div>
                                <div style={{ fontSize: '11.5px', color: '#3b82f6' }}>
                                    Instant commercial building footprint (calibrated at 10px = 1ft)
                                </div>
                            </div>

                            {/* Option 2: ERP Media Library */}
                            <div
                                onClick={() => {
                                    setUploadModal(false);
                                    setMediaPickerOpen(true);
                                }}
                                style={{
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '10px',
                                    padding: '18px 12px',
                                    textAlign: 'center',
                                    cursor: 'pointer',
                                    background: '#f8fafc',
                                    transition: 'all 0.15s ease'
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#4f46e5'; e.currentTarget.style.background = '#eef2ff'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = '#f8fafc'; }}
                            >
                                <BiImages size={36} color="#4f46e5" style={{ marginBottom: '8px' }} />
                                <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>
                                    Media Library
                                </div>
                                <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                                    Browse project folders & previously uploaded drawings
                                </div>
                            </div>

                            {/* Option 3: Upload from PC */}
                            <label
                                style={{
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '10px',
                                    padding: '18px 12px',
                                    textAlign: 'center',
                                    cursor: uploading ? 'not-allowed' : 'pointer',
                                    background: '#f8fafc',
                                    display: 'block',
                                    transition: 'all 0.15s ease'
                                }}
                                onMouseEnter={(e) => { if (!uploading) { e.currentTarget.style.borderColor = '#059669'; e.currentTarget.style.background = '#ecfdf5'; } }}
                                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = '#f8fafc'; }}
                            >
                                {uploading ? <BiLoaderAlt className="spin" size={36} color="#059669" style={{ marginBottom: '8px' }} /> : <BiUpload size={36} color="#059669" style={{ marginBottom: '8px' }} />}
                                <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>
                                    {uploading ? 'Uploading Plan...' : 'Upload Drawing'}
                                </div>
                                <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                                    PDF, PNG, JPG, WebP drawings from your PC
                                </div>
                                <input
                                    type="file"
                                    accept=".pdf,image/png,image/jpeg,image/webp,image/tiff"
                                    onChange={handleFileUpload}
                                    disabled={uploading}
                                    style={{ display: 'none' }}
                                />
                            </label>
                        </div>

                        {/* List of currently attached blueprints */}
                        {blueprints.length > 0 && (
                            <div>
                                <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Session Blueprints ({blueprints.length})
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
                                    {blueprints.map(bp => (
                                        <div
                                            key={bp.id}
                                            onClick={() => {
                                                setActiveBlueprint(bp);
                                                setUploadModal(false);
                                                toast.success('Active Blueprint Changed', bp.original_filename);
                                            }}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '8px 12px',
                                                borderRadius: '6px',
                                                border: activeBlueprint?.id === bp.id ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                                                background: activeBlueprint?.id === bp.id ? '#eef2ff' : '#ffffff',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                                <BiImage size={18} color={activeBlueprint?.id === bp.id ? '#4f46e5' : '#64748b'} />
                                                <span style={{ fontSize: '12.5px', fontWeight: 500, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {bp.original_filename}
                                                </span>
                                            </div>
                                            {activeBlueprint?.id === bp.id && (
                                                <span style={{ fontSize: '11px', color: '#4f46e5', fontWeight: 600 }}>Active</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </Modal>
            )}

            {/* Media Manager Picker Modal */}
            <MediaPickerModal
                isOpen={mediaPickerOpen}
                onClose={() => setMediaPickerOpen(false)}
                onSelect={handleSelectFromMedia}
                title="Select Blueprint from ERP Media Library"
            />
        </div>
    );
};

export default TakeoffWorkspace;
