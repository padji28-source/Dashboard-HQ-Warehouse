const fs = require('fs');
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf-8');

// Find activeTab state
code = code.replace(
  "const [activeTab, setActiveTab] = useState<'stock'",
  "const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set(['stock']));\n  const [activeTab, setActiveTab] = useState<'stock'"
);

// Add to setActiveTab logic (it's called inline via onClick)
// Wait, setActiveTab is called inline like `setActiveTab('mts')`.
// So we can just use a wrapper function for handleTabChange, or useEffect to track visited.
code = code.replace(
  "const [sidebarOpen, setSidebarOpen] = useState(false);",
  "const [sidebarOpen, setSidebarOpen] = useState(false);\n  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set(['stock']));\n  const handleTabChange = (tab: any) => { setActiveTab(tab); setVisitedTabs(prev => new Set(prev).add(tab)); setSidebarOpen(false); };"
);

code = code.replace(/setActiveTab\((.*?)\);\s*setSidebarOpen\(false\);/g, "handleTabChange($1);");
code = code.replace(/setActiveTab\(tab\.id as any\);\s*setSidebarOpen\(false\);/g, "handleTabChange(tab.id as any);");

// Now update the rendering loop to only render if visited
code = code.replace(
  /<div className=\{cn\(safeActiveTab !== '(.*?)' && 'hidden'\)\}>\s*([\s\S]*?)<\/div>/g,
  (match, p1, p2) => {
    return `<div className={cn(safeActiveTab !== '${p1}' && 'hidden')}>\n            {visitedTabs.has('${p1}') && (\n              <Suspense fallback={<div className=\"p-8 flex justify-center\"><Loader2 className=\"w-8 h-8 animate-spin text-blue-500\" /></div>}>\n                ${p2}\n              </Suspense>\n            )}\n          </div>`;
  }
);

fs.writeFileSync('src/components/Dashboard.tsx', code);
