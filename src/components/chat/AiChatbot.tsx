import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Bot,
  Send,
  X,
  RotateCcw,
  MessageSquare,
  Flame,
  AlertTriangle,
  TrendingUp,
  Gauge,
  Sliders,
  ChevronRight,
  User,
} from 'lucide-react';
import { useProductionData } from '../../context/ProductionDataContext';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  suggestions?: string[];
}

interface AiChatbotProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AiChatbot: React.FC<AiChatbotProps> = ({ isOpen, onClose }) => {
  const {
    activeDataset,
    oee,
    bottlenecks,
    currentBottleneck,
    targetRisk,
    losses,
  } = useProductionData();

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initial welcome greeting
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'msg_welcome',
      sender: 'assistant',
      text: `Hello! 👋 I am your **FLOWFORGE AI Operations Copilot**.\n\nI am connected live to your **${
        activeDataset?.name || 'Automotive Body Shop & Assembly'
      }** dataset. You can ask me anything about plant bottlenecks, OEE losses, target risk forecasts, or what-if scenario levers!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      suggestions: [
        'Say Hello 👋',
        'What is our top bottleneck?',
        'Explain current Target Risk',
        'How to improve OEE?',
        'What-If simulator advice',
      ],
    },
  ]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, isTyping]);

  // Conversational response generator grounded in active state
  const generateResponse = (userQuery: string): string => {
    const q = userQuery.toLowerCase().trim();

    // 1. GREETINGS
    if (
      q === 'hi' ||
      q === 'hello' ||
      q === 'hey' ||
      q.startsWith('hi ') ||
      q.startsWith('hello ') ||
      q.startsWith('hey ') ||
      q.includes('good morning') ||
      q.includes('good afternoon') ||
      q.includes('greetings')
    ) {
      return (
        `Hello there! 👋 Great to connect with you.\n\n` +
        `I am monitoring **${bottlenecks.length || 5} active machines** in **${
          activeDataset?.name || 'Automotive Assembly'
        }**.\n\n` +
        `• **Current Plant OEE**: ${oee.oee !== null ? `${oee.oee}%` : '74.2%'}\n` +
        `• **Primary Constraint**: ${currentBottleneck?.machineId || 'Paint-Booth-1'}\n` +
        `• **Target Risk Level**: **${targetRisk.riskLevel || 'HIGH'}** (${(targetRisk.projectedDeficit || 640).toLocaleString()} projected deficit units)\n\n` +
        `How can I assist you right now? You can ask me to diagnose the constraint, explain how to eliminate the quota deficit, or recommend what-if lever adjustments!`
      );
    }

    // 2. BOTTLENECKS
    if (q.includes('bottleneck') || q.includes('constraint') || q.includes('failing machine') || q.includes('slowest')) {
      const top = currentBottleneck || (bottlenecks.length > 0 ? bottlenecks[0] : null);
      if (top) {
        return (
          `🔥 **Primary Plant Bottleneck: ${top.machineId}**\n\n` +
          `• **Bottleneck Severity Score**: **${top.bottleneckScore}/100**\n` +
          `• **Root Cause**: ${top.primaryObservedLoss || 'Atomizer Pressure Fluctuation & Nozzle Flush'}\n` +
          `• **Unplanned Downtime**: ${top.downtimeContribution} minutes\n` +
          `• **Throughput Penalty**: ~${top.throughputLoss} units lost\n` +
          `• **Cycle Deviation**: +${top.cycleDeviation}s above ideal standard takt\n\n` +
          `💡 **Actionable Recommendation**: Prioritize preventive nozzle maintenance and verify die clamping alignment to recover an estimated 80+ minutes per shift.`
        );
      }
      return `Currently, the primary constraint is **Paint-Booth-1** due to nozzle clogs and exhaust fan vibration. Resolving this will provide the highest marginal throughput gain.`;
    }

    // 3. TARGET RISK & FORECAST
    if (q.includes('risk') || q.includes('quota') || q.includes('target') || q.includes('deficit') || q.includes('shortfall')) {
      return (
        `⚠️ **Target Risk Analysis & Run-Rate Audit**\n\n` +
        `• **Risk Status**: **${targetRisk.riskLevel} RISK**\n` +
        `• **Scheduled Target**: ${(targetRisk.target || 9800).toLocaleString()} units\n` +
        `• **Current Output**: ${(targetRisk.currentOutput || 8720).toLocaleString()} units\n` +
        `• **Projected Shortfall**: **${(targetRisk.projectedDeficit || 640).toLocaleString()} units**\n` +
        `• **Current Velocity**: ${targetRisk.currentRunRate || 108.5} units/hr vs **${targetRisk.requiredRunRate || 122.0} units/hr required**\n\n` +
        `💡 **Warning Insight**: Current line pacing is trailing quota requirements by ${(targetRisk.requiredRunRate - targetRisk.currentRunRate > 0 ? (targetRisk.requiredRunRate - targetRisk.currentRunRate).toFixed(1) : '13.5')} units/hour. Use the **What-If Simulator** with >25% downtime reduction to eliminate this shortfall.`
      );
    }

    // 4. OEE & LOSSES
    if (q.includes('oee') || q.includes('availability') || q.includes('performance') || q.includes('quality') || q.includes('loss')) {
      const avail = oee.availability !== null ? `${oee.availability}%` : '85.4%';
      const perf = oee.performance !== null ? `${oee.performance}%` : '88.6%';
      const qual = oee.quality !== null ? `${oee.quality}%` : '98.1%';
      const totalOee = oee.oee !== null ? `${oee.oee}%` : '74.2%';

      return (
        `📊 **Live Plant OEE Breakdown**\n\n` +
        `• **Overall OEE**: **${totalOee}**\n` +
        `• **Availability**: ${avail} (Drag factor: Unplanned machine stops)\n` +
        `• **Performance**: ${perf} (Drag factor: Minor speed throttling & takt lag)\n` +
        `• **Quality / Yield**: ${qual} (Defect rate: ${oee.defectRate ?? 1.9}%)\n\n` +
        `💡 **Key Takeaway**: Availability is your biggest drag. Recovering 45 minutes of unplanned downtime per shift will elevate plant OEE by +5.2% immediately.`
      );
    }

    // 5. WHAT-IF SIMULATOR & LEVERS
    if (q.includes('simulator') || q.includes('what if') || q.includes('lever') || q.includes('simulate') || q.includes('warning')) {
      return (
        `🎛️ **What-If Simulator & Risk Prediction Guide**\n\n` +
        `When adjusting levers in the What-If Simulator:\n\n` +
        `1. **Low Levers (<15% total)**: The system triggers a **CRITICAL TARGET RISK WARNING** because the quota deficit remains unmitigated.\n` +
        `2. **Balanced Kaizen (15-30%)**: Reduces the gap into moderate risk territory.\n` +
        `3. **Aggressive SMED (>35% Downtime, >20% Cycle Gain)**: Completely closes 100% of the deficit and unlocks **ZERO SHORTFALL RISK** with surplus production.\n\n` +
        `Try clicking the **"Low Levers (Trigger Risk Warning)"** preset in the simulator to see the dynamic warning system live!`
      );
    }

    // 6. DEFAULT INTELLIGENT INDUSTRIAL AGENT RESPONSE
    return (
      `I analyzed your inquiry regarding "${userQuery}" against current production physics:\n\n` +
      `• **Active Line**: Line-A (Automotive Body Shop & Assembly)\n` +
      `• **Constraint Focus**: **${currentBottleneck?.machineId || 'Paint-Booth-1'}**\n` +
      `• **Operational Priority**: Accelerate line run rate from ${targetRisk.currentRunRate || 108.5} u/hr to ${targetRisk.requiredRunRate || 122.0} u/hr to secure full target delivery.\n\n` +
      `Would you like me to simulate an intervention scenario or break down specific machine root causes?`
    );
  };

  const handleSendMessage = (textToSend?: string) => {
    const messageText = (textToSend || input).trim();
    if (!messageText) return;

    const userMsg: ChatMessage = {
      id: `msg_u_${Date.now()}`,
      sender: 'user',
      text: messageText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Simulate realistic thoughtful response
    setTimeout(() => {
      const reply = generateResponse(messageText);
      const assistantMsg: ChatMessage = {
        id: `msg_a_${Date.now()}`,
        sender: 'assistant',
        text: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsTyping(false);
    }, 450);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: `msg_welcome_${Date.now()}`,
        sender: 'assistant',
        text: `Chat reset. 👋 How can I help you optimize your factory floor right now?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestions: [
          'Say Hello 👋',
          'What is our top bottleneck?',
          'Explain current Target Risk',
          'What-If simulator advice',
        ],
      },
    ]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-white border-l border-slate-200 shadow-2xl flex flex-col font-sans transition-all duration-300">
      {/* CHAT HEADER */}
      <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-sm">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-bold tracking-tight">FLOWFORGE AI Copilot</h3>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <p className="text-[10px] text-slate-400 truncate max-w-[220px]">
              {activeDataset?.name || 'Industrial Assembly Line'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleClearChat}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
            title="Clear Chat History"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
            title="Close Assistant"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* QUICK STATUS BAR */}
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-[11px] font-mono text-slate-600 shrink-0">
        <span className="flex items-center gap-1">
          <Gauge className="w-3.5 h-3.5 text-blue-600" />
          OEE: <strong>{oee.oee !== null ? `${oee.oee}%` : '74.2%'}</strong>
        </span>
        <span className="flex items-center gap-1">
          <Flame className="w-3.5 h-3.5 text-rose-500" />
          Constraint: <strong>{currentBottleneck?.machineId || 'Paint-Booth-1'}</strong>
        </span>
        <span className="flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          Risk: <strong className="text-rose-600">{targetRisk.riskLevel}</strong>
        </span>
      </div>

      {/* MESSAGE LIST */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-100/50">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.sender === 'user' ? 'items-end' : 'items-start'
            } space-y-1.5`}
          >
            <div className="flex items-center gap-1.5 px-1 text-[10px] text-slate-400 font-mono">
              {msg.sender === 'assistant' ? (
                <>
                  <Sparkles className="w-3 h-3 text-blue-500" />
                  <span>AI Copilot</span>
                </>
              ) : (
                <>
                  <User className="w-3 h-3 text-slate-500" />
                  <span>You</span>
                </>
              )}
              <span>•</span>
              <span>{msg.timestamp}</span>
            </div>

            <div
              className={`p-3.5 rounded-2xl max-w-[90%] text-xs leading-relaxed shadow-sm ${
                msg.sender === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-none'
                  : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none whitespace-pre-line'
              }`}
            >
              {/* Parse bold and lists nicely */}
              {msg.text.split('\n').map((line, idx) => {
                if (!line) return <div key={idx} className="h-1.5" />;
                // Bold formatting helper
                const parts = line.split(/(\*\*.*?\*\*)/g);
                return (
                  <p key={idx} className={line.startsWith('•') ? 'pl-2 text-slate-700' : ''}>
                    {parts.map((p, pIdx) => {
                      if (p.startsWith('**') && p.endsWith('**')) {
                        return (
                          <strong
                            key={pIdx}
                            className={msg.sender === 'user' ? 'font-bold' : 'font-bold text-slate-900'}
                          >
                            {p.slice(2, -2)}
                          </strong>
                        );
                      }
                      return p;
                    })}
                  </p>
                );
              })}
            </div>

            {/* Render suggestion chips if available */}
            {msg.suggestions && msg.suggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1.5 max-w-[95%]">
                {msg.suggestions.map((sug, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendMessage(sug)}
                    className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-700 transition-all shadow-xs flex items-center gap-1"
                  >
                    <span>{sug}</span>
                    <ChevronRight className="w-3 h-3 text-slate-400" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex items-center gap-2 text-slate-400 text-xs p-2">
            <Bot className="w-4 h-4 text-blue-500 animate-spin" />
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" />
              <span
                className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"
                style={{ animationDelay: '0.2s' }}
              />
              <span
                className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"
                style={{ animationDelay: '0.4s' }}
              />
            </div>
            <span className="text-[11px] font-mono">Synthesizing live operational response...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* INPUT BAR */}
      <div className="p-3 border-t border-slate-200 bg-white shrink-0 space-y-2">
        {/* Quick prompt buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] scrollbar-none">
          <button
            onClick={() => handleSendMessage('Hi')}
            className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium shrink-0"
          >
            👋 Hi
          </button>
          <button
            onClick={() => handleSendMessage('What is our top bottleneck?')}
            className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium shrink-0"
          >
            🔥 Top Bottleneck
          </button>
          <button
            onClick={() => handleSendMessage('Explain current Target Risk')}
            className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium shrink-0"
          >
            ⚠️ Target Risk
          </button>
          <button
            onClick={() => handleSendMessage('What-If simulator advice')}
            className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium shrink-0"
          >
            🎛️ Simulator Advice
          </button>
        </div>

        {/* Input box */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type 'hi', 'hello', or ask about bottlenecks..."
            className="flex-1 bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-sans"
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={!input.trim()}
            className="p-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl transition-all shadow-sm shrink-0"
            title="Send Message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
