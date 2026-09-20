import React, { useState, useRef, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { Network, Loader2 } from 'lucide-react';

export default function GraphAnalyzer() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const fgRef = useRef<any>();

  useEffect(() => {
    if (fgRef.current && data) {
      // Massive repulsion to automatically untangle the hairball without manual dragging
      fgRef.current.d3Force('charge').strength(-2500); 
      // Reasonable edge length to keep it neat
      fgRef.current.d3Force('link').distance(200); 
      
      // Give the physics 1 full second to push apart and settle, THEN auto-zoom camera to capture all nodes
      setTimeout(() => {
         if (fgRef.current) fgRef.current.zoomToFit(1000, 100);
      }, 1000);
    }
  }, [data]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      
      const rawText = await response.text();
      let parsedData;
      try {
         parsedData = JSON.parse(rawText);
      } catch (e) {
         throw new Error(`Server crashed or returned invalid JSON. Raw response: ${rawText.substring(0, 60)}...`);
      }
      
      if (!response.ok) {
        throw new Error(parsedData.error || 'Failed to extract graph');
      }

      setData(parsedData.graph);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {!data ? (
        <form onSubmit={handleSubmit} className="mb-6">
          <textarea
            className="w-full h-48 p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
            placeholder="Paste your dense text, architecture docs, or research paragraphs here..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={loading || !text}
            className="mt-4 w-full bg-slate-900 text-white font-semibold py-4 px-6 rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-all flex items-center justify-center"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-3" />
                Extracting entities & generating graph...
              </>
            ) : (
              <>
                <Network className="h-5 w-5 mr-3" />
                Generate Knowledge Graph
              </>
            )}
          </button>
        </form>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-900 relative shadow-inner">
           {/* Beautiful, floating Start Over button without any of the old marketing headers */}
           <button
             onClick={() => setData(null)}
             className="absolute top-6 right-6 bg-white hover:bg-slate-100 text-slate-900 text-sm font-bold py-3 px-8 rounded-full shadow-xl transition-transform hover:scale-105 z-20"
           >
             Start Over
           </button>
           
           <div className="h-[600px] w-full cursor-move">
              <ForceGraph2D
                ref={fgRef}
                graphData={data}
                nodeRelSize={8}
                linkColor={() => 'rgba(255,255,255,0.4)'}
                onNodeDragEnd={(node: any) => {
                  // Permanently fix the node at its new dragged position
                  node.fx = node.x;
                  node.fy = node.y;
                }}
                nodeCanvasObject={(node: any, ctx, globalScale) => {
                  const label = node.id;
                  const fontSize = 16 / globalScale;
                  ctx.font = `700 ${fontSize}px Inter, sans-serif`;
                  const textWidth = ctx.measureText(label).width;
                  const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 1.5);
                  
                  ctx.fillStyle = 'rgba(255, 255, 255, 1)';
                  ctx.beginPath();
                  // @ts-ignore
                  ctx.roundRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1], 8 / globalScale);
                  ctx.fill();

                  ctx.strokeStyle = '#cbd5e1';
                  ctx.lineWidth = 2 / globalScale;
                  ctx.stroke();

                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.fillStyle = '#0f172a';
                  ctx.fillText(label, node.x as number, node.y as number);
                  
                  node.__bckgDimensions = bckgDimensions;
                }}
                nodePointerAreaPaint={(node: any, color, ctx) => {
                  ctx.fillStyle = color;
                  const bckgDimensions = node.__bckgDimensions;
                  if (bckgDimensions) {
                    ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1]);
                  }
                }}
                linkCanvasObjectMode={() => 'after'}
                linkCanvasObject={(link: any, ctx, globalScale) => {
                  const MAX_FONT_SIZE = 13 / globalScale;
                  const start = link.source;
                  const end = link.target;
                  if (typeof start !== 'object' || typeof end !== 'object') return;

                  const textPos = Object.assign(...['x', 'y'].map(c => ({
                    [c]: start[c] + (end[c] - start[c]) / 2
                  })));

                  const relLink = { x: end.x - start.x, y: end.y - start.y };
                  let textAngle = Math.atan2(relLink.y, relLink.x);
                  if (textAngle > Math.PI / 2) textAngle = -(Math.PI - textAngle);
                  if (textAngle < -Math.PI / 2) textAngle = -(-Math.PI - textAngle);

                  const label = link.label;
                  ctx.font = `600 ${MAX_FONT_SIZE}px Inter, sans-serif`;
                  const textWidth = ctx.measureText(label).width;
                  const bckgDimensions = [textWidth, MAX_FONT_SIZE].map(n => n + MAX_FONT_SIZE * 0.8);
                  
                  ctx.save();
                  ctx.translate(textPos.x, textPos.y);
                  ctx.rotate(textAngle);
                  
                  // Draw solid dark pill for relationship text so it never overlaps weirdly
                  ctx.fillStyle = 'rgba(15, 23, 42, 1)';
                  ctx.beginPath();
                  // @ts-ignore
                  ctx.roundRect(- bckgDimensions[0] / 2, - bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1], 4 / globalScale);
                  ctx.fill();

                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.fillStyle = 'rgba(255, 255, 255, 1)';
                  ctx.fillText(label, 0, 0);
                  ctx.restore();
                }}
              />
           </div>
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200">
          <p className="font-semibold text-sm">Error generating graph:</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}
    </div>
  );
}
