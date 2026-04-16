import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Download, Copy, Check, Code, Settings, FileJson, FileText, ChevronRight, ChevronDown, Sparkles, Github, Search, Loader2, ExternalLink, Star, Compass, Terminal, Play, MessageSquare, Bot, User, Upload, Menu, X, FolderSearch, Mail, Calendar, HardDrive, Chrome, Cpu, Clock, Network } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

type Parameter = {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
};

type Tool = {
  id: string;
  name: string;
  description: string;
  parameters: Parameter[];
};

type Skill = {
  id: string;
  name: string;
  description: string;
  instructions: string;
  tools: Tool[];
};

type GithubRepo = {
  id: number;
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  stargazers_count: number;
  topics: string[];
};

type ChatMessage = {
  role: 'user' | 'model' | 'system';
  text: string;
  functionCalls?: { name: string; args: any }[];
};

type CronJob = {
  id: string;
  name: string;
  schedule: string;
  skillName: string;
  status: 'running' | 'paused';
};

type SubAgent = {
  id: string;
  name: string;
  task: string;
  status: 'working' | 'completed';
};

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15);
};

// Initialize Gemini API safely
const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

const WORKSPACE_INTEGRATIONS = [
  { id: 'chrome', icon: Chrome, name: 'Chrome Engine', description: 'Interact with open tabs, bookmarks, and search history across devices.', prompt: 'Create a Chrome Browser skill with tools to manage tabs, search bookmarks, and control navigation.' },
  { id: 'gmail', icon: Mail, name: 'Gmail Mastery', description: 'Read, search, draft, and send emails directly from the AI agent.', prompt: 'Create a Gmail skill with tools to search emails, read thread contents, draft replies, and send new messages.' },
  { id: 'calendar', icon: Calendar, name: 'Calendar Sync', description: 'Manage schedules, find free time, and create events.', prompt: 'Create a Google Calendar skill with tools to list upcoming events, check availability, and create new meetings.' },
  { id: 'drive', icon: HardDrive, name: 'Drive Connect', description: 'Search files, extract content, and organize documents.', prompt: 'Create a Google Drive skill with tools to search files by name, read document content, and create text files.' },
];

export default function App() {
  const [skills, setSkills] = useState<Skill[]>(() => {
    const saved = localStorage.getItem('skillBank_skills');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [
      {
        id: generateId(),
        name: 'Weather Assistant',
        description: 'A skill that checks the weather for a given location.',
        instructions: 'You are a helpful weather assistant. Use the provided tools to fetch weather data and answer user queries.',
        tools: [
          {
            id: generateId(),
            name: 'get_weather',
            description: 'Fetches the current weather for a specific city.',
            parameters: [
              { id: generateId(), name: 'location', type: 'string', description: 'The city and state, e.g., San Francisco, CA', required: true },
              { id: generateId(), name: 'unit', type: 'string', description: 'The temperature unit (celsius or fahrenheit)', required: false }
            ]
          }
        ]
      }
    ];
  });

  const [activeSkillId, setActiveSkillId] = useState<string | null>(skills[0]?.id || null);
  const [view, setView] = useState<'agent' | 'editor' | 'discover'>('agent');
  const [skillTab, setSkillTab] = useState<'config' | 'sandbox' | 'cli'>('config');
  
  // Discover & AI State
  const [trendingRepos, setTrendingRepos] = useState<GithubRepo[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');

  // Sandbox State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);

  // Agent State
  const [agentMessages, setAgentMessages] = useState<ChatMessage[]>([]);
  const [agentInput, setAgentInput] = useState('');
  const [isAgentThinking, setIsAgentThinking] = useState(false);
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [subAgents, setSubAgents] = useState<SubAgent[]>([]);

  // Export State
  const [showExport, setShowExport] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Mobile UI
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Toast State
  const [toast, setToast] = useState<{message: string, type: 'success'|'error'} | null>(null);
  
  const showToast = (message: string, type: 'success'|'error' = 'success') => {
    setToast({message, type});
    setTimeout(() => setToast(null), 3000);
  };

  // Folder Scanner Ref
  const folderInputRef = React.useRef<HTMLInputElement>(null);
  
  // Close sidebar on view chance or skill select
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [view, activeSkillId]);

  useEffect(() => {
    localStorage.setItem('skillBank_skills', JSON.stringify(skills));
  }, [skills]);

  useEffect(() => {
    let isMounted = true;
    
    const fetchTrendingRepos = async () => {
      if (trendingRepos.length > 0) return;
      try {
        setIsLoadingRepos(true);
        const res = await fetch('https://api.github.com/search/repositories?q=topic:api+OR+topic:cli+OR+topic:tool+stars:>1000&sort=stars&order=desc&per_page=21');
        if (!res.ok) throw new Error('Rate limited');
        const data = await res.json();
        if (isMounted && data.items) {
          setTrendingRepos(data.items);
        }
      } catch (error) {
        console.error("Failed to fetch repos", error);
        if (isMounted) {
          // Fallback data if GitHub API is rate limited
          setTrendingRepos([
            { id: 1, name: 'supabase', full_name: 'supabase/supabase', description: 'The open source Firebase alternative. Build real-time applications with Postgres.', html_url: 'https://github.com/supabase/supabase', stargazers_count: 65000, topics: ['api', 'database'] },
            { id: 2, name: 'stripe-node', full_name: 'stripe/stripe-node', description: 'Node.js library for the Stripe API. Easily integrate payments and billing.', html_url: 'https://github.com/stripe/stripe-node', stargazers_count: 3500, topics: ['api', 'payments'] },
            { id: 3, name: 'twilio-node', full_name: 'twilio/twilio-node', description: 'A Node.js wrapper for the Twilio API. Send SMS, make calls, and more.', html_url: 'https://github.com/twilio/twilio-node', stargazers_count: 2100, topics: ['api', 'sms'] },
            { id: 4, name: 'resend-node', full_name: 'resend/resend-node', description: 'Node.js SDK for Resend. The new standard for transactional emails.', html_url: 'https://github.com/resend/resend-node', stargazers_count: 1500, topics: ['api', 'email'] },
            { id: 5, name: 'octokit.js', full_name: 'octokit/octokit.js', description: 'The all-batteries-included GitHub SDK for Browsers, Node.js, and Deno.', html_url: 'https://github.com/octokit/octokit.js', stargazers_count: 6000, topics: ['api', 'github'] },
            { id: 6, name: 'discord.js', full_name: 'discordjs/discord.js', description: 'A powerful JavaScript library for interacting with the Discord API.', html_url: 'https://github.com/discordjs/discord.js', stargazers_count: 25000, topics: ['api', 'discord'] },
          ]);
        }
      } finally {
        if (isMounted) setIsLoadingRepos(false);
      }
    };

    if (view === 'discover') {
      fetchTrendingRepos();
    }
    
    return () => { isMounted = false; };
  }, [view, trendingRepos.length]);

  // Reset chat when switching skills
  useEffect(() => {
    setChatMessages([]);
  }, [activeSkillId]);

  const activeSkillIdRef = React.useRef(activeSkillId);
  useEffect(() => {
    activeSkillIdRef.current = activeSkillId;
  }, [activeSkillId]);

  // Ensure activeSkillId is valid after deletions
  useEffect(() => {
    if (activeSkillId && !skills.some(s => s.id === activeSkillId)) {
      setActiveSkillId(skills[0]?.id || null);
    }
  }, [skills, activeSkillId]);

  const generateSkillWithAI = async (prompt: string, isRepo: boolean = false) => {
    if (!ai) {
      showToast("GEMINI_API_KEY is missing. Please configure it in settings.", "error");
      return;
    }
    setIsGenerating(true);
    try {
      const systemPrompt = `You are an expert API and tool integrator. Create a skill definition for the following ${isRepo ? 'GitHub repository' : 'request'}: "${prompt}".
      Respond ONLY with a valid JSON object matching this structure exactly:
      {
        "name": "Skill Name",
        "description": "Short description",
        "instructions": "System instructions for the AI",
        "tools": [
          {
            "name": "tool_name",
            "description": "What the tool does",
            "parameters": [
              {
                "name": "param_name",
                "type": "string",
                "description": "Parameter description",
                "required": true
              }
            ]
          }
        ]
      }
      Note: type must be one of: "string", "number", "boolean", "object", "array".
      Do not include markdown formatting like \`\`\`json, just the raw JSON object.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: systemPrompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      let text = response.text || '';
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();

      const generatedData = JSON.parse(text);

      const newSkill: Skill = {
        id: generateId(),
        name: generatedData.name || 'Generated Skill',
        description: generatedData.description || '',
        instructions: generatedData.instructions || '',
        tools: (generatedData.tools || []).map((t: any) => ({
          id: generateId(),
          name: t.name || 'tool',
          description: t.description || '',
          parameters: (t.parameters || []).map((p: any) => ({
            id: generateId(),
            name: p.name || 'param',
            type: ['string', 'number', 'boolean', 'object', 'array'].includes(p.type) ? p.type : 'string',
            description: p.description || '',
            required: !!p.required
          }))
        }))
      };

      setSkills(prev => [...prev, newSkill]);
      setActiveSkillId(newSkill.id);
      setView('editor');
      setSkillTab('config');
      setShowAiModal(false);
      setAiPrompt('');
      showToast("Skill generated successfully!");
    } catch (error) {
      console.error("AI Generation failed", error);
      showToast("Failed to generate skill. Please try again.", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as (File & { webkitRelativePath: string })[];
    if (!files.length) return;
    if (!ai) {
      showToast("GEMINI_API_KEY is missing. Please configure it in settings.", "error");
      return;
    }
    setIsGenerating(true);
    try {
      const allowedExts = ['.js', '.ts', '.py', '.json', '.md', '.go'];
      const validFiles = files.filter(f =>
        allowedExts.some(ext => f.name.endsWith(ext)) &&
        !f.webkitRelativePath.includes('node_modules') &&
        !f.webkitRelativePath.includes('.git')
      ).slice(0, 15); // Limit files to not overload context

      let fileData = '';
      for (const file of validFiles) {
        const text = await file.text();
        fileData += `\n--- ${file.webkitRelativePath || file.name} ---\n${text.substring(0, 3000)}\n`;
      }

      if (!fileData) {
        showToast("No valid code/text files found to scan.", "error");
        setIsGenerating(false);
        return;
      }

      const prompt = `Analyze these local project files and create a comprehensive skill definition that exposes the project's internal functions or capabilities as tools.\nFiles scanned:\n${fileData}`;
      await generateSkillWithAI(prompt, false);
      showToast("Folder scanned and skill generated!");
    } catch (err) {
      console.error("Folder scan error", err);
      showToast("Error scanning folder.", "error");
      setIsGenerating(false);
    }
    if (folderInputRef.current) folderInputRef.current.value = '';
  };

  const activeSkill = skills.find(s => s.id === activeSkillId) || null;

  const addSkill = () => {
    const newSkill: Skill = {
      id: generateId(),
      name: 'New Skill',
      description: '',
      instructions: '',
      tools: []
    };
    setSkills([...skills, newSkill]);
    setActiveSkillId(newSkill.id);
    setView('editor');
    setSkillTab('config');
  };

  const importSkill = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          // Basic validation
          if (!data.name || !Array.isArray(data.tools)) throw new Error("Invalid skill format");
          
          const newSkill: Skill = {
            id: generateId(),
            name: data.name,
            description: data.description || '',
            instructions: data.instructions || '',
            tools: data.tools.map((t: any) => ({
              id: generateId(),
              name: t.name,
              description: t.description || '',
              parameters: Object.entries(t.parameters?.properties || {}).map(([key, val]: [string, any]) => ({
                id: generateId(),
                name: key,
                type: val.type?.toLowerCase() || 'string',
                description: val.description || '',
                required: (t.parameters?.required || []).includes(key)
              }))
            }))
          };
          setSkills(prev => [...prev, newSkill]);
          setActiveSkillId(newSkill.id);
          setView('editor');
          setSkillTab('config');
        } catch (err) {
          showToast("Failed to parse JSON file.", "error");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const updateActiveSkill = (updates: Partial<Skill> | ((skill: Skill) => Skill)) => {
    if (!activeSkillId) return;
    setSkills(prev => prev.map(s => {
      if (s.id === activeSkillId) {
        return typeof updates === 'function' ? updates(s) : { ...s, ...updates };
      }
      return s;
    }));
  };

  const deleteSkill = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSkills(prev => prev.filter(s => s.id !== id));
  };

  const addTool = () => {
    updateActiveSkill(skill => ({
      ...skill,
      tools: [...skill.tools, { id: generateId(), name: 'new_tool', description: '', parameters: [] }]
    }));
  };

  const updateTool = (toolId: string, updates: Partial<Tool>) => {
    updateActiveSkill(skill => ({
      ...skill,
      tools: skill.tools.map(t => t.id === toolId ? { ...t, ...updates } : t)
    }));
  };

  const deleteTool = (toolId: string) => {
    updateActiveSkill(skill => ({
      ...skill,
      tools: skill.tools.filter(t => t.id !== toolId)
    }));
  };

  const addParameter = (toolId: string) => {
    updateActiveSkill(skill => ({
      ...skill,
      tools: skill.tools.map(t => t.id === toolId ? {
        ...t,
        parameters: [...t.parameters, { id: generateId(), name: 'new_param', type: 'string', description: '', required: false }]
      } : t)
    }));
  };

  const updateParameter = (toolId: string, paramId: string, updates: Partial<Parameter>) => {
    updateActiveSkill(skill => ({
      ...skill,
      tools: skill.tools.map(t => t.id === toolId ? {
        ...t,
        parameters: t.parameters.map(p => p.id === paramId ? { ...p, ...updates } : p)
      } : t)
    }));
  };

  const deleteParameter = (toolId: string, paramId: string) => {
    updateActiveSkill(skill => ({
      ...skill,
      tools: skill.tools.map(t => t.id === toolId ? {
        ...t,
        parameters: t.parameters.filter(p => p.id !== paramId)
      } : t)
    }));
  };

  const generateExportJSON = (skill: Skill) => {
    const exportObj = {
      name: skill.name,
      description: skill.description,
      instructions: skill.instructions,
      tools: skill.tools.map(t => {
        const requiredParams = t.parameters.filter(p => p.required).map(p => p.name);
        const properties = t.parameters.reduce((acc, p) => {
          acc[p.name] = {
            type: p.type,
            description: p.description
          };
          return acc;
        }, {} as Record<string, any>);

        return {
          name: t.name,
          description: t.description,
          parameters: {
            type: 'object',
            properties,
            ...(requiredParams.length > 0 ? { required: requiredParams } : {})
          }
        };
      })
    };
    return JSON.stringify(exportObj, null, 2);
  };

  const generatePythonCLI = (skill: Skill) => {
    const toolsJson = skill.tools.map(t => {
      const requiredParams = t.parameters.filter(p => p.required).map(p => p.name);
      const properties = t.parameters.reduce((acc, p) => {
        acc[p.name] = {
          type: `types.Type.${p.type.toUpperCase()}`,
          description: p.description
        };
        return acc;
      }, {} as Record<string, any>);

      let propsString = "{\n";
      for (const [k, v] of Object.entries(properties)) {
        propsString += `                            "${k}": types.Schema(type=${v.type}, description="${v.description}"),\n`;
      }
      propsString += "                        }";

      return `                types.FunctionDeclaration(
                    name="${t.name}",
                    description="${t.description}",
                    parameters=types.Schema(
                        type=types.Type.OBJECT,
                        properties=${propsString},
                        required=${JSON.stringify(requiredParams)}
                    )
                )`;
    }).join(",\n");

    return `import os
import json
from google import genai
from google.genai import types

# ==========================================
# TapClaw CLI Generator
# Skill: ${skill.name}
# ==========================================
# Prerequisites:
# pip install google-genai
# export GEMINI_API_KEY="your_api_key_here"

# Initialize the client
client = genai.Client()

# Define the tools for this skill
my_tools = [
    types.Tool(
        function_declarations=[
${toolsJson}
        ]
    )
]

def run_cli():
    print("==========================================")
    print("🤖 Gemma / Gemini CLI Started")
    print("Skill: ${skill.name}")
    print("Type 'quit' or 'exit' to stop.")
    print("==========================================\\n")
    
    # You can change this to 'gemma-2-9b-it' if available in your tier
    model_id = "gemini-2.5-flash"
    
    chat = client.chats.create(
        model=model_id,
        config=types.GenerateContentConfig(
            system_instruction="""${skill.instructions}""",
            tools=my_tools,
            temperature=0.7
        )
    )

    while True:
        try:
            user_input = input("\\nYou: ")
            if user_input.lower() in ['quit', 'exit']:
                print("Goodbye!")
                break
                
            if not user_input.strip():
                continue
                
            response = chat.send_message(user_input)
            
            # Handle tool calls automatically in this CLI loop
            while response.function_calls:
                for fc in response.function_calls:
                    print(f"\\n[⚙️ Tool Called] {fc.name}")
                    print(f"Arguments: {json.dumps(fc.args, indent=2)}")
                    
                    # --- IMPLEMENT YOUR TOOL LOGIC HERE ---
                    # For now, we return a mock success response
                    mock_result = {"status": "success", "message": f"Mock execution of {fc.name}"}
                    
                    print(f"[Returning mock result to model...]")
                    response = chat.send_message(
                        types.Part.from_function_response(
                            name=fc.name,
                            response=mock_result
                        )
                    )
            
            if response.text:
                print(f"\\n🤖 AI: {response.text}")
                
        except KeyboardInterrupt:
            print("\\nGoodbye!")
            break
        except Exception as e:
            print(f"\\nError: {e}")

if __name__ == "__main__":
    if not os.environ.get("GEMINI_API_KEY"):
        print("⚠️ Warning: GEMINI_API_KEY environment variable not set.")
    run_cli()
`;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      showToast("Copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      showToast("Failed to copy text.", "error");
    }
  };

  const handleAgentChat = async () => {
    if (!ai) {
      showToast("GEMINI_API_KEY is missing. Please configure it in settings.", "error");
      return;
    }
    if (!agentInput.trim()) return;

    const newMsg: ChatMessage = { role: 'user', text: agentInput };
    setAgentMessages(prev => [...prev, newMsg]);
    setAgentInput('');
    setIsAgentThinking(true);

    try {
      const systemInstruction = `You are a Master AI Agent running locally on the user's phone. 
You coordinate tasks, create cron jobs, and deploy sub-agents using the user's TapClaw.
Available Skills: ${JSON.stringify(skills.map(s => s.name))}
When the user asks to schedule something, use create_cron_job.
When the user asks to perform a complex parallel task, use delegate_to_subagent.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [...agentMessages, newMsg].map(m => ({
          role: m.role === 'system' ? 'model' : m.role,
          parts: [{ text: m.text }]
        })),
        config: {
          systemInstruction,
          tools: [{
            functionDeclarations: [
              {
                name: 'create_cron_job',
                description: 'Schedule a recurring task.',
                parameters: {
                  type: 'OBJECT' as any,
                  properties: {
                    task_name: { type: 'STRING' as any },
                    schedule: { type: 'STRING' as any },
                    skill_name: { type: 'STRING' as any }
                  },
                  required: ['task_name', 'schedule', 'skill_name']
                }
              },
              {
                name: 'delegate_to_subagent',
                description: 'Deploy a sub-agent.',
                parameters: {
                  type: 'OBJECT' as any,
                  properties: {
                    agent_name: { type: 'STRING' as any },
                    task_description: { type: 'STRING' as any },
                    skill_name: { type: 'STRING' as any }
                  },
                  required: ['agent_name', 'task_description', 'skill_name']
                }
              }
            ]
          }]
        }
      });

      let textResult = response.text || '';
      let newCronJobs = [...cronJobs];
      let newSubAgents = [...subAgents];

      if (response.functionCalls && response.functionCalls.length > 0) {
        for (const call of response.functionCalls) {
          if (call.name === 'create_cron_job') {
            const args = call.args as any;
            newCronJobs.unshift({
              id: generateId(),
              name: args.task_name || 'Scheduled Task',
              schedule: args.schedule || 'Daily',
              skillName: args.skill_name || 'Generic API',
              status: 'running'
            });
            textResult += `\n\n[System: Created Cron Job '${args.task_name}' running '${args.schedule}']`;
          } else if (call.name === 'delegate_to_subagent') {
            const args = call.args as any;
            newSubAgents.unshift({
              id: generateId(),
              name: args.agent_name || 'Sub-Agent',
              task: args.task_description || 'Working...',
              status: 'working'
            });
            textResult += `\n\n[System: Deployed Sub-Agent '${args.agent_name}' for task '${args.task_description}']`;
          }
        }
        setCronJobs(newCronJobs);
        setSubAgents(newSubAgents);
      }

      setAgentMessages(prev => [...prev, { role: 'model', text: textResult || 'Task executed.' }]);
    } catch (error) {
      console.error("Agent chat error", error);
      setAgentMessages(prev => [...prev, { role: 'system', text: 'Agent Error: ' + (error as any).message }]);
      showToast("Agent encountered an error.", "error");
    } finally {
      setIsAgentThinking(false);
    }
  };

  const downloadJSON = (skill: Skill) => {
    const json = generateExportJSON(skill);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${skill.name.toLowerCase().replace(/\s+/g, '_')}_skill.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSandboxChat = async () => {
    if (!chatInput.trim() || !activeSkill) return;
    if (!ai) {
      showToast("GEMINI_API_KEY is missing. Please configure it in settings.", "error");
      return;
    }
    
    const currentSkillId = activeSkill.id;
    const newUserMsg: ChatMessage = { role: 'user', text: chatInput };
    setChatMessages(prev => [...prev, newUserMsg]);
    setChatInput('');
    setIsChatting(true);

    try {
      // Map TapClaw tools to Gemini API format
      const tools = activeSkill.tools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: {
          type: 'OBJECT' as any,
          properties: t.parameters.reduce((acc, p) => {
            acc[p.name] = {
              type: p.type.toUpperCase() as any,
              description: p.description
            };
            return acc;
          }, {} as Record<string, any>),
          required: t.parameters.filter(p => p.required).map(p => p.name)
        }
      }));

      // Convert chat history to Gemini format
      const contents = [
        ...chatMessages.map(m => ({
          role: m.role === 'system' ? 'model' : m.role,
          parts: [{ text: m.text }]
        })),
        { role: 'user', parts: [{ text: chatInput }] }
      ];

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash', // Using flash for reliable tool calling simulation
        contents: contents as any,
        config: {
          systemInstruction: activeSkill.instructions,
          tools: tools.length > 0 ? [{ functionDeclarations: tools }] : undefined,
        }
      });

      if (activeSkillIdRef.current !== currentSkillId) return; // Prevent race condition if user switched skills

      const functionCalls = response.functionCalls;
      
      if (functionCalls && functionCalls.length > 0) {
        setChatMessages(prev => [...prev, {
          role: 'model',
          text: 'I need to use a tool to answer this.',
          functionCalls: functionCalls.map(fc => ({ name: fc.name, args: fc.args }))
        }]);
      } else {
        setChatMessages(prev => [...prev, {
          role: 'model',
          text: response.text || 'No response.'
        }]);
      }
    } catch (error) {
      console.error("Chat error", error);
      setChatMessages(prev => [...prev, {
        role: 'system',
        text: 'Error: Failed to get response from the simulation engine. Check console for details.'
      }]);
    } finally {
      setIsChatting(false);
    }
  };

  return (
    <div className="flex h-screen bg-transparent text-[#1a1a1a] font-sans relative overflow-hidden backdrop-blur-[2px]">
      {/* Mobile Navigation Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/30 z-40 md:hidden backdrop-blur-sm transition-opacity" 
          onClick={() => setIsSidebarOpen(false)} 
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition-transform duration-300 ease-in-out w-64 glass-panel border-r border-white/40 flex flex-col shrink-0`}>
        <div className="p-4 border-b border-white/40 flex items-center justify-between glass-header">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg shadow-md ring-1 ring-white/30 bg-gradient-to-br from-[#FFD700] to-[#FFA500] flex items-center justify-center text-black font-black text-xl">
              T
            </div>
            <h1 className="font-semibold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-gray-100 to-gray-300">TapClaw</h1>
          </div>
          <button 
            className="md:hidden p-2 -mr-2 text-gray-500 hover:text-white" 
            onClick={() => setIsSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="p-3 space-y-1 border-b border-white/40">
          <button
            onClick={() => setView('agent')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              view === 'agent' ? 'bg-indigo-50/80 text-indigo-700 shadow-sm ring-1 ring-indigo-500/20' : 'hover:bg-[#1e1e1e]/50 text-gray-300'
            }`}
          >
            <Cpu size={16} />
            TapClaw Core
          </button>
          <button
            onClick={() => setView('discover')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              view === 'discover' ? 'bg-indigo-50/80 text-indigo-700 shadow-sm ring-1 ring-indigo-500/20' : 'hover:bg-[#1e1e1e]/50 text-gray-300'
            }`}
          >
            <Compass size={16} />
            Discover Integrations
          </button>
          <button
            onClick={() => setShowAiModal(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-purple-50/80 text-purple-700"
          >
            <Sparkles size={16} />
            Generate with AI
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1 no-scrollbar">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-2 mt-2 flex items-center justify-between">
            <span>Your Skills</span>
            <span className="bg-[#1e1e1e]/60 text-gray-300 py-0.5 px-2 rounded-full text-[10px] shadow-sm ring-1 ring-black/5">{skills.length}</span>
          </div>
          {skills.map(skill => (
            <div
              key={skill.id}
              onClick={() => {
                setActiveSkillId(skill.id);
                setView('editor');
              }}
              className={`group flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors ${
                view === 'editor' && activeSkillId === skill.id 
                  ? 'bg-blue-50/80 text-blue-800 shadow-sm ring-1 ring-blue-500/20' 
                  : 'hover:bg-[#1e1e1e]/50 text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <Settings size={16} className={view === 'editor' && activeSkillId === skill.id ? 'text-blue-600' : 'text-gray-400'} />
                <span className="truncate text-sm font-medium">{skill.name || 'Untitled Skill'}</span>
              </div>
              <button
                onClick={(e) => deleteSkill(skill.id, e)}
                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        
        <div className="p-4 border-t border-white/40 grid grid-cols-2 gap-2 glass-header relative">
          <input 
            type="file" 
            ref={folderInputRef} 
            onChange={handleFolderUpload} 
            className="hidden" 
            webkitdirectory="" 
            directory="" 
            multiple 
          />
          <button
            onClick={addSkill}
            className="flex items-center justify-center gap-1.5 glass-button text-gray-300 py-2 px-2 rounded-md text-sm font-medium transition-colors"
            title="Create Empty Skill"
          >
            <Plus size={14} />
            New
          </button>
          <button
            onClick={() => folderInputRef.current?.click()}
            className="flex items-center justify-center gap-1.5 glass-button text-purple-700 py-2 px-2 rounded-md text-sm font-medium transition-colors"
            title="Scan Folder for Skills"
          >
            <FolderSearch size={14} />
            Scan Dir
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-transparent">
        
        {/* Mobile Header Top Bar */}
        <div className="md:hidden glass-header px-4 py-3 flex items-center justify-between z-30 shrink-0">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)} 
              className="text-gray-400 hover:text-gray-100 active:bg-gray-800 p-1.5 -ml-1.5 rounded-md transition-colors"
            >
              <Menu size={24} />
            </button>
          </div>
          <button 
            onClick={() => setShowAiModal(true)} 
            className="flex items-center justify-center gap-1.5 text-sm font-medium text-purple-600 bg-purple-50 px-3 py-1.5 rounded-full hover:bg-purple-100 transition-colors"
          >
            <Sparkles size={16} /> <span className="hidden sm:inline">AI Generation</span>
          </button>
        </div>

        {view === 'agent' ? (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-transparent">
            {/* Left side: Master Agent Chat */}
            <div className="flex-1 flex flex-col min-w-0 border-r border-white/20">
              <div className="glass-header px-6 py-4 flex items-center gap-3 border-b border-white/20">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-md">
                  <Cpu size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-100 leading-tight">TapClaw Hub</h2>
                  <p className="text-xs text-gray-400 font-medium">Local TapClaw Orchestrator</p>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 no-scrollbar">
                {agentMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 drop-shadow-sm">
                    <div className="w-16 h-16 bg-[#1e1e1e]/40 flex items-center justify-center rounded-2xl mb-4 border border-white/40 shadow-sm">
                      <Cpu size={32} className="text-indigo-500" />
                    </div>
                    <p className="font-semibold text-gray-100 text-lg mb-1">TapClaw Core Ready</p>
                    <p className="text-sm max-w-xs text-gray-300">Ask the core to utilize skills in your bank, delegate tasks, or schedule cron jobs.</p>
                  </div>
                ) : (
                  agentMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-2xl px-5 py-3.5 shadow-sm ${
                        msg.role === 'user' 
                          ? 'bg-gradient-to-br from-indigo-600 to-blue-600 text-white rounded-br-none border border-indigo-500/50' 
                          : msg.role === 'system'
                          ? 'bg-red-50/80 text-red-700 border border-red-200/50 text-sm backdrop-blur-md'
                          : 'bg-[#1e1e1e]/60 border border-white/60 text-gray-200 rounded-bl-none backdrop-blur-md'
                      }`}>
                        {msg.role === 'model' && (
                          <div className="flex items-center gap-1.5 mb-2 text-[11px] font-bold text-indigo-700 uppercase tracking-wider">
                            <Bot size={14} /> TapClaw Core
                          </div>
                        )}
                        <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{msg.text}</p>
                      </div>
                    </div>
                  ))
                )}
                {isAgentThinking && (
                  <div className="flex justify-start">
                    <div className="bg-[#1e1e1e]/60 border border-white/60 rounded-2xl rounded-bl-none px-5 py-3.5 shadow-sm flex items-center gap-3 backdrop-blur-md">
                      <span className="flex h-3 w-3 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                      </span>
                      <span className="text-sm font-medium text-gray-400">Executing...</span>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="p-4 glass-header border-t border-white/20">
                <form 
                  onSubmit={(e) => { e.preventDefault(); handleAgentChat(); }}
                  className="flex items-center gap-3 bg-[#1e1e1e]/40 p-2 rounded-full border border-white/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
                >
                  <input
                    type="text"
                    value={agentInput}
                    onChange={(e) => setAgentInput(e.target.value)}
                    placeholder="Instruct the agent (e.g., 'Deploy a sub-agent to fetch github trending repos')..."
                    className="flex-1 px-4 py-2 bg-transparent focus:outline-none text-gray-200 placeholder-gray-500 text-[15px]"
                    disabled={isAgentThinking}
                  />
                  <button
                    type="submit"
                    disabled={!agentInput.trim() || isAgentThinking}
                    className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm shrink-0"
                  >
                    <Play size={16} className="ml-1" />
                  </button>
                </form>
              </div>
            </div>

            {/* Right side: Orchestration panel */}
            <div className="w-full md:w-[340px] flex flex-col shrink-0 overflow-y-auto no-scrollbar bg-black/5 md:border-l border-white/20">
              <div className="p-5 md:p-6 space-y-8">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2 drop-shadow-sm">
                    <Clock size={14} className="text-indigo-600" /> Active Cron Jobs ({cronJobs.length})
                  </h3>
                  <div className="space-y-3">
                    {cronJobs.map(job => (
                      <div key={job.id} className="glass-panel p-4 rounded-xl border border-white/60 hover:shadow-md transition-all">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-bold text-gray-100 text-[15px]">{job.name}</h4>
                          <span className="flex h-2.5 w-2.5 relative mt-1">
                            {job.status === 'running' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${job.status === 'running' ? 'bg-emerald-500' : 'bg-gray-400'}`}></span>
                          </span>
                        </div>
                        <p className="text-xs font-medium text-gray-400 mb-2.5 flex items-center gap-1">
                           <Calendar size={12} /> {job.schedule}
                        </p>
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#1e1e1e]/60 text-indigo-700 border border-indigo-100 text-[11px] font-bold rounded-lg uppercase tracking-wider">
                           <Settings size={12} /> {job.skillName}
                        </div>
                      </div>
                    ))}
                    {cronJobs.length === 0 && (
                      <div className="text-sm text-gray-500 italic px-2 py-4 bg-[#1e1e1e]/30 rounded-xl border border-white/40 text-center">No scheduled tasks taking place.</div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2 drop-shadow-sm">
                    <Network size={14} className="text-purple-600" /> Deployed Sub-Agents ({subAgents.length})
                  </h3>
                  <div className="space-y-3">
                    {subAgents.map(agent => (
                      <div key={agent.id} className="glass-panel p-4 rounded-xl border border-white/60 hover:shadow-md transition-all">
                        <div className="flex justify-between items-start mb-1.5">
                          <h4 className="font-bold text-gray-100 text-[15px]">{agent.name}</h4>
                          <span className="flex h-2.5 w-2.5 relative mt-1">
                            {agent.status === 'working' ? (
                               <>
                                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                 <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                               </>
                            ) : (
                               <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-gray-400"></span>
                            )}
                          </span>
                        </div>
                        <p className="text-sm text-gray-300 leading-relaxed font-medium">{agent.task}</p>
                      </div>
                    ))}
                    {subAgents.length === 0 && (
                      <div className="text-sm text-gray-500 italic px-2 py-4 bg-[#1e1e1e]/30 rounded-xl border border-white/40 text-center">No active sub-agents gracefully.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : view === 'discover' ? (
          <div className="flex-1 overflow-y-auto p-4 md:p-8 no-scrollbar">
            <div className="max-w-6xl mx-auto">
              <div className="mb-6 md:mb-8 glass-panel p-6 md:p-8 rounded-2xl">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl md:text-2xl font-semibold text-gray-100 flex items-center gap-2 mb-2">
                      <Sparkles size={24} className="text-purple-600" /> Skill Discover & Integration
                    </h2>
                    <p className="text-gray-300 text-sm md:text-base max-w-2xl">
                      Supercharge the agent with powerful workplace and dev skills. Add pre-built connectors or use AI to generate schemas dynamically.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAiModal(true)}
                    className="hidden md:flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white py-2.5 px-4 rounded-xl text-sm font-medium transition-all shadow-md hover:shadow-lg whitespace-nowrap shrink-0"
                  >
                    <Sparkles size={16} />
                    Custom Prompt Generation
                  </button>
                </div>
              </div>

              {/* Workspace Integrations Section */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-100 mb-4 px-1">Workspace & Business</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {WORKSPACE_INTEGRATIONS.map(integration => (
                    <div key={integration.id} className="glass-panel rounded-xl p-5 hover:bg-[#1e1e1e]/80 transition-all flex flex-col group border border-white/60 shadow-[0_4px_24px_rgba(31,38,135,0.05)]">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-50 flex items-center justify-center text-blue-600 shadow-sm border border-white">
                          <integration.icon size={20} />
                        </div>
                        <h4 className="font-semibold text-gray-100">{integration.name}</h4>
                      </div>
                      <p className="text-sm text-gray-300 flex-1 leading-relaxed mb-4">
                        {integration.description}
                      </p>
                      <button
                        onClick={() => generateSkillWithAI(integration.prompt, false)}
                        disabled={isGenerating}
                        className="w-full justify-center flex items-center gap-2 glass-button text-indigo-700 py-2 px-3 rounded-lg text-sm font-medium transition-all"
                      >
                        <Plus size={16} /> Integrate
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Github Integrations */}
              <div>
                <h3 className="text-lg font-semibold text-gray-100 mb-4 px-1 flex items-center gap-2">
                  <Github size={20} /> Trending Dev Tools
                </h3>
                {isLoadingRepos ? (
                  <div className="flex flex-col items-center justify-center py-20 glass-panel rounded-2xl">
                    <Loader2 className="animate-spin text-indigo-600 mb-4" size={32} />
                    <p className="text-gray-400 font-medium">Fetching repositories...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {trendingRepos.map(repo => (
                      <div key={repo.id} className="glass-panel rounded-xl p-6 hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] transition-all flex flex-col group border border-white/60">
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="font-semibold text-gray-100 truncate pr-4 text-lg" title={repo.full_name}>
                            {repo.name}
                          </h3>
                          <div className="flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50/80 px-2 py-1 rounded-full shrink-0 ring-1 ring-amber-500/20">
                            <Star size={12} className="text-amber-500 fill-amber-500" />
                            {repo.stargazers_count > 1000 ? `${(repo.stargazers_count / 1000).toFixed(1)}k` : repo.stargazers_count}
                          </div>
                        </div>
                        <p className="text-sm text-gray-300 mb-6 line-clamp-3 flex-1 leading-relaxed">
                          {repo.description || 'No description provided.'}
                        </p>
                        <div className="flex items-center gap-2 mt-auto pt-4 border-t border-gray-900/5">
                          <button
                            onClick={() => generateSkillWithAI(`Create a skill for the GitHub repository ${repo.full_name}: ${repo.description}`, true)}
                            disabled={isGenerating}
                            className="flex-1 flex items-center justify-center gap-2 glass-button text-indigo-700 py-2.5 px-3 rounded-lg text-sm font-medium transition-colors"
                          >
                            <Sparkles size={16} />
                            Convert to Skill
                          </button>
                          <a 
                            href={repo.html_url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="p-2.5 text-gray-500 hover:text-gray-100 glass-button rounded-lg transition-colors"
                            title="View on GitHub"
                          >
                            <ExternalLink size={18} />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="h-12"></div>
            </div>
          </div>
        ) : activeSkill ? (
          <>
            {/* Header & Tabs */}
            <header className="glass-header shrink-0">
              <div className="px-4 md:px-8 py-4 md:py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-xl md:text-2xl font-bold tracking-tight text-gray-100 truncate drop-shadow-sm">{activeSkill.name || 'Untitled Skill'}</h2>
                  <p className="text-sm text-gray-400 mt-0.5 truncate">Configure, test, and export your skill.</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => setShowExport(true)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white py-2 px-4 rounded-md text-sm font-medium transition-colors shadow-sm"
                  >
                    <Code size={16} />
                    Export JSON
                  </button>
                </div>
              </div>
              <div className="px-4 md:px-8 flex items-center gap-4 md:gap-6 overflow-x-auto no-scrollbar">
                <button
                  onClick={() => setSkillTab('config')}
                  className={`py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${skillTab === 'config' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                >
                  <div className="flex items-center gap-2"><Settings size={16} /> Configuration</div>
                </button>
                <button
                  onClick={() => setSkillTab('sandbox')}
                  className={`py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${skillTab === 'sandbox' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                >
                  <div className="flex items-center gap-2"><Play size={16} /> Sandbox (Test)</div>
                </button>
                <button
                  onClick={() => setSkillTab('cli')}
                  className={`py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${skillTab === 'cli' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                >
                  <div className="flex items-center gap-2"><Terminal size={16} /> CLI Integration</div>
                </button>
              </div>
            </header>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
              <div className="max-w-4xl mx-auto space-y-6 md:space-y-8">
                
                {skillTab === 'config' && (
                  <>
                    {/* Basic Info */}
                    <section className="glass-panel rounded-2xl overflow-hidden">
                      <div className="px-6 py-4 glass-header bg-[#1e1e1e]/20">
                        <h3 className="text-sm font-semibold text-gray-100 uppercase tracking-wider">Basic Information</h3>
                      </div>
                      <div className="p-6 space-y-5">
                        <div>
                          <label className="block text-sm font-medium text-gray-200 mb-1">Skill Name</label>
                          <input
                            type="text"
                            value={activeSkill.name}
                            onChange={(e) => updateActiveSkill({ name: e.target.value })}
                            className="w-full px-4 py-2.5 glass-input rounded-xl text-base md:text-sm"
                            placeholder="e.g., Weather Assistant"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-200 mb-1">Description</label>
                          <input
                            type="text"
                            value={activeSkill.description}
                            onChange={(e) => updateActiveSkill({ description: e.target.value })}
                            className="w-full px-4 py-2.5 glass-input rounded-xl text-base md:text-sm"
                            placeholder="Briefly describe what this skill does"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-200 mb-1">System Instructions</label>
                          <textarea
                            value={activeSkill.instructions}
                            onChange={(e) => updateActiveSkill({ instructions: e.target.value })}
                            rows={5}
                            className="w-full px-4 py-3 glass-input rounded-xl font-mono text-base md:text-sm leading-relaxed"
                            placeholder="You are a helpful assistant that..."
                          />
                        </div>
                      </div>
                    </section>

                    {/* Tools */}
                    <section>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-100 drop-shadow-sm">Tools ({activeSkill.tools.length})</h3>
                        <button
                          onClick={addTool}
                          className="flex items-center gap-1 text-sm font-medium text-indigo-700 hover:text-indigo-800 glass-button px-4 py-2 rounded-lg transition-colors shadow-sm"
                        >
                          <Plus size={16} />
                          Add Tool
                        </button>
                      </div>

                      {activeSkill.tools.length === 0 ? (
                        <div className="glass-panel border-dashed rounded-2xl p-10 text-center">
                          <div className="w-14 h-14 bg-[#1e1e1e]/60 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)]">
                            <Settings className="text-indigo-500" size={28} />
                          </div>
                          <h4 className="text-gray-100 font-bold text-lg mb-1">No tools added</h4>
                          <p className="text-gray-400 text-sm mb-6 max-w-sm mx-auto">Add tools to allow your skill to perform actions or fetch data.</p>
                          <button
                            onClick={addTool}
                            className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white py-2.5 px-5 rounded-lg text-sm font-medium transition-colors shadow-md"
                          >
                            <Plus size={18} />
                            Add First Tool
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {activeSkill.tools.map((tool, index) => (
                            <div key={tool.id} className="glass-panel rounded-2xl overflow-hidden hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all">
                              <div className="px-6 py-4 glass-header bg-[#1e1e1e]/20 flex items-start justify-between gap-4">
                                <div className="flex-1 space-y-3">
                                  <div className="flex items-center gap-3">
                                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#1e1e1e]/80 border border-white text-indigo-700 text-xs font-bold shadow-sm">
                                      {index + 1}
                                    </span>
                                    <input
                                      type="text"
                                      value={tool.name}
                                      onChange={(e) => updateTool(tool.id, { name: e.target.value })}
                                      className="flex-1 w-full glass-input font-mono font-bold text-gray-100 rounded-lg px-3 py-1.5 text-base md:text-sm"
                                      placeholder="tool_name"
                                    />
                                  </div>
                                  <input
                                    type="text"
                                    value={tool.description}
                                    onChange={(e) => updateTool(tool.id, { description: e.target.value })}
                                    className="w-full text-base md:text-sm text-gray-200 glass-input rounded-lg px-3 py-2"
                                    placeholder="What does this tool do?"
                                  />
                                </div>
                                <button
                                  onClick={() => deleteTool(tool.id)}
                                  className="text-gray-500 hover:text-red-600 p-2 rounded-xl bg-[#1e1e1e]/40 hover:bg-red-50 hover:border-red-100 border border-transparent transition-all shrink-0 self-start mt-1"
                                  title="Delete Tool"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                              
                              <div className="p-6">
                                <div className="flex items-center justify-between mb-4">
                                  <h5 className="text-sm font-semibold text-gray-200">Parameters</h5>
                                  <button
                                    onClick={() => addParameter(tool.id)}
                                    className="text-xs font-semibold text-indigo-700 hover:text-indigo-800 flex items-center gap-1.5 bg-[#1e1e1e]/50 px-3 py-1.5 rounded-md hover:bg-[#1e1e1e]/80 transition-all border border-white/60 shadow-sm"
                                  >
                                    <Plus size={14} /> Add Parameter
                                  </button>
                                </div>
                                
                                {tool.parameters.length === 0 ? (
                                  <div className="text-sm text-gray-500 italic py-2">No parameters defined.</div>
                                ) : (
                                  <div className="space-y-3">
                                    {tool.parameters.map(param => (
                                      <div key={param.id} className="flex items-start gap-3 p-4 bg-[#1e1e1e]/40 backdrop-blur-md rounded-xl border border-white/50 shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)]">
                                        <div className="flex-1 flex flex-col md:grid md:grid-cols-12 gap-3 min-w-0">
                                          <div className="md:col-span-3">
                                            <input
                                              type="text"
                                              value={param.name}
                                              onChange={(e) => updateParameter(tool.id, param.id, { name: e.target.value })}
                                              className="w-full text-base md:text-sm font-mono px-3 py-2 glass-input rounded-lg"
                                              placeholder="param_name"
                                            />
                                          </div>
                                          <div className="md:col-span-2">
                                            <select
                                              value={param.type}
                                              onChange={(e) => updateParameter(tool.id, param.id, { type: e.target.value as any })}
                                              className="w-full text-base md:text-sm px-3 py-2 glass-input rounded-lg"
                                            >
                                              <option value="string">string</option>
                                              <option value="number">number</option>
                                              <option value="boolean">boolean</option>
                                              <option value="object">object</option>
                                              <option value="array">array</option>
                                            </select>
                                          </div>
                                          <div className="md:col-span-5">
                                            <input
                                              type="text"
                                              value={param.description}
                                              onChange={(e) => updateParameter(tool.id, param.id, { description: e.target.value })}
                                              className="w-full text-base md:text-sm px-3 py-2 glass-input rounded-lg"
                                              placeholder="Parameter description"
                                            />
                                          </div>
                                          <div className="md:col-span-2 flex items-center justify-between md:justify-start">
                                            <label className="flex items-center gap-2.5 text-base md:text-sm font-medium text-gray-300 cursor-pointer p-1">
                                              <input
                                                type="checkbox"
                                                checked={param.required}
                                                onChange={(e) => updateParameter(tool.id, param.id, { required: e.target.checked })}
                                                className="rounded-md border-gray-600 w-4 h-4 md:w-4 md:h-4 text-indigo-600 focus:ring-indigo-500 bg-[#1e1e1e]"
                                              />
                                              Required
                                            </label>
                                          </div>
                                        </div>
                                        <button
                                          onClick={() => deleteParameter(tool.id, param.id)}
                                          className="text-gray-400 hover:text-red-500 p-2 rounded-lg bg-[#1e1e1e]/50 hover:bg-red-50 border border-transparent hover:border-red-100 transition-colors mt-0.5 shrink-0"
                                        >
                                          <Trash2 size={16} />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  </>
                )}

                {skillTab === 'sandbox' && (
                  <div className="glass-panel rounded-2xl overflow-hidden flex flex-col h-[600px] shadow-lg">
                    <div className="px-6 py-4 glass-header bg-[#1e1e1e]/20 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bot className="text-indigo-600" size={20} />
                        <h3 className="font-semibold text-gray-100">Simulation Engine</h3>
                      </div>
                      <span className="text-xs font-semibold bg-indigo-100/80 text-indigo-700 px-2.5 py-1 rounded-full border border-indigo-200/50">
                        Powered by Gemini
                      </span>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-transparent no-scrollbar">
                      {chatMessages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 drop-shadow-sm">
                          <MessageSquare size={48} className="text-indigo-300/60 mb-4" />
                          <p className="font-medium text-gray-100 mb-1">Test your skill</p>
                          <p className="text-sm max-w-sm text-gray-300">Send a message to see how the model responds and uses the tools you've defined.</p>
                        </div>
                      ) : (
                        chatMessages.map((msg, i) => (
                          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                              msg.role === 'user' 
                                ? 'bg-blue-600 text-white rounded-br-none' 
                                : msg.role === 'system'
                                ? 'bg-red-50 text-red-700 border border-red-200 text-sm'
                                : 'bg-[#1e1e1e] border border-gray-700 text-gray-200 rounded-bl-none shadow-sm'
                            }`}>
                              {msg.role === 'model' && (
                                <div className="flex items-center gap-2 mb-1 text-xs font-semibold text-blue-600 uppercase tracking-wider">
                                  <Bot size={12} /> AI Response
                                </div>
                              )}
                              <p className="whitespace-pre-wrap text-sm">{msg.text}</p>
                              
                              {msg.functionCalls && msg.functionCalls.length > 0 && (
                                <div className="mt-3 space-y-2">
                                  {msg.functionCalls.map((fc, idx) => (
                                    <div key={idx} className="bg-gray-50 border border-gray-700 rounded-lg p-3">
                                      <div className="flex items-center gap-2 text-xs font-semibold text-gray-300 mb-2">
                                        <Settings size={12} /> Tool Execution Requested
                                      </div>
                                      <div className="font-mono text-xs text-blue-700 font-semibold mb-1">{fc.name}()</div>
                                      <pre className="text-[10px] bg-[#1e1e1e] border border-gray-100 p-2 rounded text-gray-400 overflow-x-auto">
                                        {JSON.stringify(fc.args, null, 2)}
                                      </pre>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                      {isChatting && (
                        <div className="flex justify-start">
                          <div className="bg-[#1e1e1e] border border-gray-700 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm flex items-center gap-2">
                            <Loader2 size={16} className="animate-spin text-blue-600" />
                            <span className="text-sm text-gray-500">Thinking...</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="p-4 glass-header bg-[#1e1e1e]/20">
                      <form 
                        onSubmit={(e) => { e.preventDefault(); handleSandboxChat(); }}
                        className="flex items-center gap-2"
                      >
                        <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          placeholder="Type a message to test your skill..."
                          className="flex-1 px-4 py-2.5 glass-input rounded-full text-base md:text-sm"
                          disabled={isChatting}
                        />
                        <button
                          type="submit"
                          disabled={!chatInput.trim() || isChatting}
                          className="w-11 h-11 md:w-10 md:h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0 shadow-md"
                        >
                          <Play size={16} className="ml-1" />
                        </button>
                      </form>
                    </div>
                  </div>
                )}

                {skillTab === 'cli' && (
                  <div className="bg-[#1e1e1e] rounded-xl shadow-xl overflow-hidden border border-gray-800">
                    <div className="px-6 py-4 border-b border-gray-800 bg-[#252526] flex items-center justify-between">
                      <div className="flex items-center gap-2 text-gray-200">
                        <Terminal size={18} />
                        <h3 className="font-semibold">Python CLI Generator</h3>
                      </div>
                      <button
                        onClick={() => copyToClipboard(generatePythonCLI(activeSkill))}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-white bg-[#333333] hover:bg-[#444444] rounded transition-colors"
                      >
                        {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                        {copied ? 'Copied!' : 'Copy Script'}
                      </button>
                    </div>
                    <div className="p-6 overflow-y-auto max-h-[600px]">
                      <p className="text-gray-400 text-sm mb-4">
                        Run your skill directly from your terminal using the Gemini API. This script automatically handles tool declarations and execution loops.
                      </p>
                      <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap">
                        {generatePythonCLI(activeSkill)}
                      </pre>
                    </div>
                  </div>
                )}
                
                <div className="h-12"></div> {/* Bottom padding */}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-transparent">
            <div className="text-center glass-panel p-10 rounded-3xl max-w-sm border border-white/60">
              <div className="w-16 h-16 bg-[#1e1e1e]/60 backdrop-blur-md rounded-2xl shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)] border border-white/80 flex items-center justify-center mx-auto mb-5">
                <Settings className="text-indigo-500" size={32} />
              </div>
              <h2 className="text-xl font-bold text-gray-100 mb-2 drop-shadow-sm">No Skill Selected</h2>
              <p className="text-gray-300 text-sm mb-6 max-w-sm mx-auto leading-relaxed">Select a skill from the sidebar or create a new one to get started.</p>
              <button
                onClick={addSkill}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white py-2.5 px-6 rounded-xl font-medium transition-all shadow-md hover:shadow-lg"
              >
                <Plus size={18} />
                Create New Skill
              </button>
            </div>
          </div>
        )}
      </div>

      {/* AI Generation Modal */}
      {showAiModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
          <div className="glass-panel border-white/60 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 glass-header flex items-center justify-between">
              <div className="flex items-center gap-2 drop-shadow-sm">
                <Sparkles className="text-purple-600" size={20} />
                <h3 className="text-lg font-bold text-gray-100">Generate Skill with AI</h3>
              </div>
              <button onClick={() => setShowAiModal(false)} className="text-gray-500 hover:text-gray-100 p-1 rounded-lg hover:bg-[#1e1e1e]/50 transition-colors">✕</button>
            </div>
            <div className="p-6 bg-[#1e1e1e]/10">
              <label className="block text-sm font-semibold text-gray-200 mb-2 drop-shadow-sm">
                Describe the skill or tool you want to integrate
              </label>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g., A skill that searches Spotify for tracks and creates playlists..."
                rows={4}
                className="w-full px-4 py-3 glass-input rounded-xl transition-shadow resize-none text-base md:text-sm"
              />
              <p className="text-[11px] font-medium text-gray-400 mt-3 flex items-center gap-1.5 uppercase tracking-wider">
                <Sparkles size={12} className="text-purple-500" /> Powered by Gemini API
              </p>
            </div>
            <div className="px-6 py-4 glass-header bg-[#1e1e1e]/20 flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-3">
              <button 
                onClick={() => setShowAiModal(false)} 
                className="w-full sm:w-auto px-4 py-2 justify-center flex items-center text-sm font-medium text-gray-300 hover:bg-gray-700 rounded-md transition-colors"
                disabled={isGenerating}
              >
                Cancel
              </button>
              <button
                onClick={() => generateSkillWithAI(aiPrompt)}
                disabled={!aiPrompt.trim() || isGenerating}
                className="w-full sm:w-auto flex justify-center items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors shadow-sm"
              >
                {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {isGenerating ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExport && activeSkill && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
          <div className="glass-panel border-white/60 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 glass-header flex items-center justify-between">
              <div className="flex items-center gap-2 drop-shadow-sm">
                <FileJson className="text-indigo-600" size={20} />
                <h3 className="text-lg font-bold text-gray-100">Export Skill Format</h3>
              </div>
              <button
                onClick={() => setShowExport(false)}
                className="text-gray-500 hover:text-gray-100 p-1 rounded-lg hover:bg-[#1e1e1e]/50 transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-[#1e1e1e] border-y border-white/10">
              <pre className="text-sm font-mono text-gray-300 whitespace-pre-wrap">
                {generateExportJSON(activeSkill)}
              </pre>
            </div>
            
            <div className="px-4 md:px-6 py-4 glass-header bg-[#1e1e1e]/20 flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-3">
              <button
                onClick={() => setShowExport(false)}
                className="w-full sm:w-auto justify-center flex items-center px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 rounded-md transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => copyToClipboard(generateExportJSON(activeSkill))}
                className="w-full sm:w-auto justify-center flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-300 bg-[#1e1e1e] border border-gray-600 hover:bg-gray-800 rounded-md transition-colors shadow-sm"
              >
                {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                {copied ? 'Copied!' : 'Copy JSON'}
              </button>
              <button
                onClick={() => downloadJSON(activeSkill)}
                className="w-full sm:w-auto justify-center flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors shadow-sm"
              >
                <Download size={16} />
                Download JSON
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className={`shadow-lg rounded-xl flex items-center gap-3 px-4 py-3 border backdrop-blur-md ${
            toast.type === 'success' 
              ? 'bg-green-500/20 text-green-100 border-green-500/30' 
              : 'bg-red-500/20 text-red-100 border-red-500/30'
          }`}>
            {toast.type === 'success' ? (
              <div className="w-8 h-8 rounded-full bg-green-500/30 flex items-center justify-center">
                <Check size={16} className="text-green-300" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-red-500/30 flex items-center justify-center">
                <X size={16} className="text-red-300" />
              </div>
            )}
            <p className="font-medium text-sm drop-shadow-sm">{toast.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}
