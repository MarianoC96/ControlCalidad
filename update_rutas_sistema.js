const fs = require('fs');
const path = require('path');

const directory = './src';

const regexMappings = [
    { regex: /['"`]\/usuarios['"`]/g, replacement: (match) => match[0] + '/control-sistema/gestion-usuarios' + match[match.length - 1] },
    { regex: /['"`]\/solicitudes['"`]/g, replacement: (match) => match[0] + '/control-sistema/centro-solicitudes' + match[match.length - 1] },
    { regex: /['"`]\/accesos['"`]/g, replacement: (match) => match[0] + '/control-sistema/auditoria-accesos' + match[match.length - 1] },
    { regex: /['"`]\/admin\/config-pdf['"`]/g, replacement: (match) => match[0] + '/control-sistema/config-reporte' + match[match.length - 1] },
];

function replaceInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    for (const mapping of regexMappings) {
        if (mapping.regex.test(content)) {
            content = content.replace(mapping.regex, mapping.replacement);
            modified = true;
        }
    }

    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated: ${filePath}`);
    }
}

function traverseDirectory(dir) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            traverseDirectory(fullPath);
        } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
            replaceInFile(fullPath);
        }
    }
}

traverseDirectory(directory);
