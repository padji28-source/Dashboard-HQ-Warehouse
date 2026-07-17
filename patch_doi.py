import re

with open('src/components/DoiMp.tsx', 'r') as f:
    code = f.read()
    
# Remove Papa import
code = re.sub(r'import Papa from [\'"]papaparse[\'"];\n?', '', code)

# add fetchAndParseCSV if missing
if 'fetchAndParseCSV' not in code:
    code = 'import { fetchAndParseCSV } from "../lib/csvCache";\n' + code

pattern = re.compile(r'const pokUrl.*?const pokData = parsedPok\.data\s*\|\|\s*\[\];', re.DOTALL)
replacement = "const pokData = await fetchAndParseCSV<any[]>('https://docs.google.com/spreadsheets/d/e/2PACX-1vSbvA_5FOxi2-nkfz8iJbptOhDfBCLM5LnTwrVLeJ4pf1hlGjSBywsTXQYYtEjuo0DY2M63wcJmc0tP/pub?gid=32687697&single=true&output=csv&hl=id');"

code = pattern.sub(replacement, code)

# Remove the dangling `if (pokRes.ok) {`
code = code.replace('if (pokRes.ok) {', 'if (true) {')

with open('src/components/DoiMp.tsx', 'w') as f:
    f.write(code)
