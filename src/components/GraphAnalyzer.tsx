import React, { useState, useRef, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { Network, Loader2, ShieldCheck, Zap } from 'lucide-react';

export default function GraphAnalyzer() {
  const [text, setText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [graphData, setGraphData] = useState<{ nodes: any[], links: any[] } | null>(null);
  const [error, setError] = useState('');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });

  useEffect(() => {
    if (containerRef.current) {
      setDimensions({
        width: containerRef.current.offsetWidth,
        height: 500
      });
    }
  }, [graphData]);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    setIsAnalyzing(true);
    setError('');
    setGraphData(null);

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      
      const rawText = await response.text();
      let data;
      try {
         data = JSON.parse(rawText);
      } catch (e) {
         throw new Error(`Server crashed or returned invalid JSON. Raw response: ${rawText.substring(0, 60)}...`);
      }
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to extract graph');
      }
      
      setGraphData(data.graph);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="w-full">
      {!graphData && (
        <form onSubmit={handleAnalyze} className="space-y-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste a complex paragraph, news article, or research abstract here... Let the AI extract the entities and relationships."
            className="w-full min-h-[200px] p-4 text-slate-800 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-y shadow-sm font-medium"
            required
          />
          <button
            type="submit"
            disabled={isAnalyzing || !text.trim()}
            className="w-full bg-slate-900 hover:bg-black text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-md"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="animate-spin mr-2 h-5 w-5" />
                AWS Cedar Authorizing & Cloudflare AI Extracting...
              </>
            ) : (
              <>
                <Network className="mr-2 h-5 w-5" />
                Generate Knowledge Graph
              </>
            )}
          </button>
        </form>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
          <strong>Error:</strong> {error}
        </div>
      )}

      {graphData && (
        <div className="mt-6 border border-slate-200 rounded-2xl overflow-hidden bg-slate-50 shadow-inner">
          <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center">
            <div className="flex items-center space-x-4">
               <div className="flex items-center text-green-600 text-sm font-semibold">
                  <ShieldCheck className="h-4 w-4 mr-1" />
                  AWS Cedar Authorized
               </div>
               <div className="flex items-center text-orange-500 text-sm font-semibold">
                  <Zap className="h-4 w-4 mr-1" />
                  Cloudflare Llama-3.1 AI
               </div>
            </div>
            <button
              onClick={() => setGraphData(null)}
              className="text-sm font-bold text-slate-500 hover:text-slate-900 px-3 py-1 bg-slate-100 rounded-md"
            >
              Start Over
            </button>
          </div>
          
          <div ref={containerRef} className="w-full bg-slate-900">
            {typeof window !== 'undefined' && (
              <ForceGraph2D
                width={dimensions.width}
                height={dimensions.height}
                graphData={graphData}
                nodeAutoColorBy="group"
                nodeRelSize={8}
                linkColor={() => 'rgba(255,255,255,0.2)'}
                nodeCanvasObject={(node: any, ctx, globalScale) => {
                  const label = node.id;
                  const fontSize = 12/globalScale;
                  ctx.font = `${fontSize}px Sans-Serif`;
                  const textWidth = ctx.measureText(label).width;
                  const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2); 

                  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                  ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1]);

                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.fillStyle = node.color || '#fff';
                  ctx.fillText(label, node.x, node.y);

                  node.__bckgDimensions = bckgDimensions;
                }}
                nodePointerAreaPaint={(node: any, color, ctx) => {
                  ctx.fillStyle = color;
                  const bckgDimensions = node.__bckgDimensions;
                  bckgDimensions && ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1]);
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
