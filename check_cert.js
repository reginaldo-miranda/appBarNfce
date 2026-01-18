
import prisma from './api/lib/prisma.js';
import fs from 'fs';
import path from 'path';

async function checkCert() {
  try {
    const companies = await prisma.company.findMany(); // List ALL companies
    console.log(`Total de empresas encontradas: ${companies.length}`);
    
    if (companies.length === 0) {
      console.log("Nenhuma empresa encontrada.");
      return;
    }

    for (const company of companies) {
      console.log(`\n--- Dados da Empresa (ID: ${company.id}) ---`);
      console.log(`Ambiente: ${company.ambienteFiscal}`);
      console.log(`Certificado Path (DB): ${company.certificadoPath}`);
      console.log(`Certificado Senha: ${company.certificadoSenha ? '******' : '(vazio)'}`);
      
      if (company.certificadoPath) {
        // Verifica se é caminho absoluto ou relativo e se existe
        const isAbsolute = path.isAbsolute(company.certificadoPath);
        const resolvedPath = isAbsolute ? company.certificadoPath : path.resolve(process.cwd(), 'api', company.certificadoPath);
        
        console.log(`Caminho Resolvido: ${resolvedPath}`);
        
        try {
            if (fs.existsSync(resolvedPath)) {
                console.log("Arquivo EXISTE no disco.");
                const stats = fs.statSync(resolvedPath);
                console.log(`Tamanho do arquivo: ${stats.size} bytes`);
            } else {
                console.log("Arquivo NÃO ENCONTRADO no disco.");
                
                // Tenta procurar na raiz ou em api/certs se for nome simples
                const simpleName = path.basename(company.certificadoPath);
                const candidates = [
                    path.resolve('api', 'certs', simpleName),
                    path.resolve('certs', simpleName),
                    path.resolve(simpleName),
                    path.resolve('api', simpleName)
                ];
                
                console.log("Procurando alternativas:");
                candidates.forEach(c => {
                    if (fs.existsSync(c)) console.log(`[ENCONTRADO] ${c}`);
                    else console.log(`[X] ${c}`);
                });
            }
        } catch (err) {
            console.error("Erro ao verificar arquivo:", err.message);
        }
    } // Close if
    } // Close for loop
    
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

checkCert();
