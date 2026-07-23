import fs from 'fs';

// Fix PencocokanData.tsx
let pData = fs.readFileSync('src/modules/inventory/PencocokanData.tsx', 'utf-8');
pData = pData.replace(/import {([^}]+)} from 'lucide-react';/, (match, group1) => {
  if (!group1.includes('TrendingUp')) {
    return `import {${group1}, TrendingUp} from 'lucide-react';`;
  }
  return match;
});
fs.writeFileSync('src/modules/inventory/PencocokanData.tsx', pData, 'utf-8');

// Fix TransactionInput.tsx
let tData = fs.readFileSync('src/modules/inventory/TransactionInput.tsx', 'utf-8');
tData = tData.replace(/import { useEffect, useState, useMemo, useRef, type FormEvent , memo} from "react";/, `import React, { useEffect, useState, useMemo, useRef, type FormEvent , memo} from "react";`);
fs.writeFileSync('src/modules/inventory/TransactionInput.tsx', tData, 'utf-8');

console.log("Imports fixed");
