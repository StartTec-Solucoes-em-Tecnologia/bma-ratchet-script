/**
 * Script de Validação da Instalação Multi-Threading
 * 
 * Verifica se todos os componentes necessários estão instalados
 * e funcionando corretamente
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Validando instalação do Multi-Threading...\n');

let errors = 0;
let warnings = 0;

// 1. Verifica Node.js version
console.log('📦 Verificando versão do Node.js...');
const nodeVersion = process.version;
const major = parseInt(nodeVersion.split('.')[0].replace('v', ''));

if (major >= 12) {
    console.log(`   ✅ Node.js ${nodeVersion} (suporta worker threads)\n`);
} else {
    console.log(`   ❌ Node.js ${nodeVersion} - ERRO: Requer >= 12.x\n`);
    errors++;
}

// 2. Verifica dependência Piscina
console.log('📦 Verificando dependência Piscina...');
try {
    const Piscina = require('piscina');
    console.log('   ✅ Piscina instalado\n');
} catch (error) {
    console.log('   ❌ Piscina não encontrado - Execute: npm install piscina\n');
    errors++;
}

// 3. Verifica arquivos necessários
console.log('📄 Verificando arquivos necessários...');
const requiredFiles = [
    'src/index.js',
    'src/worker-register-user.js',
    'src/redis-cache.js',
    'test/test-multi-threading.js',
    'docs/MULTI-THREADING.md',
    'example-multi-threading.js'
];

requiredFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        console.log(`   ✅ ${file}`);
    } else {
        console.log(`   ❌ ${file} - NÃO ENCONTRADO`);
        errors++;
    }
});

console.log();

// 4. Verifica variáveis de ambiente
console.log('🔐 Verificando variáveis de ambiente...');
require('dotenv').config();

const requiredEnvVars = [
    'BASE_URL',
    'EVENT_ID',
    'DEVICE_IPS',
    'DIGEST_USERNAME',
    'DIGEST_PASSWORD'
];

requiredEnvVars.forEach(envVar => {
    if (process.env[envVar]) {
        console.log(`   ✅ ${envVar} definido`);
    } else {
        console.log(`   ⚠️  ${envVar} não definido`);
        warnings++;
    }
});

console.log();

// 5. Verifica Redis (opcional)
console.log('💾 Verificando Redis (opcional)...');
if (process.env.REDIS_HOST) {
    console.log(`   ✅ REDIS_HOST definido: ${process.env.REDIS_HOST}`);
} else {
    console.log('   ⚠️  Redis não configurado (funciona sem, mas sem cache)');
    warnings++;
}

console.log();

// 6. Testa importação dos módulos
console.log('🔧 Testando importação dos módulos...');
try {
    const { registerAllUsersInAllRatchets } = require('./src/index');
    console.log('   ✅ Módulo principal importado com sucesso');
} catch (error) {
    console.log(`   ❌ Erro ao importar módulo principal: ${error.message}`);
    errors++;
}

try {
    const registerUser = require('./src/worker-register-user');
    console.log('   ✅ Worker thread importado com sucesso');
} catch (error) {
    console.log(`   ❌ Erro ao importar worker thread: ${error.message}`);
    errors++;
}

console.log();

// 7. Verifica scripts no package.json
console.log('📝 Verificando scripts npm...');
try {
    const packageJson = require('./package.json');
    
    if (packageJson.scripts['test:mt']) {
        console.log('   ✅ Script test:mt disponível');
    } else {
        console.log('   ⚠️  Script test:mt não encontrado');
        warnings++;
    }
    
    if (packageJson.dependencies['piscina']) {
        console.log('   ✅ Piscina listado nas dependências');
    } else {
        console.log('   ❌ Piscina não listado nas dependências');
        errors++;
    }
} catch (error) {
    console.log(`   ❌ Erro ao ler package.json: ${error.message}`);
    errors++;
}

console.log();

// 8. Resumo final
console.log('═'.repeat(60));
console.log('📊 RESUMO DA VALIDAÇÃO');
console.log('═'.repeat(60));

if (errors === 0 && warnings === 0) {
    console.log('✅ Tudo está perfeito! Sistema pronto para uso.');
    console.log('\n🚀 Próximos passos:');
    console.log('   1. npm run register-users    (usa multi-threading)');
    console.log('   2. npm run test:mt           (testa performance)');
    console.log('   3. node example-multi-threading.js 1  (exemplos)');
} else {
    if (errors > 0) {
        console.log(`❌ Encontrados ${errors} erro(s) crítico(s)`);
    }
    if (warnings > 0) {
        console.log(`⚠️  Encontrados ${warnings} aviso(s)`);
    }
    
    console.log('\n📖 Ações recomendadas:');
    if (errors > 0) {
        console.log('   1. Corrija os erros listados acima');
        console.log('   2. Execute novamente: node validate-multi-threading.js');
    }
    if (warnings > 0) {
        console.log('   • Avisos não impedem o funcionamento, mas é recomendado configurar');
    }
}

console.log('═'.repeat(60));
console.log();

// Exit code
process.exit(errors > 0 ? 1 : 0);

