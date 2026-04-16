const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Replace dark text on light backgrounds with light text on dark backgrounds
content = content.replace(/text-gray-900/g, 'text-gray-100');
content = content.replace(/text-gray-800/g, 'text-gray-200');
content = content.replace(/text-gray-700/g, 'text-gray-300');
content = content.replace(/text-gray-600/g, 'text-gray-400');
// Same for borders
content = content.replace(/border-gray-200/g, 'border-gray-700');
content = content.replace(/border-gray-300/g, 'border-gray-600');
// Some specific light bg fills
content = content.replace(/bg-white/g, 'bg-[#1e1e1e]');
content = content.replace(/bg-gray-100/g, 'bg-gray-800');
content = content.replace(/bg-gray-200/g, 'bg-gray-700');
content = content.replace(/hover:bg-gray-50/g, 'hover:bg-gray-800');

fs.writeFileSync('src/App.tsx', content);
console.log('Colors replaced successfully!');
