const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

const replacements = [
    { from: "'/registro-productos'", to: "'/control-calidad/registro-productos'" },
    { from: '"/registro-productos"', to: '"/control-calidad/registro-productos"' },
    { from: "'/historial'", to: "'/control-calidad/historial'" },
    { from: '"/historial"', to: '"/control-calidad/historial"' },
    { from: "'/registros-modificados'", to: "'/control-calidad/registros-modificados'" },
    { from: '"/registros-modificados"', to: '"/control-calidad/registros-modificados"' },
    { from: "'/historial-descargas'", to: "'/control-calidad/historial-descargas'" },
    { from: '"/historial-descargas"', to: '"/control-calidad/historial-descargas"' },
    { from: "'/productos'", to: "'/control-calidad/productos'" },
    { from: '"/productos"', to: '"/control-calidad/productos"' },
    { from: "'/temporal'", to: "'/control-calidad/temporal'" },
    { from: '"/temporal"', to: '"/control-calidad/temporal"' }
];

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let changed = false;
            
            for (const { from, to } of replacements) {
                if (content.includes(from)) {
                    content = content.replaceAll(from, to);
                    changed = true;
                }
            }
            
            if (changed) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Updated ${fullPath}`);
            }
        }
    }
}

processDir(srcDir);
console.log("Done");
