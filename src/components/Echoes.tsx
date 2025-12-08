import React, { useState, useRef, useEffect } from 'react';
import { 
  BookOpen, 
  Music, 
  Film, 
  Loader2, 
  Sparkles, 
  Image as ImageIcon, 
  Ghost, 
  Moon, 
  ArrowRight, 
  ArrowLeft,
  Compass, 
  MessageCircle, 
  ExternalLink, 
  RefreshCw 
} from 'lucide-react';
import { findEchoesForFeeling, generateEchoArtifact } from '../services/geminiService';
import type { EchoData } from '../types';

// Constants
const PLACEHOLDERS = [
  "the specific loneliness of 3 AM...",
  "nostalgia for a time I never lived in...",
  "the silence after a loud party...",
  "feeling like a ghost in my own life...",
  "the smell of old books and rain...",
  "waking up and forgetting who I am for a second...",
  "the heavy quiet of a sunday evening...",
  "missing a version of myself that no longer exists...",
  "the urge to disappear into a forest...",
  "overwhelmed by the passage of time...",
  "finding comfort in gray skies...",
  "a sudden, sharp clarity about everything...",
  "the weight of unsaid words...",
  "craving a silence I can't explain..."
];

const DRIFT_CONCEPTS = [
  "The strange comfort of being alone in a crowded room.",
  "A longing for a home you can't return to, or that never was.",
  "The realization that you are currently living in a memory.",
  "The overwhelming awareness of the complexity of everyone's lives.",
  "The desire to care less about things that mean so much.",
  "A sudden moment of clarity in the middle of chaos.",
  "The feeling of wanting to go home when you are already there.",
  "Nostalgia for a conversation you haven't had yet.",
  "The quiet sadness of a friendship slowly fading.",
  "Finding beauty in things that are falling apart.",
  "The anticipation of a future that feels like a memory."
];

type ViewState = 'input' | 'echo' | 'synthesizing' | 'artifact';

const Echoes: React.FC = () => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<EchoData | null>(null);
  const [error, setError] = useState('');
  const [view, setView] = useState<ViewState>('input');
  const [synthesisImage, setSynthesisImage] = useState<string | null>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  
  const inputRef = useRef<HTMLInputElement>(null);

  // Restore Session
  useEffect(() => {
    const savedSession = localStorage.getItem('echoes_active_session');
    if (savedSession) {
        try {
            const parsed = JSON.parse(savedSession);
            if (parsed.data) {
                setData(parsed.data);
                setInput(parsed.input || '');
                setView(parsed.view || 'echo');
                if (parsed.view === 'artifact' && parsed.synthesisImage) {
                    setSynthesisImage(parsed.synthesisImage);
                }
            }
        } catch (e) {
            console.error("Failed to restore session", e);
        }
    }
  }, []);

  // Save Session
  useEffect(() => {
    if (data) {
        localStorage.setItem('echoes_active_session', JSON.stringify({
            data,
            input,
            view,
            synthesisImage
        }));
    }
  }, [data, input, view, synthesisImage]);

  // Placeholder Rotation
  useEffect(() => {
    if (view !== 'input') return;
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDERS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [view]);

  // Main Logic: Find Echoes
  const findEcho = async (overrideInput?: string) => {
    const searchTerm = overrideInput || input;
    
    if (!searchTerm || !searchTerm.trim()) return;
    
    setLoading(true);
    setError('');
    setSynthesisImage(null); 

    try {
      const resultData = await findEchoesForFeeling(searchTerm);
      setData(resultData);
      setView('echo');
    } catch (err) {
      console.error(err);
      setError("The archive is silent. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Logic: Synthesize Image Artifact
  const generateArtifact = async () => {
    if (!data) return;
    
    setView('synthesizing');

    // Create a string of the echoes to influence the art style
    const echoInfluences = data.echoes.map(e => `${e.title} (${e.type})`).join(', ');

    const synthesisPrompt = `
      Cinematic still photograph, 35mm film. ${data.thematic_key}. 
      Inspired by ${echoInfluences}. 
      Tarkovsky, Wong Kar-wai, Bela Tarr aesthetic. 
      Film grain, soft focus, atmospheric, melancholic, found photograph. 
      Fog, rain, golden hour light, liminal spaces, empty rooms, architecture in mist. 
      NO text, NO digital look, NO people's faces.
    `;

    try {
      // The service now handles the fallback (Imagen -> Pollinations) internally
      const imageUrl = await generateEchoArtifact(synthesisPrompt);
      
      const img = new Image();
      // Enable CORS for potential external URLs (fallback) so canvas export works later
      img.crossOrigin = "Anonymous";
      img.src = imageUrl;
      
      img.onload = () => {
         setSynthesisImage(imageUrl);
         setView('artifact');
      };

      img.onerror = () => {
          console.error("Failed to render image");
          setError("Unable to render artifact.");
          setView('echo');
      };

    } catch (err) {
      console.error("Artifact gen error:", err);
      setError("Unable to synthesize artifact visual. Try again.");
      setView('echo');
    }
  };

  // Logic: Download Canvas
  const handleDownloadCard = async () => {
    if (!synthesisImage || !data) return;

    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if(!ctx) return;

        // Card dimensions (taller to fit tracklist)
        const width = 1200;
        // Dynamic height calculation based on number of echoes, but fixed for simplicity + safe buffer
        const tracklistHeight = 150 + (data.echoes.length * 80); 
        const height = width + tracklistHeight;
        
        canvas.width = width;
        canvas.height = height;

        // Background
        ctx.fillStyle = '#0c0a09'; 
        ctx.fillRect(0, 0, width, height);

        // Load Image
        const img = new Image();
        // Crucial for CORS support when using fallback URL
        img.crossOrigin = "Anonymous"; 
        
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = () => reject(new Error("Failed to load image"));
            
            // If it's a URL (fallback), append cache-buster to ensure fresh CORS headers
            if (synthesisImage.startsWith('http')) {
                const separator = synthesisImage.includes('?') ? '&' : '?';
                img.src = `${synthesisImage}${separator}cb=${Date.now()}`;
            } else {
                img.src = synthesisImage;
            }
        });

        // Draw Image (Square top)
        ctx.drawImage(img, 0, 0, width, width);
        
        // Footer Section Styling
        ctx.textAlign = 'left';
        
        // 1. Resonance Key (Thematic Word)
        const contentStartY = width + 80;
        ctx.fillStyle = '#e7e5e4'; // stone-200
        ctx.font = 'bold 60px Serif';
        ctx.fillText(data.thematic_key, 60, contentStartY);

        // 2. Tracklist (Echoes)
        let currentY = contentStartY + 80;
        
        data.echoes.forEach((echo) => {
            // Title
            ctx.fillStyle = '#a8a29e'; // stone-400
            ctx.font = 'bold 32px Sans-Serif';
            ctx.fillText(echo.title.toUpperCase(), 60, currentY);
            
            ctx.fillStyle = '#57534e'; // stone-600
            ctx.font = '24px Monospace';
            ctx.fillText(`${echo.creator} / ${echo.year}`, 60, currentY + 35);
            
            currentY += 80; // Spacing for next item
        });

        // 3. Date / Footer
        ctx.fillStyle = '#44403c'; // stone-700
        ctx.font = '20px Monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`ECHOES ARCHIVE • ${new Date().toLocaleDateString()}`, width / 2, height - 40);

        // Download
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `echoes-artifact-${data.thematic_key.toLowerCase()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (e) {
        console.error("Canvas generation failed", e);
        // Fallback
        const link = document.createElement('a');
        link.href = synthesisImage;
        link.download = `echoes-artifact-image.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
  };

  const handleDrift = () => {
      const randomConcept = DRIFT_CONCEPTS[Math.floor(Math.random() * DRIFT_CONCEPTS.length)];
      setInput(randomConcept);
  };

  const handleReset = () => {
    setData(null);
    setInput('');
    setView('input');
    setSynthesisImage(null);
    localStorage.removeItem('echoes_active_session');
  };

  const handleBack = () => {
    if (view === 'artifact') {
      setView('echo');
    } else if (view === 'echo') {
      setView('input');
    }
  };

  const getIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('narrative') || t.includes('book') || t.includes('letter') || t.includes('poetry')) return <BookOpen className="w-4 h-4" />;
    if (t.includes('auditory') || t.includes('song') || t.includes('music')) return <Music className="w-4 h-4" />;
    if (t.includes('visual') || t.includes('paint') || t.includes('sculpture')) return <ImageIcon className="w-4 h-4" />;
    if (t.includes('film') || t.includes('movie')) return <Film className="w-4 h-4" />;
    return <Ghost className="w-4 h-4" />;
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-200 font-serif selection:bg-stone-800 transition-colors duration-1000 overflow-hidden relative">
      
      {/* Background - Clean unless in Artifact View */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {/* Artifact Background Blur */}
        {view === 'artifact' && synthesisImage && (
            <div className="absolute inset-0 z-0 opacity-20 scale-110 blur-3xl transition-opacity duration-[2000ms]">
                <img src={synthesisImage} className="w-full h-full object-cover" alt="Background Blur" />
            </div>
        )}
      </div>

      <div className="z-10 w-full min-h-[100dvh] relative flex flex-col">
        
        {/* Header */}
        <div className="absolute top-8 w-full z-50 px-6 md:px-8 flex items-center justify-center pointer-events-none">
          {/* Back Button */}
          {view !== 'input' && (
             <button 
                onClick={handleBack}
                className="absolute left-6 md:left-8 pointer-events-auto opacity-70 hover:opacity-100 transition-opacity p-2 -ml-2"
                aria-label="Go back"
             >
                 <ArrowLeft className="w-6 h-6 text-stone-300" />
             </button>
          )}

          {/* Logo - Perfectly Centered */}
          <button 
            onClick={handleReset} 
            className="pointer-events-auto flex items-center gap-2 group opacity-100 hover:opacity-80 transition-all duration-500"
          >
            <Sparkles className="w-4 h-4 text-stone-200 group-hover:text-white" />
            <span className="text-xs tracking-[0.4em] uppercase font-medium text-stone-200 group-hover:text-white">Echoes</span>
          </button>
        </div>

        {/* VIEW: INPUT */}
        {view === 'input' && (
          <div className="flex-grow flex flex-col justify-center items-center max-w-2xl mx-auto w-full px-6 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <div className="text-center mb-12">
                <h1 className="text-3xl md:text-5xl font-light text-stone-200 leading-tight mb-4">
                Trace your feeling.
                </h1>
                <p className="text-stone-500 text-[15px] md:text-base font-sans font-light tracking-wide">
                    The archive is open. What are you carrying today?
                </p>
            </div>
            
            <div className="relative group w-full mb-8">
              <input 
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={PLACEHOLDERS[placeholderIndex]}
                className="w-full bg-transparent border-b border-stone-800 text-xl md:text-2xl py-4 focus:outline-none focus:border-stone-600 transition-colors placeholder-stone-700 font-serif text-center"
                onKeyDown={(e) => {
                    if(e.key === 'Enter') {
                        e.preventDefault();
                        findEcho();
                    }
                }}
              />
            </div>

            <div className="w-full flex flex-col md:flex-row items-center justify-between gap-8">
              <button 
                onClick={handleDrift}
                className="px-6 py-2 bg-stone-900 border border-stone-800 rounded-full text-xs text-stone-400 hover:text-white hover:border-stone-600 transition-all uppercase tracking-widest flex items-center gap-2 group shadow-lg"
              >
                  <Compass className="w-3 h-3 group-hover:rotate-45 transition-transform" />
                  Drift
              </button>

              <div className="flex items-center gap-4">
                {error && <div className="text-red-400 text-xs tracking-wider">{error}</div>}
                <button 
                    onClick={() => findEcho()}
                    disabled={loading || !input.trim()}
                    className={`transition-all duration-700 ${input.trim() ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin text-stone-500" /> : <ArrowRight className="w-5 h-5 text-stone-400 hover:text-white" />}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VIEW: ECHO (Bento Grid) */}
        {view === 'echo' && data && (
          <div className="flex-grow overflow-y-auto w-full px-4 md:px-8 py-24 animate-in fade-in duration-1000">
            <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-min">
                
                {/* 1. User Input Card */}
                <div className="md:col-span-2 bg-stone-900/40 border border-stone-800/50 p-6 md:p-8 rounded-sm flex flex-col justify-between min-h-[180px]">
                    <div className="flex justify-between items-start mb-4">
                        <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">You Traced</div>
                        <button 
                            onClick={() => findEcho()} 
                            disabled={loading}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-stone-800 bg-stone-900/50 text-[9px] uppercase tracking-widest text-stone-400 hover:text-white hover:border-stone-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                            Reshuffle
                        </button>
                    </div>
                    {/* Centered Text */}
                    <div className="flex-grow flex items-center justify-center text-center">
                        <div className="text-2xl md:text-3xl font-serif text-stone-200 leading-tight">
                            "{input}"
                        </div>
                    </div>
                </div>

                {/* 2. Theme Card */}
                <div className="md:col-span-1 bg-stone-900/40 border border-stone-800/50 p-6 md:p-8 rounded-sm flex flex-col justify-center items-center text-center">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500 mb-2">Resonance Key</div>
                    <div className="text-xl font-medium tracking-widest uppercase" style={{ color: data.color_hex }}>
                        {data.thematic_key}
                    </div>
                </div>

                {/* 3. The Echoes (Mapped) */}
                {data.echoes.map((item, idx) => (
                    <div 
                        key={idx} 
                        className={`bg-stone-900/40 border border-stone-800/50 p-6 md:p-8 rounded-sm flex flex-col justify-between group hover:bg-stone-900/60 transition-all duration-500
                            ${idx === 0 ? 'md:col-span-2' : 'md:col-span-1'}
                        `}
                    >
                         <div className="mb-6">
                             {/* Header with Dynamic Accent Color */}
                             <div className="flex items-center gap-2 mb-4" style={{ color: data.color_hex }}>
                                {getIcon(item.type)}
                                <span className="text-[10px] uppercase tracking-widest font-semibold opacity-90">{item.type}</span>
                             </div>
                             <blockquote className="text-lg md:text-xl font-serif text-stone-200 leading-relaxed">
                                "{item.content}"
                             </blockquote>
                         </div>

                         <div className="border-t border-stone-800/50 pt-4 mt-auto">
                             <div className="text-xs font-bold text-white tracking-wide">{item.title}</div>
                             <div className="text-[10px] text-stone-500 uppercase tracking-widest mt-1">
                                {item.creator} <span className="text-stone-700 mx-1">/</span> {item.year}
                             </div>
                         </div>
                    </div>
                ))}

                {/* 4. Community / Reddit Card - DISTINCT STYLE (Raw/Data) */}
                <a 
                    href={`https://www.reddit.com/search/?q=${encodeURIComponent(data.search_query || input)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="md:col-span-1 bg-stone-900/20 border border-dashed border-stone-700 p-6 rounded-sm flex flex-col justify-between hover:border-stone-500 transition-all group cursor-pointer relative overflow-hidden"
                >
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 text-stone-400 mb-4">
                            <MessageCircle className="w-4 h-4" />
                            <span className="text-[10px] uppercase tracking-widest font-medium font-mono">The Human Archive</span>
                        </div>
                        <p className="text-sm text-stone-300 leading-relaxed font-mono opacity-80 tracking-tight">
                            "{data.community_insight}"
                        </p>
                    </div>
                    <div className="mt-6 flex items-center gap-2 text-[10px] uppercase tracking-widest text-stone-500 font-mono group-hover:text-stone-300">
                        View Threads <ExternalLink className="w-3 h-3" />
                    </div>
                </a>

            </div>

            {/* Bottom Action Bar */}
            <div className="fixed bottom-0 left-0 w-full bg-gradient-to-t from-stone-950 via-stone-950/95 to-transparent pt-12 pb-8 px-8 flex justify-between items-end z-20 pointer-events-none">
                <button 
                    onClick={handleReset}
                    className="px-5 py-2 rounded-full border border-stone-700 bg-stone-950 text-[10px] uppercase tracking-widest text-stone-400 hover:text-stone-200 hover:border-stone-500 transition-all pointer-events-auto"
                >
                    Trace Another
                </button>

                <button 
                    onClick={generateArtifact}
                    className="flex items-center gap-3 px-6 py-3 rounded-full bg-stone-100 text-stone-950 hover:scale-105 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] group pointer-events-auto"
                >
                    <Moon className="w-3 h-3 fill-current" />
                    <span className="text-xs font-bold uppercase tracking-widest">Sit with this</span>
                </button>
            </div>
          </div>
        )}

        {/* VIEW: SYNTHESIZING */}
        {view === 'synthesizing' && (
            <div className="flex-grow flex flex-col justify-center items-center animate-in fade-in duration-1000">
                <div className="relative">
                    <div className="w-16 h-16 border border-stone-800 rounded-full animate-ping absolute opacity-20"></div>
                    <Loader2 className="w-8 h-8 animate-spin text-stone-500" />
                </div>
                <div className="mt-8 text-xs tracking-[0.3em] uppercase text-stone-500 animate-pulse">
                    Synthesizing Artifact
                </div>
            </div>
        )}

        {/* VIEW: ARTIFACT (The Final "Album Art") */}
        {view === 'artifact' && synthesisImage && data && (
            <div className="flex-grow w-full h-full flex flex-col justify-center items-center px-6 py-24 pt-32 animate-in fade-in duration-1000">
                
                {/* Vertical Center Wrapper */}
                <div className="flex flex-col items-center justify-center w-full max-w-sm flex-grow">
                    
                    {/* The Card */}
                    <div className="relative w-full bg-stone-900 shadow-2xl overflow-hidden group border border-stone-800">
                        
                        {/* The Artwork */}
                        <div className="aspect-square w-full relative overflow-hidden">
                            <img 
                                src={synthesisImage} 
                                alt="Emotion Artifact" 
                                className="w-full h-full object-cover transition-transform duration-[10s] group-hover:scale-110" 
                            />
                        </div>

                        {/* The Tracklist (Echoes) */}
                        <div className="bg-stone-950 p-6 space-y-3 border-t border-stone-800">
                            {/* Resonance Key Header */}
                            <div className="pb-4 mb-4 border-b border-stone-900">
                                <h2 className="text-2xl font-serif text-white leading-none">
                                    {data.thematic_key}
                                </h2>
                            </div>

                            {data.echoes.map((echo, idx) => (
                                <div key={idx} className="flex justify-between items-center text-[10px] text-stone-500">
                                    <span className="uppercase tracking-wider truncate max-w-[180px] text-stone-400">{echo.title}</span>
                                    <span className="font-mono opacity-50">{echo.year}</span>
                                </div>
                            ))}
                            
                            <div className="pt-4 mt-4 border-t border-stone-900 flex justify-between items-center">
                                <div className="text-[9px] uppercase tracking-widest text-stone-700">
                                    {new Date().toLocaleDateString()}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Artifact Actions - Visible & Centered */}
                    <div className="mt-8 flex flex-col gap-4 w-full">
                        <button 
                            onClick={handleDownloadCard}
                            className="w-full py-4 bg-stone-100 text-stone-950 font-bold text-xs uppercase tracking-widest rounded-full hover:scale-105 transition-transform shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                        >
                            Download Artifact
                        </button>
                        
                        <button 
                            onClick={handleReset}
                            className="w-full py-4 border border-stone-800 text-stone-400 font-medium text-xs uppercase tracking-widest rounded-full hover:text-white hover:border-stone-600 transition-colors"
                        >
                            Trace Another
                        </button>
                    </div>
                </div>
            </div>
        )}

      </div>
    </div>
  );
};

export default Echoes;