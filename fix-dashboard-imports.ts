import fs from 'fs';
const file = 'src/modules/dashboard/ExecutiveDashboard.tsx';
let content = fs.readFileSync(file, 'utf-8');
content = content.replace(/import { useMemo, useState, useMemo, useState,/g, 'import { useMemo, useState,');
content = content.replace(/import { useMemo, useState, useState,/g, 'import { useMemo, useState,');
content = content.replace(/import { useMemo, useState, useMemo,/g, 'import { useMemo, useState,');
fs.writeFileSync(file, content, 'utf-8');
console.log('Fixed imports');
